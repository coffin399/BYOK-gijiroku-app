'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mic, MonitorSpeaker, Radio, Play, Pause, Square, Loader2, AlertCircle, Wand2, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { RecordingSource, MeetingMinutes } from '@/types';
import { transcribeWithKotobaWhisper, transcribeWithWhisper, performSpeakerDiarization, generateMeetingSummary } from '@/lib/ai-service';
import { saveAudio } from '@/lib/audio-storage';
import { v4 as uuidv4 } from 'uuid';

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
    // 権限がない場合はまずリクエスト
    if (permissionStatus !== 'granted') {
      const granted = await requestMicPermission();
      if (!granted) {
        alert('マイクの使用許可が必要です。ブラウザの設定からマイクへのアクセスを許可してください。');
        return;
      }
    }
    await startRecording(selectedSource);
  }, [startRecording, selectedSource, permissionStatus, requestMicPermission]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    
    if (!blob) return;

    // Check HuggingFace API key for STT
    const hfKey = settings.apiKeys.huggingface;
    const openaiKey = settings.apiKeys.openai;
    
    if (!hfKey && !openaiKey) {
      alert('音声認識にはHugging FaceまたはOpenAIのAPIキーが必要です。設定画面でAPIキーを入力してください。');
      setActiveTab('settings');
      return;
    }

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
      // Step 1: Transcribe with kotoba-whisper (preferred) or OpenAI Whisper
      setProcessingStep('🎤 音声を文字起こし中...');
      
      let transcriptText: string;
      let segments: Array<{ start: number; end: number; text: string }> = [];

      if (hfKey) {
        // Use kotoba-whisper for Japanese
        const result = await transcribeWithKotobaWhisper(blob, hfKey);
        transcriptText = result.text;
        segments = result.chunks.map(c => ({
          start: c.timestamp[0],
          end: c.timestamp[1],
          text: c.text,
        }));
      } else if (openaiKey) {
        // Fallback to OpenAI Whisper
        const result = await transcribeWithWhisper(blob, openaiKey);
        transcriptText = result.text;
        segments = result.segments;
      } else {
        throw new Error('音声認識に必要なAPIキーがありません。');
      }

      // Step 2: Speaker Diarization
      setProcessingStep('👥 話者を識別中...');
      
      const transcript = await performSpeakerDiarization(
        transcriptText,
        segments,
        settings.selectedProvider,
        llmKey || '',
        settings.selectedModel,
        settings.localLLM
      );

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
      await saveAudio(audioId, blob, duration);

      // Create meeting minutes
      const minutes: MeetingMinutes = {
        id: uuidv4(),
        title: summary.title || '新しい会議',
        date: new Date(),
        duration,
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
  }, [stopRecording, settings, duration, addMinutes, setActiveTab, setCurrentMinutes, setIsProcessing]);

  const hasRequiredKeys = settings.apiKeys.huggingface || settings.apiKeys.openai;
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
                  Chrome/Edgeを使用するとシステム音声もキャプチャできます
                </p>
              </div>
            </div>
          )}

          {/* Source Selection */}
          <div className="space-y-4">
            <span className="section-title">音声ソース</span>
            <div className="grid grid-cols-3 gap-3">
              {sources.map((source) => {
                const Icon = source.icon;
                const isSelected = selectedSource === source.id;
                const isDisabled = isRecording || source.disabled;
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

          {/* API Key Warning */}
          {!hasRequiredKeys && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-300 font-medium">音声認識のAPIキーが未設定</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Hugging Face (推奨) またはOpenAIのAPIキーが必要です
                </p>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="text-xs text-amber-400 hover:text-amber-300 underline mt-2"
                >
                  設定画面でAPIキーを入力 →
                </button>
              </div>
            </div>
          )}

          {hasRequiredKeys && !hasLLMReady && (
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
              <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isRecording ? 'bg-red-500/5' : 'bg-[var(--bg-tertiary)]'}`} />
              <div className={`absolute inset-6 rounded-full transition-all duration-500 ${isRecording ? 'bg-red-500/10' : 'bg-[var(--bg-secondary)]'}`} />
              
              {isRecording && (
                <div 
                  className="absolute inset-12 rounded-full bg-red-500/20 transition-transform duration-75"
                  style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                />
              )}
              
              {/* Center content */}
              <div className="relative z-10 flex flex-col items-center">
                {isRecording ? (
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
                      {formatDuration(duration)}
                    </span>
                    <span className="text-sm text-red-400 mt-2 font-medium">
                      {isPaused ? '一時停止中' : '録音中'}
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
              {isRecording ? (
                <>
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-all duration-200 flex items-center justify-center"
                  >
                    {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                  </button>
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
                  disabled={isProcessing || !hasRequiredKeys || !hasLLMReady || permissionStatus === 'denied'}
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

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 mt-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm max-w-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

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
          {selectedSource !== 'microphone' && (
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
        </div>
      </div>
    </div>
  );
}
