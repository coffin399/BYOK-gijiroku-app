"""
Prompt Loader - Load prompts from YAML configuration
"""

import os
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Cache for loaded prompts
_prompts_cache: Optional[dict] = None
_prompts_mtime: float = 0


def get_prompts_path() -> Path:
    """Get the path to prompts.yaml"""
    # Check in backend directory first
    backend_path = Path(__file__).parent.parent / "prompts.yaml"
    if backend_path.exists():
        return backend_path
    
    # Check in project root
    root_path = Path(__file__).parent.parent.parent / "prompts.yaml"
    if root_path.exists():
        return root_path
    
    return backend_path  # Return default path


def load_prompts(force_reload: bool = False) -> dict:
    """
    Load prompts from YAML file with caching
    
    Args:
        force_reload: Force reload even if cached
    
    Returns:
        Dictionary of prompts
    """
    global _prompts_cache, _prompts_mtime
    
    prompts_path = get_prompts_path()
    
    # Check if file has been modified
    try:
        current_mtime = os.path.getmtime(prompts_path)
    except OSError:
        current_mtime = 0
    
    # Return cached if not modified
    if not force_reload and _prompts_cache is not None and current_mtime <= _prompts_mtime:
        return _prompts_cache
    
    # Load prompts
    try:
        import yaml
        
        with open(prompts_path, 'r', encoding='utf-8') as f:
            prompts = yaml.safe_load(f)
        
        _prompts_cache = prompts
        _prompts_mtime = current_mtime
        logger.info(f"Loaded prompts from {prompts_path}")
        
        return prompts
        
    except FileNotFoundError:
        logger.warning(f"Prompts file not found: {prompts_path}")
        return get_default_prompts()
    except Exception as e:
        logger.error(f"Failed to load prompts: {e}")
        return get_default_prompts()


def get_default_prompts() -> dict:
    """Return default prompts if YAML file is not available"""
    return {
        "system": {
            "role": "あなたは議事録作成のエキスパートです。会議の内容を正確に分析し、構造化された議事録を作成してください。必ずJSON形式で回答してください。"
        },
        "speaker_diarization": {
            "prompt": """以下の文字起こしテキストを分析し、話者を識別してください。

## 出力形式（JSON）
{
  "speakers": [
    { "id": "speaker_1", "estimatedName": "話者1" }
  ],
  "segments": [
    { "speakerId": "speaker_1", "text": "発言内容", "startTime": 0, "endTime": 10 }
  ]
}

## 文字起こしテキスト
{transcript}"""
        },
        "meeting_summary": {
            "prompt": """以下の会議の文字起こしを分析し、議事録を作成してください。

## 出力形式（JSON）
{
  "title": "会議のタイトル",
  "summary": "概要",
  "keyPoints": [],
  "actionItems": [],
  "decisions": []
}

## 話者情報
{speakers}

## 文字起こし
{transcript}"""
        }
    }


def get_system_prompt() -> str:
    """Get the system prompt"""
    prompts = load_prompts()
    return prompts.get("system", {}).get("role", "")


def get_speaker_diarization_prompt(transcript: str) -> str:
    """Get the speaker diarization prompt with transcript filled in"""
    prompts = load_prompts()
    prompt_template = prompts.get("speaker_diarization", {}).get("prompt", "")
    return prompt_template.replace("{transcript}", transcript)


def get_meeting_summary_prompt(transcript: str, speakers: str) -> str:
    """Get the meeting summary prompt with data filled in"""
    prompts = load_prompts()
    prompt_template = prompts.get("meeting_summary", {}).get("prompt", "")
    return prompt_template.replace("{transcript}", transcript).replace("{speakers}", speakers)


def get_custom_prompt(name: str) -> Optional[str]:
    """Get a custom prompt by name"""
    prompts = load_prompts()
    return prompts.get("custom", {}).get(name)

