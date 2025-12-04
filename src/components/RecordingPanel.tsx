'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mic, MonitorSpeaker, Radio, Play, Pause, Square, Loader2, AlertCircle, Wand2, CheckCircle2, Server } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useRealtimeTranscription } from '@/hooks/useRealtimeTranscription';
import { RecordingSource, MeetingMinutes, Transcript, TranscriptSegment, Speaker } from '@/types';
import { generateMeetingSummary } from '@/lib/ai-service';
import { saveAudio } from '@/lib/audio-storage';
import { v4 as uuidv4 } from 'uuid';
import { AudioDeviceSelector } from './AudioDeviceSelector';
import { RealtimeTranscript } from './RealtimeTranscript';
import { startCapture, stopCapture, isBackendCaptureAvailable } from '@/lib/audio-capture-api';
import { processAudio, waitForProcessing, checkBackendHealth, ProcessingResult, ProcessingStatus } from '@/lib/backend-api';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingPanel() {
  const { settings, isProcessing, setIsProcessing, addMinutes, setActiveTab, setCurrentMinutes } = useStore();
  const [selectedSource, setSelectedSource] = useState<RecordingSource>('microphone');
  const [processingStep, setProcessingStep] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [useBackendCapture, setUseBackendCapture] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [backendRecording, setBackendRecording] = useState(false);
  const [backendDuration, setBackendDuration] = useState(0);
  const [useWasapiLoopback, setUseWasapiLoopback] = useState(false);
  const [networkPort, setNetworkPort] = useState<number | null>(null);
  
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    browserSupport,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useAudioRecorder();

  // リアルタイム文字起こし
  const {
    isListening: isRealtimeListening,
    transcript: realtimeTranscript,
    interimTranscript,
    error: realtimeError,
    isSupported: isRealtimeSupported,
    startListening,
    stopListening,
    clearTranscript,
  } = useRealtimeTranscription();

  // マイクの権限状態を確認
  useEffect(() => {
    async function checkPermission() {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      } catch {
        // permissions API not supported
        setPermissionStatus('unknown');
      }
    }
    checkPermission();
  }, []);

  // バックエンドの可用性を確認
  useEffect(() => {
    async function checkBackend() {
      const available = await isBackendCaptureAvailable();
      setBackendAvailable(available);
    }
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  // バックエンド録音時のタイマー
  useEffect(() => {
    if (!backendRecording) {
      setBackendDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setBackendDuration(d => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [backendRecording]);

  const sources: { id: RecordingSource; label: string; icon: typeof Mic; description: string; disabled?: boolean }[] = [
    { id: 'microphone', label: 'マイク', icon: Mic, description: '自分の声を録音' },
    { id: 'system', label: 'システム音声', icon: MonitorSpeaker, description: 'Zoom等の音声', disabled: !browserSupport.systemAudio },
    { id: 'both', label: '両方', icon: Radio, description: 'マイク + システム', disabled: !browserSupport.systemAudio },
  ];

  // マイク権限をリクエスト
  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionStatus('granted');
      return true;
    } catch {
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const handleStartRecording = useCallback(async () => {
    // リアルタイム文字起こしをクリア＆開始
    clearTranscript();
    
    // バックエンドキャプチャモード
    if (useBackendCapture && (selectedDevices.length > 0 || networkPort)) {
      try {
        const sessionId = uuidv4();
        await startCapture(sessionId, selectedDevices, {
          useWasapiLoopback,
          networkPort: networkPort || undefined,
        });
        setBackendSessionId(sessionId);
        setBackendRecording(true);
        
        // リアルタイム文字起こしを開始（マイクがある場合）
        if (isRealtimeSupported && !useWasapiLoopback) {
          startListening();
        }
        return;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'バックエンドでの録音開始に失敗しました');
        return;
      }
    }

    // 通常のブラウザ録音モード
    // 権限がない場合はまずリクエスト
    if (permissionStatus !== 'granted') {
      const granted = await requestMicPermission();
      if (!granted) {
        alert('マイクの使用許可が必要です。ブラウザの設定からマイクへのアクセスを許可してください。');
        return;
      }
    }
    await startRecording(selectedSource);
    
    // リアルタイム文字起こしを開始
    if (isRealtimeSupported) {
      startListening();
    }
  }, [startRecording, selectedSource, permissionStatus, requestMicPermission, useBackendCapture, selectedDevices, useWasapiLoopback, networkPort, clearTranscript, startListening, isRealtimeSupported]);

  const handleStopRecording = useCallback(async () => {
    // リアルタイム文字起こしを停止
    stopListening();
    
    let blob: Blob | null = null;
    let recordingDuration = duration;

    // バックエンドキャプチャモードの場合
    if (backendRecording && backendSessionId) {
      try {
        blob = await stopCapture(backendSessionId);
        recordingDuration = backendDuration;
      } catch (err) {
        console.error('Backend stop error:', err);
        alert(err instanceof Error ? err.message : 'バックエンドでの録音停止に失敗しました');
      } finally {
        setBackendRecording(false);
        setBackendSessionId(null);
      }
    } else {
      // 通常のブラウザ録音モード
      blob = await stopRecording();
    }
    
    if (!blob) return;

    // Check LLM API key (ローカルLLMの場合はAPIキー不要)
    const isLocalLLM = settings.selectedProvider === 'ollama' || settings.selectedProvider === 'koboldcpp';
    const llmKey = settings.apiKeys[settings.selectedProvider];
    
    if (!isLocalLLM && !llmKey) {
      alert(`${settings.selectedProvider.toUpperCase()}のAPIキーが設定されていません。設定画面でAPIキーを入力してください。`);
      setActiveTab('settings');
      return;
    }

    setIsProcessing(true);

    try {
      // バックエンドが利用可能かチェック
      const backendHealthy = await checkBackendHealth();
      
      let transcript: Transcript;
      let transcriptText: string;
      
      if (backendHealthy) {
        // ===== バックエンド処理モード（推奨） =====
        // kotoba-whisper + pyannote.audio（完全ローカル動作）
        
        // Step 1: バックエンドに音声を送信して処理開始
        setProcessingStep('🎤 音声を文字起こし中... (kotoba-whisper)');
        const { taskId } = await processAudio(blob, {
          language: 'ja',
          hfToken: settings.backend.hfToken, // pyannote.audioモデルダウンロード用
        });
        
        // Step 2: 処理完了を待機（プログレス更新）
        const result = await waitForProcessing(taskId, (status: ProcessingStatus) => {
          if (status.progress <= 30) {
            setProcessingStep('🎤 音声を文字起こし中... (kotoba-whisper)');
          } else if (status.progress <= 70) {
            setProcessingStep('👥 話者を識別中... (pyannote.audio)');
          } else {
            setProcessingStep('🔗 結果を統合中...');
          }
        });
        
        // 結果を変換
        transcriptText = result.text;
        const speakers: Speaker[] = result.speakers.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
        }));
        
        const segments: TranscriptSegment[] = result.segments.map(seg => ({
          id: uuidv4(),
          speakerId: seg.speaker_id,
          text: seg.text,
          startTime: seg.start,
          endTime: seg.end,
        }));
        
        transcript = {
          speakers,
          segments,
        };
        
      } else {
        // ===== フォールバック：バックエンド未接続 =====
        // バックエンドが必要なため、エラーを表示
        throw new Error('バックエンドに接続できません。start.batを実行してバックエンドを起動してください。');
      }

      // Step 3: Generate Summary
      setProcessingStep('📋 議事録を生成中...');
      const summary = await generateMeetingSummary(
        transcript,
        settings.selectedProvider,
        llmKey || '',
        settings.selectedModel,
        settings.localLLM
      );

      // Step 4: Save audio
      setProcessingStep('💾 音声を保存中...');
      const audioId = uuidv4();
      await saveAudio(audioId, blob, recordingDuration);

      // Create meeting minutes
      const minutes: MeetingMinutes = {
        id: uuidv4(),
        title: summary.title || '新しい会議',
        date: new Date(),
        duration: recordingDuration,
        participants: transcript.speakers,
        transcript,
        summary: summary.summary || '',
        keyPoints: summary.keyPoints || [],
        actionItems: summary.actionItems || [],
        decisions: summary.decisions || [],
        audioId, // 音声IDを保存
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      addMinutes(minutes);
      setCurrentMinutes(minutes);
      setActiveTab('history');
    } catch (err) {
      console.error('Processing error:', err);
      alert(err instanceof Error ? err.message : '処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }, [stopRecording, stopListening, settings, duration, addMinutes, setActiveTab, setCurrentMinutes, setIsProcessing, backendRecording, backendSessionId, backendDuration]);

  // 現在録音中かどうか（ブラウザまたはバックエンド）
  const isCurrentlyRecording = isRecording || backendRecording;
  const currentDuration = backendRecording ? backendDuration : duration;

  const isLocalLLM = settings.selectedProvider === 'ollama' || settings.selectedProvider === 'koboldcpp';
  const hasLLMReady = isLocalLLM || settings.apiKeys[settings.selectedProvider];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--border-color)]">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">新規録音</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          会議を録音して、AIが自動で議事録を作成します
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto space-y-8 stagger">
          {/* Permission Status */}
          {permissionStatus === 'denied' && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">マイクへのアクセスがブロックされています</p>
                <p className="text-xs text-red-400/80 mt-1">
                  ブラウザの設定からマイクへのアクセスを許可してください
                </p>
              </div>
            </div>
          )}

          {permissionStatus === 'granted' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">マイクの使用が許可されています</span>
            </div>
          )}

          {permissionStatus === 'prompt' && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">マイクの許可が必要です</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  録音開始時にブラウザからマイクの使用許可を求められます
                </p>
                <button 
                  onClick={requestMicPermission}
                  className="text-xs text-amber-400 hover:text-amber-300 underline mt-2"
                >
                  今すぐ許可する →
                </button>
              </div>
            </div>
          )}

          {/* Browser Support Info */}
          {!browserSupport.systemAudio && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">
                  {browserSupport.browserName}: システム音声キャプチャ非対応
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Chrome/Edgeを使用するか、下記のバックエンドキャプチャを使用してください
                </p>
              </div>
            </div>
          )}

          {/* Backend Capture Mode Toggle */}
          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Server className={`w-5 h-5 ${backendAvailable ? 'text-green-400' : 'text-[var(--text-muted)]'}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    バックエンドキャプチャ（Firefox対応）
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    VB-Cable等の仮想デバイスでシステム音声をキャプチャ
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useBackendCapture}
                  onChange={(e) => setUseBackendCapture(e.target.checked)}
                  disabled={!backendAvailable || isCurrentlyRecording}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)] peer-disabled:opacity-50" />
              </label>
            </div>
            
            {!backendAvailable && (
              <p className="text-xs text-amber-400">
                ⚠️ バックエンドに接続できません。start.batを実行してください。
              </p>
            )}
            
            {useBackendCapture && backendAvailable && (
              <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                <AudioDeviceSelector
                  selectedDevices={selectedDevices}
                  onDevicesChange={setSelectedDevices}
                  useWasapiLoopback={useWasapiLoopback}
                  onWasapiLoopbackChange={setUseWasapiLoopback}
                  networkPort={networkPort}
                  onNetworkPortChange={setNetworkPort}
                  disabled={isCurrentlyRecording}
                />
              </div>
            )}
          </div>

          {/* Source Selection (only for browser capture mode) */}
          {!useBackendCapture && (
            <div className="space-y-4">
              <span className="section-title">音声ソース（ブラウザ経由）</span>
              <div className="grid grid-cols-3 gap-3">
                {sources.map((source) => {
                  const Icon = source.icon;
                  const isSelected = selectedSource === source.id;
                  const isDisabled = isCurrentlyRecording || source.disabled;
                  return (
                    <button
                      key={source.id}
                      onClick={() => !isDisabled && setSelectedSource(source.id)}
                      disabled={isDisabled}
                      className={`
                        relative p-4 rounded-2xl text-center transition-all duration-200
                        ${isSelected 
                          ? 'bg-[var(--accent-glow)] border-[var(--accent-primary)]' 
                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                        }
                        border ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className={`
                        w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center
                        ${isSelected ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                      `}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`text-sm font-medium ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}>
                        {source.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{source.description}</p>
                      {source.disabled && (
                        <span className="absolute top-2 right-2 text-xs text-amber-400">⚠️</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* LLM Warning */}
          {!hasLLMReady && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">議事録生成のLLMが未設定</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  {settings.selectedProvider}のAPIキーを入力するか、ローカルLLMを選択してください
                </p>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="text-xs text-amber-400 hover:text-amber-300 underline mt-2"
                >
                  設定画面で設定 →
                </button>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex flex-col items-center py-8">
            {/* Visualizer */}
            <div className="relative w-56 h-56 flex items-center justify-center mb-8">
              {/* Background rings */}
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isCurrentlyRecording ? 'bg-red-500/5' : 'bg-[var(--bg-tertiary)]'}`} />
              <div className={`absolute inset-6 rounded-full transition-all duration-500 ${isCurrentlyRecording ? 'bg-red-500/10' : 'bg-[var(--bg-secondary)]'}`} />
              
              {isRecording && (
                <div 
                  className="absolute inset-12 rounded-full bg-red-500/20 transition-transform duration-75"
                  style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                />
              )}

              {backendRecording && (
                <div className="absolute inset-12 rounded-full bg-red-500/20 animate-pulse" />
              )}
              
              {/* Center content */}
              <div className="relative z-10 flex flex-col items-center">
                {isCurrentlyRecording ? (
                  <>
                    <div className="audio-wave mb-4">
                      {[...Array(5)].map((_, i) => (
                        <div 
                          key={i} 
                          className="audio-wave-bar"
                          style={{ 
                            animationPlayState: isPaused ? 'paused' : 'running',
                            background: 'linear-gradient(to top, #ef4444, #f87171)'
                          }} 
                        />
                      ))}
                    </div>
                    <span className="text-4xl font-mono font-bold text-[var(--text-primary)]">
                      {formatDuration(currentDuration)}
                    </span>
                    <span className="text-sm text-red-400 mt-2 font-medium">
                      {isPaused ? '一時停止中' : backendRecording ? '録音中 (Backend)' : '録音中'}
                    </span>
                  </>
                ) : isProcessing ? (
                  <>
                    <div className="spinner mb-4" />
                    <span className="text-sm text-[var(--text-secondary)] text-center px-4">
                      {processingStep}
                    </span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-12 h-12 text-[var(--accent-primary)] mb-3" />
                    <span className="text-sm text-[var(--text-muted)]">録音待機中</span>
                  </>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-4">
              {isCurrentlyRecording ? (
                <>
                  {!backendRecording && (
                    <button
                      onClick={isPaused ? resumeRecording : pauseRecording}
                      className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-all duration-200 flex items-center justify-center"
                    >
                      {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                    </button>
                  )}
                  <button
                    onClick={handleStopRecording}
                    disabled={isProcessing}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white 
                             hover:from-red-600 hover:to-red-700 transition-all duration-200
                             recording-pulse disabled:opacity-50 flex items-center justify-center
                             shadow-lg shadow-red-500/25"
                  >
                    <Square className="w-8 h-8" />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartRecording}
                  disabled={
                    isProcessing || 
                    !hasLLMReady || 
                    (!useBackendCapture && permissionStatus === 'denied') ||
                    (useBackendCapture && selectedDevices.length === 0 && !networkPort)
                  }
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-purple)] 
                           text-[var(--bg-primary)] transition-all duration-200
                           hover:shadow-lg hover:shadow-[var(--accent-primary)]/25 hover:scale-105
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                           flex items-center justify-center"
                >
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              )}
            </div>

            {/* Backend capture hint */}
            {useBackendCapture && selectedDevices.length === 0 && !networkPort && !isCurrentlyRecording && (
              <p className="text-xs text-amber-400 mt-4">
                ⚠️ 録音するデバイスを選択するか、ネットワーク受信を設定してください
              </p>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 mt-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Realtime Transcript */}
          <RealtimeTranscript
            isListening={isRealtimeListening}
            transcript={realtimeTranscript}
            interimTranscript={interimTranscript}
            error={realtimeError}
            isSupported={isRealtimeSupported}
            isRecording={isCurrentlyRecording}
          />

          {/* Info */}
          <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-glow)] flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {isLocalLLM ? `${settings.selectedProvider} (ローカル)` : settings.selectedProvider} で議事録生成
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  録音停止後、自動で文字起こし → 話者識別 → 議事録生成を行います
                </p>
              </div>
            </div>
          </div>

          {/* System Audio Note */}
          {!useBackendCapture && selectedSource !== 'microphone' && (
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <p className="text-sm text-[var(--text-secondary)]">
                💡 <strong>システム音声のキャプチャ方法:</strong>
              </p>
              <ol className="text-xs text-[var(--text-muted)] mt-2 space-y-1 list-decimal list-inside">
                <li>録音ボタンを押すと画面共有ダイアログが表示されます</li>
                <li>共有する画面/ウィンドウを選択してください</li>
                <li><strong>「システムの音声を共有」をオンにしてください</strong></li>
                <li>「共有」をクリックして録音を開始</li>
              </ol>
            </div>
          )}

          {/* Capture Mode Guide */}
          {useBackendCapture && !useWasapiLoopback && (
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <p className="text-sm text-[var(--text-secondary)]">
                💡 <strong>VB-Cableでシステム音声をキャプチャする方法:</strong>
              </p>
              <ol className="text-xs text-[var(--text-muted)] mt-2 space-y-1 list-decimal list-inside">
                <li>
                  <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
                    VB-Cable
                  </a>
                  をダウンロード・インストール
                </li>
                <li>Windowsの「サウンド設定」→「出力」で「CABLE Input」を選択</li>
                <li>上のデバイス一覧から「CABLE Output」を選択して録音</li>
                <li>自分の声も録音したい場合はマイクも同時に選択</li>
              </ol>
            </div>
          )}

          {useBackendCapture && useWasapiLoopback && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-green-400">
                🎯 <strong>WASAPI Loopbackモード</strong>
              </p>
              <p className="text-xs text-green-400/70 mt-1">
                VB-Cable不要！出力デバイスから直接システム音声をキャプチャします。
                <br />
                スピーカーやヘッドホンの出力デバイスを選択してください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
