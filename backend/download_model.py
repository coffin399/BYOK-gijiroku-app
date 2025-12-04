#!/usr/bin/env python3
"""
kotoba-whisper-v2.2-faster モデルダウンロードスクリプト

Usage:
    python download_model.py

モデルは ./models/kotoba-whisper-v2.2-faster/ にダウンロードされます。
ダウンロード済みの場合は、HuggingFaceからの再ダウンロードをスキップして
ローカルモデルを使用します。
"""

import os
import sys
from pathlib import Path

# モデル設定
MODEL_ID = "RoachLin/kotoba-whisper-v2.2-faster"
LOCAL_PATH = "./models/kotoba-whisper-v2.2-faster"


def download_kotoba_whisper():
    """kotoba-whisper-v2.2-fasterをダウンロード"""
    from huggingface_hub import snapshot_download
    
    local_path = Path(LOCAL_PATH)
    
    # 既にダウンロード済みかチェック
    if local_path.exists() and (local_path / "model.bin").exists():
        print(f"✓ Model already exists at {local_path}")
        print("  To re-download, delete the folder and run again.")
        return str(local_path)
    
    local_path.mkdir(parents=True, exist_ok=True)
    
    print(f"Downloading {MODEL_ID}...")
    print(f"Destination: {local_path.absolute()}")
    print()
    print("This may take a while (~10GB)...")
    print()
    
    try:
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=str(local_path),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        
        print()
        print("=" * 50)
        print("✓ Download complete!")
        print(f"  Model saved to: {local_path.absolute()}")
        print()
        print("Files downloaded:")
        for f in local_path.iterdir():
            size = f.stat().st_size / (1024 * 1024)  # MB
            print(f"  - {f.name} ({size:.1f} MB)")
        print("=" * 50)
        
        return str(local_path)
        
    except Exception as e:
        print(f"✗ Download failed: {e}")
        sys.exit(1)


def verify_model():
    """ダウンロードしたモデルを検証"""
    local_path = Path(LOCAL_PATH)
    
    required_files = [
        "model.bin",
        "config.json",
        "tokenizer.json",
        "vocabulary.json",  # または vocab.json
    ]
    
    print("\nVerifying model files...")
    
    all_ok = True
    for filename in required_files:
        filepath = local_path / filename
        # vocabulary.json または vocab.json のどちらか
        if filename == "vocabulary.json" and not filepath.exists():
            filepath = local_path / "vocab.json"
        
        if filepath.exists():
            size = filepath.stat().st_size / (1024 * 1024)
            print(f"  ✓ {filepath.name} ({size:.1f} MB)")
        else:
            # preprocessor_config.json等はオプション
            if filename in ["model.bin", "config.json", "tokenizer.json"]:
                print(f"  ✗ {filename} - MISSING")
                all_ok = False
            else:
                print(f"  - {filename} - optional, not found")
    
    if all_ok:
        print("\n✓ Model verification passed!")
    else:
        print("\n✗ Model verification failed. Some required files are missing.")
        sys.exit(1)


def test_model():
    """モデルをテストロード"""
    print("\nTesting model load...")
    
    try:
        from faster_whisper import WhisperModel
        import torch
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        
        print(f"  Device: {device}")
        print(f"  Compute type: {compute_type}")
        
        model = WhisperModel(
            LOCAL_PATH,
            device=device,
            compute_type=compute_type,
            local_files_only=True
        )
        
        print("  ✓ Model loaded successfully!")
        
        # クリーンアップ
        del model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    except Exception as e:
        print(f"  ✗ Model load failed: {e}")
        print("  This might be okay if you don't have GPU/CUDA installed.")


if __name__ == "__main__":
    print("=" * 50)
    print("kotoba-whisper-v2.2-faster Model Downloader")
    print("=" * 50)
    print()
    print(f"Model: {MODEL_ID}")
    print(f"Source: https://huggingface.co/{MODEL_ID}")
    print()
    
    download_kotoba_whisper()
    verify_model()
    
    # オプション: テストロード
    if "--test" in sys.argv:
        test_model()
    else:
        print("\nRun with --test to verify model loading.")
    
    print("\nDone!")



