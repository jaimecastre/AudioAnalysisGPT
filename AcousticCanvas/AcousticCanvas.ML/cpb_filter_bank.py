#!/usr/bin/env python3
import json
import math
import sys
import wave


def fail(message):
    print(message, file=sys.stderr)
    return 2


def format_band_label(frequency_hz):
    if frequency_hz >= 1000.0:
        value = frequency_hz / 1000.0
        return f"{value:g}k"
    return f"{frequency_hz:g}"


def normalize_band_mode(band_mode):
    return "octave" if str(band_mode).lower() == "octave" else "third_octave"


def normalize_weighting(weighting):
    raw = str(weighting).lower()
    if raw == "a":
        return "a"
    if raw == "c":
        return "c"
    return "z"


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


def weighting_method(weighting):
    if weighting == "a":
        return "A-weighting via PyOctaveBand IEC 61672 frequency response"
    if weighting == "c":
        return "C-weighting via PyOctaveBand IEC 61672 frequency response"
    return "Z-weighting unweighted flat response"


def main():
    try:
        import numpy as np
        from pyoctaveband import getansifrequencies, octavefilter, weighting_filter
    except Exception as exception:
        return fail(f"PyOctaveBand sidecar dependency unavailable: {exception}")

    request = json.load(sys.stdin)
    file_path = request["filePath"]
    start_seconds = float(request["startSeconds"])
    end_seconds = float(request["endSeconds"])
    band_mode = normalize_band_mode(request.get("bandMode", "third_octave"))
    weighting = normalize_weighting(request.get("weighting", "z"))
    fraction = 1 if band_mode == "octave" else 3

    try:
        samples, sample_rate = read_wav_file(file_path)
    except Exception as exception:
        return fail(f"Could not read WAV input for PyOctaveBand sidecar: {exception}")
    start_sample = max(0, min(samples.shape[0], int(math.floor(start_seconds * sample_rate))))
    end_sample = max(0, min(samples.shape[0], int(math.ceil(end_seconds * sample_rate))))
    region = samples[start_sample:end_sample, :]
    if region.shape[0] == 0:
        return fail("Selected CPB region contains no samples.")

    centers, lowers, uppers, labels = getansifrequencies(fraction=fraction, limits=[12, min(20000, sample_rate / 2)])
    requested_channels = request.get("channels", [])
    channel_results = []

    for channel_index in range(region.shape[1]):
        channel_request = requested_channels[channel_index] if channel_index < len(requested_channels) else {}
        channel_samples = region[:, channel_index]
        if weighting != "z":
            channel_samples = weighting_filter(channel_samples, sample_rate, curve=weighting.upper())

        levels_db, frequencies_hz = octavefilter(
            channel_samples,
            fs=sample_rate,
            fraction=fraction,
            limits=[12, min(20000, sample_rate / 2)],
            filter_type="butter",
            dbfs=True,
            mode="rms",
            show=False,
        )

        bands = []
        for index, center_frequency_hz in enumerate(frequencies_hz):
            lower_frequency_hz = float(lowers[index]) if index < len(lowers) else float("nan")
            upper_frequency_hz = float(uppers[index]) if index < len(uppers) else float("nan")
            if upper_frequency_hz < 20.0 or lower_frequency_hz >= sample_rate / 2:
                continue

            level_db = float(levels_db[index])
            magnitude = 0.0 if not math.isfinite(level_db) else math.pow(10.0, level_db / 20.0)
            label = str(labels[index]) if index < len(labels) else format_band_label(float(center_frequency_hz))
            bands.append({
                "label": label,
                "centerFrequencyHz": round(float(center_frequency_hz), 3),
                "lowerFrequencyHz": round(lower_frequency_hz, 3),
                "upperFrequencyHz": round(upper_frequency_hz, 3),
                "plotLowerFrequencyHz": round(lower_frequency_hz, 3),
                "plotUpperFrequencyHz": round(upper_frequency_hz, 3),
                "magnitude": round(magnitude, 9),
                "levelDb": round(level_db, 3) if math.isfinite(level_db) else None,
                "binCount": 0,
            })

        channel_results.append({
            "channelId": channel_request.get("channelId", f"ch{channel_index + 1}"),
            "channelName": channel_request.get("channelName", f"Channel {channel_index + 1}"),
            "quantity": channel_request.get("quantity", "digital_amplitude"),
            "unit": channel_request.get("unit", "FS"),
            "dbUnit": channel_request.get("dbUnit", "dBFS"),
            "bands": bands,
        })

    result = {
        "parameters": {
            "bandMode": band_mode,
            "bandsPerOctave": fraction,
            "fftSize": 0,
            "windowType": "python_filter_bank",
            "overlap": 0.0,
            "averaging": "time-domain filter bank RMS",
            "scaling": "PyOctaveBand dbfs=True",
            "method": "python_filter_bank_pyoctaveband",
            "weighting": weighting,
            "weightingMethod": weighting_method(weighting),
            "limitations": [
                "Experimental Python sidecar path; verify against known calibrator files before standards claims.",
            ],
            "startTimeSeconds": start_seconds,
            "endTimeSeconds": end_seconds,
            "blockCount": 1,
            "sampleRate": int(sample_rate),
        },
        "region": {
            "startSeconds": start_seconds,
            "endSeconds": end_seconds,
            "durationSeconds": max(0.0, end_seconds - start_seconds),
        },
        "channels": channel_results,
    }
    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
