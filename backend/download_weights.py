"""
Optional build-time weight download script for deployment environments (e.g. Render).
Usage: python download_weights.py
Reads MODEL_WEIGHTS_URL and MODEL_WEIGHTS_PATH / MODEL_WEIGHTS_FILE from environment.
"""
from pathlib import Path
import os
import sys
import urllib.request


def main() -> int:
    base_dir = Path(__file__).resolve().parent
    weights_dir = base_dir / "weights"
    weights_file = os.getenv("MODEL_WEIGHTS_FILE", "drishtiAI_efficientnet_b0.pth")
    env_path = os.getenv("MODEL_WEIGHTS_PATH")
    dest_path = Path(env_path) if env_path else (weights_dir / weights_file)
    weights_url = os.getenv("MODEL_WEIGHTS_URL", "").strip()

    if dest_path.exists():
        size_mb = round(dest_path.stat().st_size / (1024 * 1024), 2)
        print(f"[weights-check] Weights file already present at: {dest_path} ({size_mb} MB)")
        return 0

    if not weights_url:
        print("[weights-check] Notice: MODEL_WEIGHTS_URL not set and local weights not found.")
        print("[weights-check] The backend will run in standby mode until weights are supplied via environment variable or volume.")
        return 0

    print(f"[weights-download] Downloading model weights from {weights_url} to {dest_path}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dest = dest_path.with_suffix(".tmp")
    try:
        urllib.request.urlretrieve(weights_url, temp_dest)
        if temp_dest.exists() and temp_dest.stat().st_size > 0:
            temp_dest.replace(dest_path)
            size_mb = round(dest_path.stat().st_size / (1024 * 1024), 2)
            print(f"[weights-download] Successfully downloaded weights to {dest_path} ({size_mb} MB).")
            return 0
        else:
            print("[weights-download] Error: Downloaded weights file is empty.")
            return 1
    except Exception as exc:
        print(f"[weights-download] Error downloading weights: {exc}")
        if temp_dest.exists():
            temp_dest.unlink()
        return 1


if __name__ == "__main__":
    sys.exit(main())
