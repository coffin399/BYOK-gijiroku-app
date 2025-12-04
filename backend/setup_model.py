#!/usr/bin/env python3
"""
kotoba-whisper-v2.2-faster 初回セットアップ
初回起動時に自動でモデルをダウンロードします
"""

import os
import sys
from pathlib import Path

# モデル設定
MODEL_ID = "RoachLin/kotoba-whisper-v2.2-faster"
LOCAL_PATH = Path("./models/kotoba-whisper-v2.2-faster")

# 必須ファイル
REQUIRED_FILES = ["model.bin", "config.json", "tokenizer.json"]


def is_model_downloaded() -> bool:
    """モデルがダウンロード済みかチェック"""
    if not LOCAL_PATH.exists():
        return False
    
    for filename in REQUIRED_FILES:
        if not (LOCAL_PATH / filename).exists():
            return False
    
    return True


def download_model():
    """モデルをダウンロード"""
    print()
    print("=" * 60)
    print("  kotoba-whisper-v2.2-faster Model Setup")
    print("=" * 60)
    print()
    print(f"  Model: {MODEL_ID}")
    print(f"  Source: https://huggingface.co/{MODEL_ID}")
    print(f"  Destination: {LOCAL_PATH.absolute()}")
    print()
    print("  This is a one-time download (~10GB).")
    print("  Please wait...")
    print()
    
    try:
        from huggingface_hub import snapshot_download
        
        LOCAL_PATH.mkdir(parents=True, exist_ok=True)
        
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=str(LOCAL_PATH),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        
        print()
        print("  [OK] Model downloaded successfully!")
        print()
        
        # Verify
        if is_model_downloaded():
            print("  [OK] Model verification passed!")
            return True
        else:
            print("  [WARN] Some files may be missing.")
            return True  # Continue anyway, faster-whisper will download if needed
            
    except ImportError:
        print("  [WARN] huggingface_hub not installed.")
        print("         Model will be downloaded on first use.")
        return True
    except Exception as e:
        print(f"  [ERROR] Download failed: {e}")
        print("          Model will be downloaded on first use.")
        return True


def setup():
    """初回セットアップを実行"""
    if is_model_downloaded():
        print("[OK] kotoba-whisper model already downloaded.")
        return True
    
    print("[INFO] kotoba-whisper model not found. Starting download...")
    return download_model()


if __name__ == "__main__":
    success = setup()
    sys.exit(0 if success else 1)

