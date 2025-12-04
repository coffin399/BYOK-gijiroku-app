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
    model_size: str = "large-v3"
):
    """
    音声ファイルを文字起こし（faster-whisper使用）
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
                model_size=model_size
            )
            return JSONResponse(content=result)
        finally:
            # 一時ファイルを削除
            os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    """利用可能なモデル一覧"""
    return {
        "whisper": [
            {"id": "tiny", "name": "Tiny", "description": "最速・低精度 (~1GB VRAM)"},
            {"id": "base", "name": "Base", "description": "高速・低精度 (~1GB VRAM)"},
            {"id": "small", "name": "Small", "description": "バランス型 (~2GB VRAM)"},
            {"id": "medium", "name": "Medium", "description": "高精度 (~5GB VRAM)"},
            {"id": "large-v3", "name": "Large-v3", "description": "最高精度 (~10GB VRAM)"},
            {"id": "large-v3-turbo", "name": "Large-v3 Turbo", "description": "高速+高精度"},
        ],
        "diarization": [
            {"id": "pyannote/speaker-diarization-3.1", "name": "Speaker Diarization 3.1", "description": "最新版話者識別モデル"}
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

