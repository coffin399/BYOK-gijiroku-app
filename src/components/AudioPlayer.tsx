'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw, FastForward } from 'lucide-react';
import { getAudio, downloadAudioAsFile, createAudioURL, revokeAudioURL } from '@/lib/audio-storage';

interface AudioPlayerProps {
  audioId: string;
  filename: string;
  onError?: (error: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioPlayer({ audioId, filename, onError }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 音声データを読み込む
  useEffect(() => {
    let url: string | null = null;

    async function loadAudio() {
      try {
        setIsLoading(true);
        const record = await getAudio(audioId);
        if (record) {
          url = createAudioURL(record.blob);
          setAudioUrl(url);
        } else {
          onError?.('音声データが見つかりません');
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : '音声の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    }

    loadAudio();

    return () => {
      if (url) {
        revokeAudioURL(url);
      }
    };
  }, [audioId, onError]);

  // 再生/一時停止
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  // シーク
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  // 10秒戻る
  const skipBack = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
  }, []);

  // 10秒進む
  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
  }, [duration]);

  // 再生速度変更
  const cyclePlaybackRate = useCallback(() => {
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  }, [playbackRate]);

  // ダウンロード
  const handleDownload = useCallback(async () => {
    try {
      await downloadAudioAsFile(audioId, filename);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    }
  }, [audioId, filename, onError]);

  // ミュート切り替え
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
        <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
          <div className="spinner w-4 h-4" />
          <span className="text-sm">音声を読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
        <p className="text-sm text-[var(--text-muted)] text-center">音声データがありません</p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] space-y-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onDurationChange={() => setDuration(audioRef.current?.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleSeek}
        className="relative h-2 bg-[var(--bg-secondary)] rounded-full cursor-pointer group"
      >
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-purple)] rounded-full"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${(currentTime / duration) * 100}% - 6px)` }}
        />
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Skip back */}
          <button
            onClick={skipBack}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            title="10秒戻る"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent-secondary)] transition-all flex items-center justify-center"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Skip forward */}
          <button
            onClick={skipForward}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            title="10秒進む"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Playback rate */}
          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            title="再生速度"
          >
            {playbackRate}x
          </button>

          {/* Volume */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] transition-all"
            title="ダウンロード（NotebookLM用）"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* NotebookLM hint */}
      <p className="text-xs text-[var(--text-muted)] text-center">
        💡 ダウンロードしてNotebookLMにアップロードできます
      </p>
    </div>
  );
}

