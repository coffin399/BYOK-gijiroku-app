'use client';

import { useState, useEffect } from 'react';
import { Send, Wifi, WifiOff, Monitor, Mic, RefreshCw, AlertCircle, CheckCircle2, Link2, ArrowRight } from 'lucide-react';
import { 
  getAudioDevices, 
  getAudioCapabilities,
  startAudioSend,
  stopAudioSend,
  AudioDevice,
  AudioCapabilities,
  isBackendCaptureAvailable 
} from '@/lib/audio-capture-api';
import { v4 as uuidv4 } from 'uuid';

interface NetworkAudioSenderProps {
  disabled?: boolean;
}

export function NetworkAudioSender({ disabled }: NetworkAudioSenderProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [wasapiDevices, setWasapiDevices] = useState<AudioDevice[]>([]);
  const [capabilities, setCapabilities] = useState<AudioCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Sender state
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [useWasapiLoopback, setUseWasapiLoopback] = useState(false);
  const [targetHost, setTargetHost] = useState('');
  const [targetPort, setTargetPort] = useState('9999');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const loadDevices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const available = await isBackendCaptureAvailable();
      setBackendAvailable(available);
      
      if (!available) {
        setError('バックエンドに接続できません。start.batを実行してください。');
        return;
      }
      
      const [data, caps] = await Promise.all([
        getAudioDevices(),
        getAudioCapabilities(),
      ]);
      
      setDevices(data.devices);
      setWasapiDevices(data.wasapi_loopback_devices || []);
      setCapabilities(caps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'デバイスの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleStartSending = async () => {
    if (selectedDevice === null || !targetHost || !targetPort) return;

    try {
      const newSessionId = uuidv4();
      await startAudioSend(
        newSessionId,
        selectedDevice,
        targetHost,
        parseInt(targetPort),
        { useWasapiLoopback }
      );
      setSessionId(newSessionId);
      setIsSending(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '送信開始に失敗しました');
    }
  };

  const handleStopSending = async () => {
    if (!sessionId) return;

    try {
      await stopAudioSend(sessionId);
    } catch (err) {
      console.error('Stop error:', err);
    } finally {
      setIsSending(false);
      setSessionId(null);
    }
  };

  const displayDevices = useWasapiLoopback ? wasapiDevices : devices.filter(d => 
    d.is_loopback || d.name.toLowerCase().includes('mic') || d.name.toLowerCase().includes('input')
  );

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <div className="spinner w-4 h-4" />
          <span className="text-sm">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (error || !backendAvailable) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-300">{error || 'バックエンド未接続'}</p>
            <button
              onClick={loadDevices}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-2"
            >
              <RefreshCw className="w-3 h-3" />
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Send className="w-5 h-5 text-[var(--accent-primary)]" />
        <span className="section-title">音声を別PCに送信</span>
      </div>

      {/* Status - Sending Animation */}
      {isSending && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Wifi className="w-5 h-5 text-green-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-ping" />
              </div>
              <span className="text-sm font-medium text-green-400">音声送信中</span>
            </div>
            <span className="text-xs text-green-400/70">リアルタイム</span>
          </div>
          
          {/* Connection visualization */}
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-green-400/70 mt-1">このPC</span>
            </div>
            
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
              <ArrowRight className="w-4 h-4 text-green-400 mx-1" />
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '0.8s' }} />
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: '1s' }} />
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-green-400/70 mt-1">受信PC</span>
            </div>
          </div>
          
          <div className="text-center">
            <code className="text-sm text-green-300 bg-green-500/10 px-3 py-1 rounded-lg">
              {targetHost}:{targetPort}
            </code>
          </div>
        </div>
      )}

      {/* WASAPI Toggle */}
      {capabilities?.wasapi_loopback && wasapiDevices.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-primary)]">WASAPI Loopback</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useWasapiLoopback}
              onChange={(e) => {
                setUseWasapiLoopback(e.target.checked);
                setSelectedDevice(null);
              }}
              disabled={disabled || isSending}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50" />
          </label>
        </div>
      )}

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-xs text-[var(--text-muted)]">送信するデバイス:</label>
        <select
          value={selectedDevice ?? ''}
          onChange={(e) => setSelectedDevice(e.target.value ? parseInt(e.target.value) : null)}
          disabled={disabled || isSending}
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] disabled:opacity-50"
        >
          <option value="">選択してください</option>
          {displayDevices.map((device) => (
            <option key={device.index} value={device.index}>
              {device.name}
            </option>
          ))}
        </select>
      </div>

      {/* Target Connection Info */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">送信先の接続情報</span>
        </div>
        
        <p className="text-xs text-blue-300/70 mb-3">
          📡 受信側PCの「ネットワーク受信」に表示されているアドレスを入力
        </p>

        {/* Combined input for IP:Port */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-[var(--text-muted)]">送信先アドレス:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetHost}
                onChange={(e) => {
                  // Handle paste of IP:Port format
                  const value = e.target.value;
                  if (value.includes(':')) {
                    const [ip, port] = value.split(':');
                    setTargetHost(ip);
                    if (port) setTargetPort(port);
                  } else {
                    setTargetHost(value);
                  }
                }}
                placeholder="192.168.1.100"
                disabled={disabled || isSending}
                className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 font-mono"
              />
              <span className="flex items-center text-[var(--text-muted)]">:</span>
              <input
                type="number"
                value={targetPort}
                onChange={(e) => setTargetPort(e.target.value)}
                placeholder="9999"
                disabled={disabled || isSending}
                className="w-24 px-3 py-2.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50 font-mono"
              />
            </div>
          </div>

          {targetHost && targetPort && (
            <div className="flex items-center gap-2 text-xs text-blue-300/70">
              <CheckCircle2 className="w-3 h-3" />
              <span>送信先: <code className="bg-blue-500/10 px-1 rounded">{targetHost}:{targetPort}</code></span>
            </div>
          )}
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={isSending ? handleStopSending : handleStartSending}
        disabled={disabled || (!isSending && (selectedDevice === null || !targetHost || !targetPort))}
        className={`
          w-full py-3 rounded-xl font-medium transition-all duration-200
          flex items-center justify-center gap-2
          ${isSending
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-[var(--bg-primary)]'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isSending ? (
          <>
            <WifiOff className="w-4 h-4" />
            送信停止
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4" />
            送信開始
          </>
        )}
      </button>

      {/* Help */}
      <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <p className="text-xs text-[var(--text-muted)]">
          💡 <strong>使い方:</strong>
        </p>
        <ol className="text-xs text-[var(--text-muted)] mt-2 space-y-1 list-decimal list-inside">
          <li>受信側PCでGIJIROKUアプリを起動</li>
          <li>録音画面で「バックエンドキャプチャ」→「ネットワーク受信」を設定</li>
          <li>表示された接続情報をここに入力</li>
          <li>「送信開始」をクリック</li>
        </ol>
      </div>
    </div>
  );
}

