"""
Transcription Service using faster-whisper
Optimized for kotoba-whisper-v2.2-faster (Japanese specialized model)
https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster
"""

import asyncio
import logging
import os
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# モデルキャッシュ
_whisper_model = None

# kotoba-whisper-v2.2-faster 専用設定
KOTOBA_MODEL_ID = "RoachLin/kotoba-whisper-v2.2-faster"
KOTOBA_LOCAL_PATH = "./models/kotoba-whisper-v2.2-faster"


class TranscriptionService:
    """
    kotoba-whisper-v2.2-faster 専用の文字起こしサービス
    
    特徴:
    - 日本語に特化した高精度モデル
    - CTranslate2ベースで高速推論
    - chunk_length=5 で最適化
    - hotwordsによるカスタマイズ対応
    """
    
    def __init__(self):
        self.device = "cuda"
        self.compute_type = "float16"
        self.model_path = None
        
    def _get_model(self):
        """kotoba-whisper-v2.2-fasterモデルを取得（キャッシュ付き）"""
        global _whisper_model
        
        if _whisper_model is not None:
            return _whisper_model
            
        try:
            from faster_whisper import WhisperModel
            
            # ローカルにモデルがあればそれを使用
            local_path = Path(KOTOBA_LOCAL_PATH)
            if local_path.exists() and (local_path / "model.bin").exists():
                model_path = str(local_path)
                logger.info(f"Loading kotoba-whisper from local: {model_path}")
            else:
                # ローカルにない場合は自動ダウンロード
                logger.info(f"Model not found locally. Downloading from HuggingFace: {KOTOBA_MODEL_ID}")
                logger.info("This is a one-time download (~10GB). Please wait...")
                model_path = KOTOBA_MODEL_ID
            
            self.model_path = model_path
            
            # CUDAが利用可能か確認
            try:
                import torch
                if torch.cuda.is_available():
                    device = "cuda"
                    # float16が最適（元モデルがfloat32で変換されているため）
                    compute_type = "float16"
                    logger.info(f"CUDA available: {torch.cuda.get_device_name(0)}")
                else:
                    device = "cpu"
                    compute_type = "int8"
                    logger.info("CUDA not available, using CPU with int8")
            except ImportError:
                device = "cpu"
                compute_type = "int8"
                logger.info("PyTorch not found, using CPU with int8")
            
            self.device = device
            self.compute_type = compute_type
            
            _whisper_model = WhisperModel(
                model_path,
                device=device,
                compute_type=compute_type,
                # ローカルファイルの場合のみlocal_files_only=True
                local_files_only=local_path.exists()
            )
            
            logger.info(f"kotoba-whisper-v2.2-faster loaded on {device} ({compute_type})")
            return _whisper_model
            
        except Exception as e:
            logger.error(f"Failed to load kotoba-whisper model: {e}")
            raise

    async def transcribe(
        self,
        audio_path: str,
        language: str = "ja",
        hotwords: Optional[str] = None,
        **kwargs  # model_sizeは無視（後方互換性のため受け取る）
    ) -> dict:
        """
        音声ファイルを文字起こし（kotoba-whisper-v2.2-faster専用）
        
        Args:
            audio_path: 音声ファイルのパス
            language: 言語コード (デフォルト: ja)
            hotwords: ホットワード（認識精度向上用、例: "ノイミー,固有名詞"）
        
        Returns:
            文字起こし結果
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._transcribe_sync,
                audio_path,
                language,
                hotwords
            )
            return result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    def _transcribe_sync(
        self,
        audio_path: str,
        language: str,
        hotwords: Optional[str] = None
    ) -> dict:
        """
        同期的な文字起こし処理
        
        kotoba-whisper-v2.2-faster の推奨設定:
        - chunk_length=5: 5秒ごとにチャンク分割（推奨）
        - condition_on_previous_text=False: 前のテキストに依存しない（推奨）
        - language="ja": 日本語固定
        - hotwords: 固有名詞等の認識精度向上
        """
        model = self._get_model()
        
        # kotoba-whisper-v2.2-faster 最適化パラメータ
        transcribe_options = {
            "language": language,
            "chunk_length": 5,  # 推奨値
            "condition_on_previous_text": False,  # 推奨値
            "beam_size": 5,
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 400,
            },
            "word_timestamps": True,
        }
        
        # ホットワードが指定されている場合
        if hotwords:
            transcribe_options["hotwords"] = hotwords
            logger.info(f"Using hotwords: {hotwords}")
        
        logger.info(f"Transcribing: {audio_path}")
        segments, info = model.transcribe(audio_path, **transcribe_options)
        
        # 結果を整形
        result_segments = []
        full_text = ""
        
        for segment in segments:
            seg_dict = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
            }
            
            # 単語レベルのタイムスタンプ
            if segment.words:
                seg_dict["words"] = [
                    {
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                        "probability": word.probability
                    }
                    for word in segment.words
                ]
            
            result_segments.append(seg_dict)
            full_text += segment.text
        
        logger.info(f"Transcription complete: {len(result_segments)} segments, {len(full_text)} chars")
        
        return {
            "text": full_text.strip(),
            "segments": result_segments,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
            "model": "kotoba-whisper-v2.2-faster"
        }

    def get_model_info(self) -> dict:
        """モデル情報を取得"""
        return {
            "model_id": KOTOBA_MODEL_ID,
            "model_path": self.model_path,
            "device": self.device,
            "compute_type": self.compute_type,
            "is_loaded": _whisper_model is not None,
            "features": [
                "Japanese specialized",
                "CTranslate2 optimized",
                "Word-level timestamps",
                "Hotwords support",
                "VAD filtering"
            ]
        }


def download_model():
    """
    kotoba-whisper-v2.2-fasterをローカルにダウンロード
    
    Usage:
        python -c "from services.transcription import download_model; download_model()"
    """
    from huggingface_hub import snapshot_download
    
    local_path = Path(KOTOBA_LOCAL_PATH)
    local_path.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Downloading {KOTOBA_MODEL_ID} to {local_path}...")
    
    snapshot_download(
        repo_id=KOTOBA_MODEL_ID,
        local_dir=str(local_path),
        local_dir_use_symlinks=False
    )
    
    logger.info("Download complete!")
    return str(local_path)
