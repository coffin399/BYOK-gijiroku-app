"""
Transcription Service using faster-whisper
Supports kotoba-whisper for Japanese
"""

import asyncio
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# モデルキャッシュ
_whisper_models = {}


class TranscriptionService:
    def __init__(self):
        self.device = "cuda"  # or "cpu"
        self.compute_type = "float16"  # or "int8" for CPU
        
    def _get_model(self, model_size: str):
        """モデルを取得（キャッシュ付き）"""
        if model_size not in _whisper_models:
            try:
                from faster_whisper import WhisperModel
                
                # kotoba-whisperの場合 (from: https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster)
                if model_size == "kotoba-v2.2":
                    model_id = "RoachLin/kotoba-whisper-v2.2-faster"
                else:
                    model_id = model_size
                
                logger.info(f"Loading Whisper model: {model_id}")
                
                # CUDAが利用可能か確認
                try:
                    import torch
                    if torch.cuda.is_available():
                        device = "cuda"
                        compute_type = "float16"
                    else:
                        device = "cpu"
                        compute_type = "int8"
                except:
                    device = "cpu"
                    compute_type = "int8"
                
                _whisper_models[model_size] = WhisperModel(
                    model_id,
                    device=device,
                    compute_type=compute_type
                )
                logger.info(f"Whisper model loaded on {device}")
                
            except Exception as e:
                logger.error(f"Failed to load Whisper model: {e}")
                raise
                
        return _whisper_models[model_size]

    async def transcribe(
        self,
        audio_path: str,
        language: str = "ja",
        model_size: str = "large-v3"
    ) -> dict:
        """
        音声ファイルを文字起こし
        
        Args:
            audio_path: 音声ファイルのパス
            language: 言語コード (ja, en, etc.)
            model_size: モデルサイズ (tiny, base, small, medium, large-v3, kotoba-v2.2)
        
        Returns:
            文字起こし結果
        """
        try:
            # 同期処理を非同期で実行
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._transcribe_sync,
                audio_path,
                language,
                model_size
            )
            return result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    def _transcribe_sync(
        self,
        audio_path: str,
        language: str,
        model_size: str
    ) -> dict:
        """同期的な文字起こし処理"""
        model = self._get_model(model_size)
        
        # 文字起こし実行
        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=400
            ),
            word_timestamps=True
        )
        
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
        
        return {
            "text": full_text.strip(),
            "segments": result_segments,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration
        }


# Alternative: Browser-compatible API using transformers.js
class BrowserTranscriptionService:
    """ブラウザ用のフォールバック（WebSocket経由で使用）"""
    
    async def transcribe_stream(self, audio_chunks, language: str = "ja"):
        """ストリーミング文字起こし"""
        # 実装予定
        pass

