import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, AIProvider, MeetingMinutes, RecordingState, AppSettings, LocalLLMSettings, BackendSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/constants';

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Settings
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings: Partial<AppSettings>) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      setAPIKey: (provider: AIProvider, key: string) =>
        set((state) => ({
          settings: {
            ...state.settings,
            apiKeys: { ...state.settings.apiKeys, [provider]: key },
          },
        })),
      updateLocalLLM: (newSettings: Partial<LocalLLMSettings>) =>
        set((state) => ({
          settings: {
            ...state.settings,
            localLLM: { ...state.settings.localLLM, ...newSettings },
          },
        })),
      updateBackend: (newSettings: Partial<BackendSettings>) =>
        set((state) => ({
          settings: {
            ...state.settings,
            backend: { ...state.settings.backend, ...newSettings },
          },
        })),

      // Recording
      recording: {
        isRecording: false,
        isPaused: false,
        duration: 0,
        source: 'microphone',
        audioLevel: 0,
      },
      setRecording: (newState: Partial<RecordingState>) =>
        set((state) => ({
          recording: { ...state.recording, ...newState },
        })),

      // Minutes
      minutes: [],
      currentMinutes: null,
      addMinutes: (minutes: MeetingMinutes) =>
        set((state) => ({
          minutes: [minutes, ...state.minutes],
        })),
      updateMinutes: (id: string, updates: Partial<MeetingMinutes>) =>
        set((state) => ({
          minutes: state.minutes.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date() } : m
          ),
        })),
      deleteMinutes: (id: string) =>
        set((state) => ({
          minutes: state.minutes.filter((m) => m.id !== id),
          currentMinutes: state.currentMinutes?.id === id ? null : state.currentMinutes,
        })),
      setCurrentMinutes: (minutes: MeetingMinutes | null) =>
        set({ currentMinutes: minutes }),

      // UI State
      activeTab: 'record',
      setActiveTab: (tab) => set({ activeTab: tab }),
      isProcessing: false,
      setIsProcessing: (processing) => set({ isProcessing: processing }),
    }),
    {
      name: 'gijiroku-storage',
      partialize: (state) => ({
        settings: state.settings,
        minutes: state.minutes,
      }),
    }
  )
);
