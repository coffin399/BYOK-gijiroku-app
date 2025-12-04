import { AIProviderConfig } from '@/types';

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'huggingface',
    name: 'Hugging Face',
    icon: '🤗',
    models: [
      {
        id: 'kotoba-tech/kotoba-whisper-v2.2-faster',
        name: 'Kotoba Whisper v2.2',
        description: '日本語特化の高精度音声認識モデル。',
        supportsSpeechToText: true,
      },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    models: [
      {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        description: '最新の超高性能モデル。',
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'マルチモーダルモデル。高速で高精度。',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'コスト効率の良い高性能モデル。',
      },
      {
        id: 'whisper-1',
        name: 'Whisper',
        description: '高精度な音声認識モデル。',
        supportsSpeechToText: true,
      },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    models: [
      {
        id: 'gemini-3.0-pro-preview',
        name: 'Gemini 3.0 Pro Preview',
        description: '最新の次世代モデル（プレビュー）。',
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: '高性能な最新プロモデル。',
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: '高速で効率的な最新モデル。',
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: '高速マルチモーダルモデル。',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: '長文コンテキスト対応モデル。',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🎭',
    models: [
      {
        id: 'claude-opus-4.5',
        name: 'Claude Opus 4.5',
        description: '最高性能の最新モデル。',
      },
      {
        id: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        description: '高性能でバランスの取れた最新モデル。',
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: '安定版の高性能モデル。',
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: '高速で低コストなモデル。',
      },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (ローカル)',
    icon: '🦙',
    isLocal: true,
    models: [
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        description: 'Meta社の最新オープンモデル。',
      },
      {
        id: 'gemma2',
        name: 'Gemma 2',
        description: 'Google製の軽量高性能モデル。',
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        description: 'Alibaba製の多言語対応モデル。',
      },
      {
        id: 'mistral',
        name: 'Mistral',
        description: '高効率なオープンモデル。',
      },
      {
        id: 'command-r',
        name: 'Command R',
        description: 'Cohere製の対話特化モデル。',
      },
    ],
  },
  {
    id: 'koboldcpp',
    name: 'KoboldCpp (ローカル)',
    icon: '🐉',
    isLocal: true,
    models: [
      {
        id: 'custom',
        name: 'カスタムモデル',
        description: 'KoboldCppでロード中のモデル。',
      },
    ],
  },
];

export const SPEAKER_COLORS = [
  '#8B5CF6', // Violet
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

export const DEFAULT_SETTINGS = {
  apiKeys: {},
  selectedProvider: 'gemini' as const,
  selectedModel: 'gemini-2.5-flash',
  localLLM: {
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    koboldcppUrl: 'http://localhost:5001',
  },
  backend: {
    enabled: false,
    url: 'http://localhost:8000',
    whisperModel: 'large-v3',
    useLocalDiarization: true,
  },
  language: 'ja' as const,
  autoSave: true,
  speakerDiarization: true,
  theme: 'dark' as const,
};

export const WHISPER_MODELS = [
  { id: 'tiny', name: 'Tiny', description: '最速・低精度 (~1GB VRAM)', vram: 1 },
  { id: 'base', name: 'Base', description: '高速・低精度 (~1GB VRAM)', vram: 1 },
  { id: 'small', name: 'Small', description: 'バランス型 (~2GB VRAM)', vram: 2 },
  { id: 'medium', name: 'Medium', description: '高精度 (~5GB VRAM)', vram: 5 },
  { id: 'large-v3', name: 'Large-v3', description: '最高精度 (~10GB VRAM)', vram: 10 },
  { id: 'large-v3-turbo', name: 'Large-v3 Turbo', description: '高速+高精度', vram: 6 },
  { id: 'kotoba-v2.2', name: 'Kotoba Whisper v2.2', description: '日本語特化モデル', vram: 10 },
];
