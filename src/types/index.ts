// AI Provider Types
export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'ollama' | 'koboldcpp';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  models: AIModel[];
  icon: string;
  isLocal?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  supportsSpeechToText?: boolean;
}

// API Key Settings
export interface APIKeySettings {
  openai?: string;
  gemini?: string;
  anthropic?: string;
  ollama?: string;
  koboldcpp?: string;
}

// Hugging Face Token (pyannote.audioモデルダウンロード用)
export interface HuggingFaceSettings {
  token?: string; // pyannote.audioのモデルダウンロードに必要
}

// Recording Types
export type RecordingSource = 'microphone' | 'system' | 'both';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  source: RecordingSource;
  audioLevel: number;
}

// Speaker/Transcript Types
export interface Speaker {
  id: string;
  name: string;
  color: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface Transcript {
  id: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  rawText: string;
}

// Meeting/Minutes Types
export interface MeetingMinutes {
  id: string;
  title: string;
  date: Date;
  duration: number;
  participants: Speaker[];
  transcript: Transcript;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  decisions: string[];
  audioId?: string; // IndexedDBに保存された音声のID
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
  completed: boolean;
}

// Local LLM Settings
export interface LocalLLMSettings {
  ollamaUrl: string;
  ollamaModel: string;
  koboldcppUrl: string;
}

// Backend Settings
export interface BackendSettings {
  enabled: boolean;
  url: string;
  whisperModel: string;
  useLocalDiarization: boolean;
  hfToken?: string; // pyannote.audioモデルダウンロード用のHugging Faceトークン
}

// App Settings
export interface AppSettings {
  apiKeys: APIKeySettings;
  selectedProvider: AIProvider;
  selectedModel: string;
  localLLM: LocalLLMSettings;
  backend: BackendSettings;
  language: 'ja' | 'en';
  autoSave: boolean;
  speakerDiarization: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Store State
export interface AppState {
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setAPIKey: (provider: AIProvider, key: string) => void;
  updateLocalLLM: (settings: Partial<LocalLLMSettings>) => void;
  updateBackend: (settings: Partial<BackendSettings>) => void;
  
  // Recording
  recording: RecordingState;
  setRecording: (state: Partial<RecordingState>) => void;
  
  // Minutes
  minutes: MeetingMinutes[];
  currentMinutes: MeetingMinutes | null;
  addMinutes: (minutes: MeetingMinutes) => void;
  updateMinutes: (id: string, updates: Partial<MeetingMinutes>) => void;
  deleteMinutes: (id: string) => void;
  setCurrentMinutes: (minutes: MeetingMinutes | null) => void;
  
  // UI State
  activeTab: 'record' | 'history' | 'settings';
  setActiveTab: (tab: 'record' | 'history' | 'settings') => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
}
