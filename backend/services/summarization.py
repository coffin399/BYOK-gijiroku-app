"""
Summarization Service for meeting minutes
Supports multiple LLM providers including local models
"""

import asyncio
import json
import logging
from typing import Optional
import httpx

from .prompt_loader import get_system_prompt, get_meeting_summary_prompt, load_prompts

logger = logging.getLogger(__name__)


class SummarizationService:
    def __init__(self):
        pass

    async def summarize(
        self,
        transcript: str,
        speakers: list[dict],
        provider: str = "ollama",
        model: str = "llama3.2",
        api_key: Optional[str] = None,
        ollama_url: str = "http://localhost:11434"
    ) -> dict:
        """
        文字起こしを要約して議事録を生成
        
        Args:
            transcript: 文字起こしテキスト
            speakers: 話者情報のリスト
            provider: LLMプロバイダー (ollama, openai, gemini, anthropic)
            model: モデル名
            api_key: APIキー（クラウドプロバイダー用）
            ollama_url: OllamaのURL
        
        Returns:
            議事録データ
        """
        # スピーカー情報を整形
        speakers_text = "\n".join([
            f"- {s.get('id', 'unknown')}: {s.get('name', '不明')}"
            for s in speakers
        ])
        
        # Load prompt from YAML
        prompt = get_meeting_summary_prompt(transcript, speakers_text)
        system_prompt = get_system_prompt()
        
        try:
            if provider == "ollama":
                result = await self._summarize_with_ollama(prompt, model, ollama_url)
            elif provider == "openai":
                result = await self._summarize_with_openai(prompt, model, api_key)
            elif provider == "gemini":
                result = await self._summarize_with_gemini(prompt, model, api_key)
            elif provider == "anthropic":
                result = await self._summarize_with_anthropic(prompt, model, api_key)
            else:
                raise ValueError(f"Unknown provider: {provider}")
            
            return result
            
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            # フォールバック
            return {
                "title": "会議議事録",
                "summary": transcript[:300] + "..." if len(transcript) > 300 else transcript,
                "keyPoints": [],
                "actionItems": [],
                "decisions": [],
                "error": str(e)
            }

    async def _summarize_with_ollama(
        self,
        prompt: str,
        model: str,
        ollama_url: str
    ) -> dict:
        """Ollamaで要約"""
        system_prompt = get_system_prompt()
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": f"{system_prompt}\n\n{prompt}",
                    "stream": False,
                    "format": "json"
                }
            )
            response.raise_for_status()
            
            data = response.json()
            result_text = data.get("response", "{}")
            
            return self._parse_json_response(result_text)

    async def _summarize_with_openai(
        self,
        prompt: str,
        model: str,
        api_key: str
    ) -> dict:
        """OpenAIで要約"""
        from openai import AsyncOpenAI
        
        system_prompt = get_system_prompt()
        client = AsyncOpenAI(api_key=api_key)
        
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        result_text = response.choices[0].message.content
        return self._parse_json_response(result_text)

    async def _summarize_with_gemini(
        self,
        prompt: str,
        model: str,
        api_key: str
    ) -> dict:
        """Geminiで要約"""
        import google.generativeai as genai
        
        system_prompt = get_system_prompt()
        genai.configure(api_key=api_key)
        
        gemini_model = genai.GenerativeModel(
            model,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.3
            )
        )
        
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: gemini_model.generate_content(f"{system_prompt}\n\n{prompt}")
        )
        
        return self._parse_json_response(response.text)

    async def _summarize_with_anthropic(
        self,
        prompt: str,
        model: str,
        api_key: str
    ) -> dict:
        """Anthropicで要約"""
        from anthropic import AsyncAnthropic
        
        system_prompt = get_system_prompt()
        client = AsyncAnthropic(api_key=api_key)
        
        response = await client.messages.create(
            model=model,
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        result_text = response.content[0].text
        return self._parse_json_response(result_text)

    def _parse_json_response(self, text: str) -> dict:
        """JSONレスポンスをパース"""
        try:
            # JSONブロックを抽出
            if "```json" in text:
                start = text.find("```json") + 7
                end = text.find("```", start)
                text = text[start:end].strip()
            elif "```" in text:
                start = text.find("```") + 3
                end = text.find("```", start)
                text = text[start:end].strip()
            
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON: {e}")
            # テキストから情報を抽出する試み
            return {
                "title": "会議議事録",
                "summary": text[:500] if len(text) > 500 else text,
                "keyPoints": [],
                "actionItems": [],
                "decisions": [],
                "raw_response": text
            }

