#!/usr/bin/env python3
import contextlib
import importlib
import importlib.util
import json
import math
import os
import pathlib
import signal
import sys
import tempfile
import types
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


def configure_runtime_environment():
    cache_root = os.path.join(tempfile.gettempdir(), "acousticcanvas-sound-quality-cache")
    matplotlib_config_directory = os.path.join(cache_root, "matplotlib")
    xdg_cache_directory = os.path.join(cache_root, "xdg")
    fontconfig_directory = os.path.join(cache_root, "fontconfig")
    fontconfig_cache_directory = os.path.join(fontconfig_directory, "cache")
    fontconfig_file_path = os.path.join(fontconfig_directory, "fonts.conf")
    os.makedirs(matplotlib_config_directory, exist_ok=True)
    os.makedirs(xdg_cache_directory, exist_ok=True)
    os.makedirs(fontconfig_cache_directory, exist_ok=True)
    if not os.path.exists(fontconfig_file_path):
        with open(fontconfig_file_path, "w", encoding="utf-8") as fontconfig_file:
            fontconfig_file.write(
                f"""<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/System/Library/Fonts</dir>
  <dir>/Library/Fonts</dir>
  <cachedir>{fontconfig_cache_directory}</cachedir>
</fontconfig>
"""
            )
    os.environ.setdefault("MPLBACKEND", "Agg")
    os.environ.setdefault("MPLCONFIGDIR", matplotlib_config_directory)
    os.environ.setdefault("XDG_CACHE_HOME", xdg_cache_directory)
    os.environ.setdefault("FONTCONFIG_FILE", fontconfig_file_path)


def import_metric_functions():
    mosqito_spec = importlib.util.find_spec("mosqito")
    if mosqito_spec is None or mosqito_spec.submodule_search_locations is None:
        raise ImportError("MoSQITo package could not be located.")

    mosqito_directory = pathlib.Path(next(iter(mosqito_spec.submodule_search_locations))).resolve()
    register_package_stub("mosqito", mosqito_directory)
    register_package_stub("mosqito.sq_metrics", mosqito_directory / "sq_metrics")
    register_package_stub("mosqito.sq_metrics.loudness", mosqito_directory / "sq_metrics" / "loudness")
    register_package_stub(
        "mosqito.sq_metrics.loudness.loudness_zwst",
        mosqito_directory / "sq_metrics" / "loudness" / "loudness_zwst",
    )
    register_package_stub("mosqito.sq_metrics.sharpness", mosqito_directory / "sq_metrics" / "sharpness")
    register_package_stub(
        "mosqito.sq_metrics.sharpness.sharpness_din",
        mosqito_directory / "sq_metrics" / "sharpness" / "sharpness_din",
    )
    register_package_stub("mosqito.sq_metrics.roughness", mosqito_directory / "sq_metrics" / "roughness")
    register_package_stub(
        "mosqito.sq_metrics.roughness.roughness_dw",
        mosqito_directory / "sq_metrics" / "roughness" / "roughness_dw",
    )

    loudness_zwst = importlib.import_module(
        "mosqito.sq_metrics.loudness.loudness_zwst.loudness_zwst"
    ).loudness_zwst
    sharpness_din_from_loudness = importlib.import_module(
        "mosqito.sq_metrics.sharpness.sharpness_din.sharpness_din_from_loudness"
    ).sharpness_din_from_loudness
    roughness_dw = importlib.import_module(
        "mosqito.sq_metrics.roughness.roughness_dw.roughness_dw"
    ).roughness_dw
    return loudness_zwst, sharpness_din_from_loudness, roughness_dw


def register_package_stub(package_name, package_directory):
    package = types.ModuleType(package_name)
    package.__path__ = [str(package_directory)]
    package.__package__ = package_name
    package.__file__ = str(package_directory / "__init__.py")
    sys.modules[package_name] = package


def main():
    configure_runtime_environment()

    try:
        import numpy as np
        loudness_zwst, sharpness_din_from_loudness, roughness_dw = import_metric_functions()
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
        loudness_total, specific_loudness, _ = loudness_zwst(mono, sample_rate, field_type="free")
        sharpness = sharpness_din_from_loudness(loudness_total, specific_loudness, weighting="din")
        roughness, _, _, _ = roughness_dw(mono, sample_rate)

    limitations = [
        "Stationary Zwicker loudness, DIN sharpness, and Daniel-Weber roughness computed from uncalibrated digital-amplitude WAV samples.",
        "Values are useful for relative comparison until calibration metadata maps samples to physical sound pressure.",
    ]

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
            "value": round(scalar(roughness), 4),
            "unit": "asper",
            "method": "MoSQITo roughness_dw",
        },
    }
    json.dump(result, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
