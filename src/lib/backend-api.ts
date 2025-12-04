/**
 * Backend API Client
 * Python FastAPIバックエンドとの通信
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface TranscriptionResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    words?: Array<{
      word: string;
      start: number;
      end: number;
      probability: number;
    }>;
  }>;
  language: string;
  duration: number;
}

export interface DiarizationResult {
  segments: Array<{
    start: number;
    end: number;
    speaker: string;
  }>;
  speakers: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  num_speakers: number;
}

export interface ProcessingResult {
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker_id: string;
  }>;
  speakers: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  language: string;
}

export interface SummarizationResult {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: Array<{
    description: string;
    assignee?: string;
  }>;
  decisions: string[];
}

export interface ProcessingStatus {
  status: 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  result?: ProcessingResult;
}

/**
 * バックエンドのヘルスチェック
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 音声ファイルを文字起こし
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: string = 'ja',
  modelSize: string = 'large-v3'
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const response = await fetch(
    `${BACKEND_URL}/api/transcribe?language=${language}&model_size=${modelSize}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '文字起こしに失敗しました');
  }

  return response.json();
}

/**
 * 音声ファイルの話者識別
 */
export async function diarizeAudio(
  audioBlob: Blob,
  minSpeakers: number = 1,
  maxSpeakers: number = 10,
  hfToken?: string
): Promise<DiarizationResult> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const params = new URLSearchParams({
    min_speakers: minSpeakers.toString(),
    max_speakers: maxSpeakers.toString(),
  });

  if (hfToken) {
    params.append('hf_token', hfToken);
  }

  const response = await fetch(
    `${BACKEND_URL}/api/diarize?${params}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '話者識別に失敗しました');
  }

  return response.json();
}

/**
 * 音声ファイルを完全処理（文字起こし + 話者識別）
 */
export async function processAudio(
  audioBlob: Blob,
  options: {
    language?: string;
    modelSize?: string;
    minSpeakers?: number;
    maxSpeakers?: number;
    hfToken?: string;
  } = {}
): Promise<{ taskId: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');

  const params = new URLSearchParams({
    language: options.language || 'ja',
    model_size: options.modelSize || 'large-v3',
    min_speakers: (options.minSpeakers || 1).toString(),
    max_speakers: (options.maxSpeakers || 10).toString(),
  });

  if (options.hfToken) {
    params.append('hf_token', options.hfToken);
  }

  const response = await fetch(
    `${BACKEND_URL}/api/process?${params}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '処理の開始に失敗しました');
  }

  const data = await response.json();
  return { taskId: data.task_id };
}

/**
 * 処理状態を取得
 */
export async function getProcessingStatus(taskId: string): Promise<ProcessingStatus> {
  const response = await fetch(`${BACKEND_URL}/api/process/${taskId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '状態の取得に失敗しました');
  }

  return response.json();
}

/**
 * 処理完了を待機
 */
export async function waitForProcessing(
  taskId: string,
  onProgress?: (status: ProcessingStatus) => void,
  pollInterval: number = 1000
): Promise<ProcessingResult> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getProcessingStatus(taskId);
        
        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed' && status.result) {
          resolve(status.result);
        } else if (status.status === 'error') {
          reject(new Error(status.message));
        } else {
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * 議事録を要約
 */
export async function summarizeTranscript(
  transcript: string,
  speakers: Array<{ id: string; name: string }>,
  options: {
    provider?: string;
    model?: string;
    apiKey?: string;
    ollamaUrl?: string;
  } = {}
): Promise<SummarizationResult> {
  const response = await fetch(`${BACKEND_URL}/api/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transcript,
      speakers,
      provider: options.provider || 'ollama',
      model: options.model || 'llama3.2',
      api_key: options.apiKey,
      ollama_url: options.ollamaUrl || 'http://localhost:11434',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '要約に失敗しました');
  }

  return response.json();
}

/**
 * 利用可能なモデル一覧を取得
 */
export async function getAvailableModels(): Promise<{
  whisper: Array<{ id: string; name: string; description: string }>;
  diarization: Array<{ id: string; name: string; description: string }>;
}> {
  const response = await fetch(`${BACKEND_URL}/api/models`);

  if (!response.ok) {
    throw new Error('モデル一覧の取得に失敗しました');
  }

  return response.json();
}

/**
 * モデルのダウンロード状態を取得
 */
export interface ModelStatus {
  whisper: {
    id: string;
    name: string;
    downloaded: boolean;
    path: string;
    size_gb: number;
  };
  diarization: {
    id: string;
    name: string;
    downloaded: boolean;
    note: string;
  };
}

export async function getModelStatus(): Promise<ModelStatus> {
  const response = await fetch(`${BACKEND_URL}/api/models/status`);

  if (!response.ok) {
    throw new Error('モデル状態の取得に失敗しました');
  }

  return response.json();
}

/**
 * kotoba-whisperモデルをダウンロード
 */
export async function downloadWhisperModel(): Promise<{
  status: 'downloading' | 'already_downloaded';
  message: string;
}> {
  const response = await fetch(`${BACKEND_URL}/api/models/download/whisper`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'モデルのダウンロードに失敗しました');
  }

  return response.json();
}

