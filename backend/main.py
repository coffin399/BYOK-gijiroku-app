"""
GIJIROKU Backend API
FastAPI server for speech recognition and speaker diarization
"""

import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional
import logging

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.transcription import TranscriptionService
from services.diarization import DiarizationService
from services.summarization import SummarizationService
from services.audio_capture import get_audio_capture_service, AudioDevice
from services.audio_sender import get_audio_sender_service

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="GIJIROKU API",
    description="音声認識・話者識別・議事録生成API",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# サービスのインスタンス化（遅延初期化）
transcription_service: Optional[TranscriptionService] = None
diarization_service: Optional[DiarizationService] = None
summarization_service: Optional[SummarizationService] = None


def get_transcription_service() -> TranscriptionService:
    global transcription_service
    if transcription_service is None:
        transcription_service = TranscriptionService()
    return transcription_service


def get_diarization_service() -> DiarizationService:
    global diarization_service
    if diarization_service is None:
        diarization_service = DiarizationService()
    return diarization_service


def get_summarization_service() -> SummarizationService:
    global summarization_service
    if summarization_service is None:
        summarization_service = SummarizationService()
    return summarization_service


# Request/Response Models
class TranscriptionRequest(BaseModel):
    language: str = "ja"
    model_size: str = "large-v3"  # tiny, base, small, medium, large-v3


class DiarizationRequest(BaseModel):
    min_speakers: int = 1
    max_speakers: int = 10


class SummarizationRequest(BaseModel):
    provider: str = "ollama"  # ollama, openai, gemini, anthropic
    model: str = "llama3.2"
    api_key: Optional[str] = None
    ollama_url: str = "http://localhost:11434"
    transcript: str
    speakers: list[dict]


class ProcessingStatus(BaseModel):
    status: str
    progress: int
    message: str
    result: Optional[dict] = None


# 処理状態を保存
processing_tasks: dict[str, ProcessingStatus] = {}


@app.get("/")
async def root():
    return {"message": "GIJIROKU API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "services": {
            "transcription": transcription_service is not None,
            "diarization": diarization_service is not None,
            "summarization": summarization_service is not None,
        }
    }


@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = "ja",
    hotwords: Optional[str] = None
):
    """
    音声ファイルを文字起こし（kotoba-whisper-v2.2-faster専用）
    
    Args:
        file: 音声ファイル
        language: 言語コード（デフォルト: ja）
        hotwords: ホットワード（カンマ区切り、例: "議事録,アクションアイテム"）
    """
    try:
        # 一時ファイルに保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            service = get_transcription_service()
            result = await service.transcribe(
                audio_path=tmp_path,
                language=language,
                hotwords=hotwords
            )
            return JSONResponse(content=result)
        finally:
            # 一時ファイルを削除
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transcribe/model-info")
async def get_transcription_model_info():
    """kotoba-whisperモデルの情報を取得"""
    service = get_transcription_service()
    return service.get_model_info()


@app.post("/api/diarize")
async def diarize_audio(
    file: UploadFile = File(...),
    min_speakers: int = 1,
    max_speakers: int = 10,
    hf_token: Optional[str] = None
):
    """
    音声ファイルの話者識別（pyannote.audio使用）
    """
    try:
        # 一時ファイルに保存
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            service = get_diarization_service()
            result = await service.diarize(
                audio_path=tmp_path,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
                hf_token=hf_token
            )
            return JSONResponse(content=result)
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Diarization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
async def process_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = "ja",
    model_size: str = "large-v3",
    min_speakers: int = 1,
    max_speakers: int = 10,
    hf_token: Optional[str] = None
):
    """
    音声ファイルを完全処理（文字起こし + 話者識別 + 結合）
    """
    task_id = str(uuid.uuid4())
    
    # 一時ファイルに保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    # 処理状態を初期化
    processing_tasks[task_id] = ProcessingStatus(
        status="processing",
        progress=0,
        message="処理を開始しています..."
    )

    # バックグラウンドで処理
    background_tasks.add_task(
        process_audio_task,
        task_id,
        tmp_path,
        language,
        model_size,
        min_speakers,
        max_speakers,
        hf_token
    )

    return {"task_id": task_id, "status": "processing"}


async def process_audio_task(
    task_id: str,
    audio_path: str,
    language: str,
    model_size: str,
    min_speakers: int,
    max_speakers: int,
    hf_token: Optional[str]
):
    """バックグラウンド処理タスク"""
    try:
        # Step 1: 文字起こし
        processing_tasks[task_id] = ProcessingStatus(
            status="processing",
            progress=20,
            message="音声を文字起こし中..."
        )
        
        transcription_svc = get_transcription_service()
        transcription_result = await transcription_svc.transcribe(
            audio_path=audio_path,
            language=language,
            model_size=model_size
        )

        # Step 2: 話者識別
        processing_tasks[task_id] = ProcessingStatus(
            status="processing",
            progress=50,
            message="話者を識別中..."
        )

        diarization_svc = get_diarization_service()
        diarization_result = await diarization_svc.diarize(
            audio_path=audio_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
            hf_token=hf_token
        )

        # Step 3: 結合
        processing_tasks[task_id] = ProcessingStatus(
            status="processing",
            progress=80,
            message="結果を統合中..."
        )

        # 文字起こしセグメントと話者情報を結合
        combined_result = combine_results(transcription_result, diarization_result)

        processing_tasks[task_id] = ProcessingStatus(
            status="completed",
            progress=100,
            message="処理が完了しました",
            result=combined_result
        )

    except Exception as e:
        logger.error(f"Processing error: {e}")
        processing_tasks[task_id] = ProcessingStatus(
            status="error",
            progress=0,
            message=str(e)
        )
    finally:
        # 一時ファイルを削除
        try:
            os.unlink(audio_path)
        except:
            pass


def combine_results(transcription: dict, diarization: dict) -> dict:
    """文字起こし結果と話者識別結果を結合"""
    segments = transcription.get("segments", [])
    speaker_segments = diarization.get("segments", [])
    speakers = diarization.get("speakers", [])

    combined_segments = []
    
    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]
        seg_text = seg["text"]
        
        # この時間範囲で最も長く話している話者を特定
        speaker_id = find_speaker_for_segment(seg_start, seg_end, speaker_segments)
        
        combined_segments.append({
            "start": seg_start,
            "end": seg_end,
            "text": seg_text,
            "speaker_id": speaker_id
        })

    return {
        "text": transcription.get("text", ""),
        "segments": combined_segments,
        "speakers": speakers,
        "language": transcription.get("language", "ja")
    }


def find_speaker_for_segment(start: float, end: float, speaker_segments: list) -> str:
    """セグメントの時間範囲で最も長く話している話者を特定"""
    speaker_durations = {}
    
    for ss in speaker_segments:
        ss_start = ss["start"]
        ss_end = ss["end"]
        speaker = ss["speaker"]
        
        # 重複部分を計算
        overlap_start = max(start, ss_start)
        overlap_end = min(end, ss_end)
        overlap = max(0, overlap_end - overlap_start)
        
        if overlap > 0:
            speaker_durations[speaker] = speaker_durations.get(speaker, 0) + overlap
    
    if speaker_durations:
        return max(speaker_durations, key=speaker_durations.get)
    return "SPEAKER_00"


@app.get("/api/process/{task_id}")
async def get_processing_status(task_id: str):
    """処理状態を取得"""
    if task_id not in processing_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return processing_tasks[task_id]


@app.post("/api/summarize")
async def summarize_transcript(request: SummarizationRequest):
    """議事録を要約（ローカルLLM対応）"""
    try:
        service = get_summarization_service()
        result = await service.summarize(
            transcript=request.transcript,
            speakers=request.speakers,
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
            ollama_url=request.ollama_url
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/models")
async def get_available_models():
    """利用可能なモデル一覧（kotoba-whisper専用）"""
    return {
        "whisper": [
            {
                "id": "kotoba-v2.2",
                "name": "Kotoba Whisper v2.2",
                "description": "日本語特化・超高速 (~10GB VRAM)",
                "model_id": "RoachLin/kotoba-whisper-v2.2-faster",
                "features": [
                    "CTranslate2最適化",
                    "日本語特化",
                    "ホットワード対応",
                    "VADフィルタリング",
                    "単語レベルタイムスタンプ"
                ],
                "recommended_settings": {
                    "chunk_length": 5,
                    "condition_on_previous_text": False,
                    "beam_size": 5,
                    "language": "ja"
                }
            }
        ],
        "diarization": [
            {"id": "pyannote/speaker-diarization-3.1", "name": "Speaker Diarization 3.1", "description": "最新版話者識別モデル"}
        ]
    }


# ============================================
# Model Download API
# ============================================

@app.get("/api/models/status")
async def get_model_status():
    """モデルのダウンロード状態を取得"""
    from pathlib import Path
    
    whisper_model_path = Path("./models/kotoba-whisper-v2.2-faster/model.bin")
    
    return {
        "whisper": {
            "id": "kotoba-v2.2",
            "name": "Kotoba Whisper v2.2",
            "downloaded": whisper_model_path.exists(),
            "path": str(whisper_model_path.parent),
            "size_gb": 10
        },
        "diarization": {
            "id": "pyannote/speaker-diarization-3.1",
            "name": "Speaker Diarization 3.1",
            "downloaded": True,  # pyannoteは初回使用時に自動ダウンロード
            "note": "初回使用時に自動ダウンロード（HFトークン必要）"
        }
    }


@app.post("/api/models/download/whisper")
async def download_whisper_model(background_tasks: BackgroundTasks):
    """kotoba-whisperモデルをダウンロード"""
    from pathlib import Path
    
    model_path = Path("./models/kotoba-whisper-v2.2-faster/model.bin")
    
    if model_path.exists():
        return {"status": "already_downloaded", "message": "モデルは既にダウンロード済みです"}
    
    # バックグラウンドでダウンロード
    background_tasks.add_task(download_whisper_model_task)
    
    return {"status": "downloading", "message": "ダウンロードを開始しました。完了までお待ちください（約10GB）"}


async def download_whisper_model_task():
    """kotoba-whisperモデルをダウンロード（バックグラウンドタスク）"""
    try:
        from huggingface_hub import snapshot_download
        from pathlib import Path
        
        model_dir = Path("./models/kotoba-whisper-v2.2-faster")
        
        logger.info("Starting kotoba-whisper model download...")
        snapshot_download(
            repo_id="RoachLin/kotoba-whisper-v2.2-faster",
            local_dir=model_dir,
            allow_patterns=["*.bin", "*.json"]
        )
        logger.info("kotoba-whisper model download complete!")
        
    except ImportError:
        logger.error("huggingface_hub not installed. Run: pip install huggingface_hub")
    except Exception as e:
        logger.error(f"Model download failed: {e}")


# ============================================
# Audio Capture API (Firefox/System Audio Fallback)
# ============================================

@app.get("/api/audio/capabilities")
async def get_audio_capabilities():
    """
    オーディオキャプチャの機能を取得
    WASAPI Loopback対応状況など
    """
    service = get_audio_capture_service()
    return service.get_capabilities()


@app.get("/api/audio/devices")
async def get_audio_devices():
    """
    利用可能なオーディオデバイス一覧を取得
    WASAPI Loopbackデバイス（直接システム音声キャプチャ）も含む
    """
    try:
        service = get_audio_capture_service()
        devices = service.get_available_devices()
        
        return {
            "devices": [
                {
                    "index": d.index,
                    "name": d.name,
                    "channels": d.channels,
                    "sample_rate": d.sample_rate,
                    "is_loopback": d.is_loopback,
                    "is_wasapi_loopback": d.is_wasapi_loopback,
                    "host_api": d.host_api
                }
                for d in devices
            ],
            "loopback_devices": [
                {
                    "index": d.index,
                    "name": d.name,
                    "channels": d.channels,
                    "sample_rate": d.sample_rate,
                    "is_wasapi_loopback": d.is_wasapi_loopback,
                    "host_api": d.host_api
                }
                for d in service.get_loopback_devices()
            ],
            "wasapi_loopback_devices": [
                {
                    "index": d.index,
                    "name": d.name,
                    "channels": d.channels,
                    "sample_rate": d.sample_rate,
                    "host_api": d.host_api
                }
                for d in service.get_wasapi_loopback_devices()
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get audio devices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/capture/start")
async def start_audio_capture(
    session_id: str,
    device_indices: str,  # comma-separated list: "0,1,2"
    sample_rate: int = 16000,
    channels: int = 1,
    use_wasapi_loopback: bool = False,
    network_port: Optional[int] = None
):
    """
    オーディオキャプチャを開始
    複数デバイスからの同時録音に対応
    
    Args:
        session_id: セッションID
        device_indices: デバイスインデックス（カンマ区切り）
        sample_rate: サンプルレート（デフォルト16000）
        channels: チャンネル数（デフォルト1=モノラル）
        use_wasapi_loopback: WASAPI Loopbackを使用（VB-Cable不要）
        network_port: ネットワーク経由で音声を受信するポート
    """
    try:
        indices = [int(i.strip()) for i in device_indices.split(",") if i.strip()]
        
        service = get_audio_capture_service()
        await service.start_capture(
            session_id=session_id,
            device_indices=indices,
            sample_rate=sample_rate,
            channels=channels,
            use_wasapi_loopback=use_wasapi_loopback,
            network_port=network_port
        )
        
        return {
            "status": "recording",
            "session_id": session_id,
            "devices": indices,
            "use_wasapi_loopback": use_wasapi_loopback,
            "network_port": network_port
        }
    except Exception as e:
        logger.error(f"Failed to start capture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/capture/stop")
async def stop_audio_capture(session_id: str):
    """
    オーディオキャプチャを停止してWAVデータを返す
    """
    try:
        service = get_audio_capture_service()
        wav_data = await service.stop_capture(session_id)
        
        if wav_data is None:
            raise HTTPException(status_code=404, detail="Session not found or no data")
        
        # Return as base64 for easy handling
        import base64
        return {
            "status": "stopped",
            "session_id": session_id,
            "audio_base64": base64.b64encode(wav_data).decode('utf-8'),
            "format": "wav",
            "size": len(wav_data)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop capture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audio/capture/status/{session_id}")
async def get_capture_status(session_id: str):
    """キャプチャセッションの状態を取得"""
    service = get_audio_capture_service()
    status = service.get_session_status(session_id)
    
    if status is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return status


# ============================================
# Network Audio Streaming API
# ============================================

@app.post("/api/audio/send/start")
async def start_audio_send(
    session_id: str,
    device_index: int,
    target_host: str,
    target_port: int,
    sample_rate: int = 16000,
    channels: int = 1,
    use_wasapi_loopback: bool = False
):
    """
    別PCへ音声を送信開始
    
    Args:
        session_id: セッションID
        device_index: 送信元デバイスインデックス
        target_host: 送信先PCのIPアドレス
        target_port: 送信先PCのポート
        sample_rate: サンプルレート
        channels: チャンネル数
        use_wasapi_loopback: WASAPI Loopbackを使用
    """
    try:
        service = get_audio_sender_service()
        await service.start_sending(
            session_id=session_id,
            device_index=device_index,
            target_host=target_host,
            target_port=target_port,
            sample_rate=sample_rate,
            channels=channels,
            use_wasapi_loopback=use_wasapi_loopback
        )
        
        return {
            "status": "sending",
            "session_id": session_id,
            "target": f"{target_host}:{target_port}"
        }
    except Exception as e:
        logger.error(f"Failed to start audio send: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/send/stop")
async def stop_audio_send(session_id: str):
    """音声送信を停止"""
    try:
        service = get_audio_sender_service()
        result = await service.stop_sending(session_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"status": "stopped", "session_id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop audio send: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audio/send/status/{session_id}")
async def get_send_status(session_id: str):
    """音声送信セッションの状態を取得"""
    service = get_audio_sender_service()
    status = service.get_session_status(session_id)
    
    if status is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return status


@app.get("/api/network/info")
async def get_network_info():
    """このPCのネットワーク情報を取得（他PCからの接続用）"""
    import socket
    
    hostname = socket.gethostname()
    
    # Get all IP addresses
    ips = []
    try:
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            if not ip.startswith('127.') and ':' not in ip:  # IPv4 only, no localhost
                if ip not in ips:
                    ips.append(ip)
    except:
        pass
    
    # Fallback
    if not ips:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ips = [s.getsockname()[0]]
            s.close()
        except:
            ips = ["127.0.0.1"]
    
    return {
        "hostname": hostname,
        "ip_addresses": ips,
        "default_port": 9999,
        "connection_string": f"{ips[0]}:9999" if ips else "127.0.0.1:9999"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

