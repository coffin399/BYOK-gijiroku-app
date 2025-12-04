'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface RealtimeTranscriptProps {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  isRecording: boolean;
}

export function RealtimeTranscript({
  isListening,
  transcript,
  interimTranscript,
  error,
  isSupported,
  isRecording,
}: RealtimeTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  if (!isRecording) {
    return null;
  }

  return (
    <div className="mt-6 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isListening ? (
            <Mic className="w-4 h-4 text-green-400 animate-pulse" />
          ) : (
            <MicOff className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            リアルタイム文字起こし
          </span>
          {isListening && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 animate-pulse">
              認識中
            </span>
          )}
        </div>
        
        {!isSupported && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle className="w-3 h-3" />
            <span>非対応ブラウザ</span>
          </div>
        )}
        
        {isSupported && (
          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
            <Wifi className="w-3 h-3" />
            <span>Web Speech API</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Transcript area */}
      <div
        ref={containerRef}
        className="h-32 overflow-y-auto p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
      >
        {!transcript && !interimTranscript ? (
          <p className="text-sm text-[var(--text-muted)] italic">
            {isListening 
              ? '話し始めると文字が表示されます...' 
              : isSupported 
                ? '録音中に音声を認識します'
                : 'このブラウザではリアルタイム認識は利用できません'
            }
          </p>
        ) : (
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {/* Final transcript */}
            {transcript}
            {/* Interim transcript (gray, still being recognized) */}
            {interimTranscript && (
              <span className="text-[var(--text-muted)] opacity-70">
                {transcript ? ' ' : ''}{interimTranscript}
              </span>
            )}
            {/* Blinking cursor */}
            {isListening && (
              <span className="inline-block w-0.5 h-4 bg-[var(--accent-primary)] ml-0.5 animate-pulse" />
            )}
          </p>
        )}
      </div>

      {/* Info */}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        💡 仮の文字起こしです。録音停止後にkotoba-whisperで高精度版に置き換わります。
      </p>
    </div>
  );
}

