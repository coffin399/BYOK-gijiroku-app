"""
Speaker Diarization Service using pyannote.audio
"""

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# モデルキャッシュ
_diarization_pipeline = None


class DiarizationService:
    def __init__(self):
        self.device = "cuda"  # or "cpu"
        
    def _get_pipeline(self, hf_token: Optional[str] = None):
        """パイプラインを取得（キャッシュ付き）"""
        global _diarization_pipeline
        
        if _diarization_pipeline is None:
            try:
                from pyannote.audio import Pipeline
                import torch
                
                # HuggingFaceトークンを取得
                token = hf_token or os.environ.get("HF_TOKEN")
                
                if not token:
                    raise ValueError(
                        "pyannote.audioにはHugging Faceトークンが必要です。\n"
                        "1. https://huggingface.co/pyannote/speaker-diarization-3.1 でライセンスに同意\n"
                        "2. https://huggingface.co/settings/tokens でトークンを取得\n"
                        "3. 環境変数 HF_TOKEN に設定するか、APIリクエストで渡してください"
                    )
                
                logger.info("Loading pyannote speaker diarization pipeline...")
                
                # デバイスを確認
                if torch.cuda.is_available():
                    device = torch.device("cuda")
                else:
                    device = torch.device("cpu")
                    logger.warning("CUDA not available, using CPU (slower)")
                
                _diarization_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=token
                )
                _diarization_pipeline.to(device)
                
                logger.info(f"Diarization pipeline loaded on {device}")
                
            except Exception as e:
                logger.error(f"Failed to load diarization pipeline: {e}")
                raise
                
        return _diarization_pipeline

    async def diarize(
        self,
        audio_path: str,
        min_speakers: int = 1,
        max_speakers: int = 10,
        hf_token: Optional[str] = None
    ) -> dict:
        """
        音声ファイルの話者識別
        
        Args:
            audio_path: 音声ファイルのパス
            min_speakers: 最小話者数
            max_speakers: 最大話者数
            hf_token: Hugging Face API token
        
        Returns:
            話者識別結果
        """
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._diarize_sync,
                audio_path,
                min_speakers,
                max_speakers,
                hf_token
            )
            return result
            
        except Exception as e:
            logger.error(f"Diarization failed: {e}")
            raise

    def _diarize_sync(
        self,
        audio_path: str,
        min_speakers: int,
        max_speakers: int,
        hf_token: Optional[str]
    ) -> dict:
        """同期的な話者識別処理"""
        pipeline = self._get_pipeline(hf_token)
        
        # 話者識別実行
        diarization = pipeline(
            audio_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        # 結果を整形
        segments = []
        speakers_set = set()
        
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })
            speakers_set.add(speaker)
        
        # 話者情報を生成
        speaker_colors = [
            "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B",
            "#EF4444", "#EC4899", "#06B6D4", "#84CC16"
        ]
        
        speakers = []
        for i, speaker_id in enumerate(sorted(speakers_set)):
            speakers.append({
                "id": speaker_id,
                "name": f"話者{i + 1}",
                "color": speaker_colors[i % len(speaker_colors)]
            })
        
        return {
            "segments": segments,
            "speakers": speakers,
            "num_speakers": len(speakers)
        }


class SimpleDiarizationService:
    """
    pyannote.audioが使えない場合のフォールバック
    音声のエネルギーベースで話者を推定
    """
    
    async def diarize(
        self,
        audio_path: str,
        min_speakers: int = 1,
        max_speakers: int = 10,
        **kwargs
    ) -> dict:
        """シンプルな話者識別（VADベース）"""
        try:
            import librosa
            import numpy as np
            from scipy.ndimage import uniform_filter1d
            
            # 音声を読み込み
            y, sr = librosa.load(audio_path, sr=16000)
            
            # 短時間エネルギーを計算
            frame_length = int(0.025 * sr)  # 25ms
            hop_length = int(0.010 * sr)    # 10ms
            
            energy = librosa.feature.rms(
                y=y,
                frame_length=frame_length,
                hop_length=hop_length
            )[0]
            
            # スムージング
            energy_smooth = uniform_filter1d(energy, size=10)
            
            # 閾値で音声区間を検出
            threshold = np.mean(energy_smooth) * 0.5
            is_speech = energy_smooth > threshold
            
            # セグメントに変換
            segments = []
            in_speech = False
            start_frame = 0
            
            for i, is_s in enumerate(is_speech):
                if is_s and not in_speech:
                    start_frame = i
                    in_speech = True
                elif not is_s and in_speech:
                    start_time = start_frame * hop_length / sr
                    end_time = i * hop_length / sr
                    if end_time - start_time > 0.5:  # 0.5秒以上
                        segments.append({
                            "start": start_time,
                            "end": end_time,
                            "speaker": "SPEAKER_00"
                        })
                    in_speech = False
            
            # 最後のセグメント
            if in_speech:
                start_time = start_frame * hop_length / sr
                end_time = len(is_speech) * hop_length / sr
                if end_time - start_time > 0.5:
                    segments.append({
                        "start": start_time,
                        "end": end_time,
                        "speaker": "SPEAKER_00"
                    })
            
            return {
                "segments": segments,
                "speakers": [{"id": "SPEAKER_00", "name": "話者1", "color": "#8B5CF6"}],
                "num_speakers": 1,
                "note": "簡易話者識別（pyannote.audio未使用）"
            }
            
        except Exception as e:
            logger.error(f"Simple diarization failed: {e}")
            # 最小限の結果を返す
            return {
                "segments": [],
                "speakers": [{"id": "SPEAKER_00", "name": "話者1", "color": "#8B5CF6"}],
                "num_speakers": 1,
                "error": str(e)
            }

