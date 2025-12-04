import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { AIProvider, Transcript, TranscriptSegment, Speaker, MeetingMinutes, LocalLLMSettings } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { SPEAKER_COLORS } from './constants';

// OpenAI Client Factory
function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

// Gemini Client Factory (新SDK)
function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// 注意: 音声認識はバックエンドのkotoba-whisper（ローカル動作）で行います
// Hugging Face APIは不要になりました

// Speaker Diarization prompt
const SPEAKER_DIARIZATION_PROMPT = `
以下の文字起こしテキストを分析し、話者を識別してください。
各発言を話者ごとに分類し、以下のJSON形式で返してください。

{
  "speakers": [
    { "id": "speaker_1", "estimatedName": "話者1の推定名または役割" },
    { "id": "speaker_2", "estimatedName": "話者2の推定名または役割" }
  ],
  "segments": [
    { "speakerId": "speaker_1", "text": "発言内容", "startTime": 0, "endTime": 10 },
    { "speakerId": "speaker_2", "text": "発言内容", "startTime": 10, "endTime": 20 }
  ]
}

話者の識別には以下の手がかりを使用してください：
- 発言の内容や口調
- 質問と回答のパターン
- 専門用語の使用
- 発言の文脈

文字起こしテキスト:
`;

// Meeting summary prompt
const MEETING_SUMMARY_PROMPT = `
以下の会議の文字起こしを分析し、議事録を作成してください。
JSON形式で以下の構造で返してください：

{
  "title": "会議のタイトル（内容から推測）",
  "summary": "会議の概要（200-300文字）",
  "keyPoints": ["重要なポイント1", "重要なポイント2", ...],
  "actionItems": [
    { "description": "アクション内容", "assignee": "担当者（わかれば）" }
  ],
  "decisions": ["決定事項1", "決定事項2", ...]
}

文字起こしテキスト:
`;

// Process with OpenAI
async function processWithOpenAI(
  prompt: string,
  content: string,
  apiKey: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const openai = createOpenAIClient(apiKey);
  
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'あなたは議事録作成のエキスパートです。正確で構造化されたJSON出力を提供してください。' },
      { role: 'user', content: prompt + content },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '{}';
}

// Process with Gemini (新SDK)
async function processWithGemini(
  prompt: string,
  content: string,
  apiKey: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  const genAI = createGeminiClient(apiKey);
  
  const response = await genAI.models.generateContent({
    model,
    contents: prompt + content,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  return response.text || '{}';
}

// Process with Ollama (ローカルLLM)
async function processWithOllama(
  prompt: string,
  content: string,
  settings: LocalLLMSettings
): Promise<string> {
  const response = await fetch(`${settings.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.ollamaModel,
      prompt: `${prompt}${content}\n\nJSON形式で回答してください。`,
      stream: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response || '{}';
}

// Process with KoboldCpp (ローカルLLM)
async function processWithKoboldCpp(
  prompt: string,
  content: string,
  settings: LocalLLMSettings
): Promise<string> {
  const response = await fetch(`${settings.koboldcppUrl}/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${prompt}${content}\n\nJSON形式で回答してください。`,
      max_length: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`KoboldCpp API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results?.[0]?.text || '{}';
}

// Generic process function
export async function processWithLLM(
  prompt: string,
  content: string,
  provider: AIProvider,
  apiKey: string,
  model: string,
  localLLM?: LocalLLMSettings
): Promise<string> {
  switch (provider) {
    case 'openai':
      return processWithOpenAI(prompt, content, apiKey, model);
    case 'gemini':
      return processWithGemini(prompt, content, apiKey, model);
    case 'ollama':
      if (!localLLM) throw new Error('Ollama設定が必要です');
      return processWithOllama(prompt, content, localLLM);
    case 'koboldcpp':
      if (!localLLM) throw new Error('KoboldCpp設定が必要です');
      return processWithKoboldCpp(prompt, content, localLLM);
    default:
      throw new Error(`未対応のプロバイダー: ${provider}`);
  }
}

// Perform speaker diarization
export async function performSpeakerDiarization(
  transcriptText: string,
  segments: Array<{ start: number; end: number; text: string }>,
  provider: AIProvider,
  apiKey: string,
  model: string,
  localLLM?: LocalLLMSettings
): Promise<Transcript> {
  try {
    const result = await processWithLLM(
      SPEAKER_DIARIZATION_PROMPT,
      transcriptText,
      provider,
      apiKey,
      model,
      localLLM
    );

    const parsed = JSON.parse(result);
    const speakers: Speaker[] = parsed.speakers.map((s: { id: string; estimatedName: string }, idx: number) => ({
      id: s.id,
      name: s.estimatedName || `話者${idx + 1}`,
      color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
    }));

    const transcriptSegments: TranscriptSegment[] = parsed.segments.map((seg: { speakerId: string; text: string; startTime: number; endTime: number }) => ({
      id: uuidv4(),
      speakerId: seg.speakerId,
      text: seg.text,
      startTime: seg.startTime,
      endTime: seg.endTime,
      confidence: 0.85,
    }));

    return {
      id: uuidv4(),
      speakers,
      segments: transcriptSegments,
      rawText: transcriptText,
    };
  } catch {
    // Fallback: single speaker
    const speaker: Speaker = {
      id: 'speaker_1',
      name: '話者1',
      color: SPEAKER_COLORS[0],
    };
    
    return {
      id: uuidv4(),
      speakers: [speaker],
      segments: segments.length > 0 
        ? segments.map((seg) => ({
            id: uuidv4(),
            speakerId: speaker.id,
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end,
            confidence: 0.9,
          }))
        : [{
            id: uuidv4(),
            speakerId: speaker.id,
            text: transcriptText,
            startTime: 0,
            endTime: 0,
            confidence: 0.9,
          }],
      rawText: transcriptText,
    };
  }
}

// Generate meeting summary
export async function generateMeetingSummary(
  transcript: Transcript,
  provider: AIProvider,
  apiKey: string,
  model: string,
  localLLM?: LocalLLMSettings
): Promise<Partial<MeetingMinutes>> {
  const formattedTranscript = transcript.segments
    .map((seg) => {
      const speaker = transcript.speakers.find((s) => s.id === seg.speakerId);
      return `[${speaker?.name || '不明'}]: ${seg.text}`;
    })
    .join('\n');

  try {
    const result = await processWithLLM(
      MEETING_SUMMARY_PROMPT,
      formattedTranscript,
      provider,
      apiKey,
      model,
      localLLM
    );

    const parsed = JSON.parse(result);
    return {
      title: parsed.title || '会議議事録',
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      actionItems: (parsed.actionItems || []).map((item: { description: string; assignee?: string }) => ({
        id: uuidv4(),
        description: item.description,
        assignee: item.assignee,
        completed: false,
      })),
      decisions: parsed.decisions || [],
    };
  } catch {
    return {
      title: '会議議事録',
      summary: transcript.rawText.slice(0, 300) + '...',
      keyPoints: [],
      actionItems: [],
      decisions: [],
    };
  }
}
