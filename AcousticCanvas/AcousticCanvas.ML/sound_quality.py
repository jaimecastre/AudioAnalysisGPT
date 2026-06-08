#!/usr/bin/env python3
import contextlib
import json
import math
import os
import signal
import sys
import tempfile
import wave


def fail(message):
    print(message, file=sys.stderr)
    return 2


def read_wav_file(file_path):
    import numpy as np

    with wave.open(file_path, "rb") as wav_file:
        channel_count = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        sample_rate = wav_file.getframerate()
        frame_count = wav_file.getnframes()
        raw_frames = wav_file.readframes(frame_count)

    if sample_width == 1:
        samples = np.frombuffer(raw_frames, dtype=np.uint8).astype(np.float64)
        samples = (samples - 128.0) / 128.0
    elif sample_width == 2:
        samples = np.frombuffer(raw_frames, dtype="<i2").astype(np.float64) / 32768.0
    elif sample_width == 3:
        raw = np.frombuffer(raw_frames, dtype=np.uint8).reshape(-1, 3)
        signed = raw[:, 0].astype(np.int32) | (raw[:, 1].astype(np.int32) << 8) | (raw[:, 2].astype(np.int32) << 16)
        signed = np.where(signed & 0x800000, signed | ~0xFFFFFF, signed)
        samples = signed.astype(np.float64) / 8388608.0
    elif sample_width == 4:
        samples = np.frombuffer(raw_frames, dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise ValueError(f"Unsupported WAV sample width: {sample_width} bytes")

    return samples.reshape(-1, channel_count), sample_rate


def scalar(value):
    try:
        return float(value)
    except TypeError:
        return float(value[0])


class TimeoutError(Exception):
    pass


def timeout_handler(_signum, _frame):
    raise TimeoutError()


def compute_roughness_with_timeout(mono, sample_rate, timeout_seconds=5):
    previous_handler = signal.getsignal(signal.SIGALRM)
    try:
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.setitimer(signal.ITIMER_REAL, timeout_seconds)
        from mosqito.sq_metrics import roughness_dw
        roughness, _, _, _ = roughness_dw(mono, sample_rate)
        return scalar(roughness), None
    except TimeoutError:
        return 0.0, "Daniel-Weber roughness timed out for this region; select a shorter region and retry."
    except Exception as exception:
        return 0.0, f"Daniel-Weber roughness unavailable for this region: {exception}"
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)


def main():
    os.environ.setdefault("MPLCONFIGDIR", tempfile.mkdtemp(prefix="acousticcanvas-matplotlib-"))

    try:
        import numpy as np
        from mosqito.sq_metrics import loudness_zwst, sharpness_din_st
    except Exception as exception:
        return fail(f"MoSQITo sidecar dependency unavailable: {exception}")

    request = json.load(sys.stdin)
    file_path = request["filePath"]
    start_seconds = float(request["startSeconds"])
    end_seconds = float(request["endSeconds"])

    try:
        samples, sample_rate = read_wav_file(file_path)
    except Exception as exception:
        return fail(f"Could not read WAV input for MoSQITo sidecar: {exception}")

    start_sample = max(0, min(samples.shape[0], int(math.floor(start_seconds * sample_rate))))
    end_sample = max(0, min(samples.shape[0], int(math.ceil(end_seconds * sample_rate))))
    region = samples[start_sample:end_sample, :]
    if region.shape[0] == 0:
        return fail("Selected sound-quality region contains no samples.")

    mono = np.mean(region, axis=1)
    # MoSQITo prints resampling notices to stdout for sample rates below 48 kHz;
    # keep stdout limited to the JSON result by routing those notices to stderr.
    with contextlib.redirect_stdout(sys.stderr):
        loudness_total, _, _ = loudness_zwst(mono, sample_rate, field_type="free")
        sharpness = sharpness_din_st(mono, sample_rate, weighting="din", field_type="free")
        roughness, roughness_limitation = compute_roughness_with_timeout(mono, sample_rate)

    limitations = [
        "Stationary Zwicker loudness, DIN sharpness, and Daniel-Weber roughness computed from uncalibrated digital-amplitude WAV samples.",
        "Values are useful for relative comparison until calibration metadata maps samples to physical sound pressure.",
    ]
    if roughness_limitation is not None:
        limitations.append(roughness_limitation)

    result = {
        "parameters": {
            "method": "mosqito_stationary_zwicker",
            "library": "MoSQITo",
            "startTimeSeconds": start_seconds,
            "endTimeSeconds": end_seconds,
            "sampleRate": int(sample_rate),
            "limitations": limitations,
        },
        "region": {
            "startSeconds": start_seconds,
            "endSeconds": end_seconds,
            "durationSeconds": max(0.0, end_seconds - start_seconds),
        },
        "loudness": {
            "name": "Stationary loudness",
            "value": round(scalar(loudness_total), 4),
            "unit": "sone",
            "method": "MoSQITo loudness_zwst",
        },
        "sharpness": {
            "name": "DIN sharpness",
            "value": round(scalar(sharpness), 4),
            "unit": "acum",
            "method": "MoSQITo sharpness_din_st",
        },
        "roughness": {
            "name": "Daniel-Weber roughness",
            "value": round(roughness, 4),
            "unit": "asper",
            "method": "MoSQITo roughness_dw",
        },
    }
    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
