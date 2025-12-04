'use client';

import { useState, useEffect } from 'react';
import { Monitor, Mic, Volume2, RefreshCw, AlertCircle, CheckCircle2, Wifi, Radio, Copy, Check, Link2 } from 'lucide-react';
import { 
  getAudioDevices, 
  getAudioCapabilities,
  getNetworkInfo,
  AudioDevice, 
  AudioCapabilities,
  NetworkInfo,
  isBackendCaptureAvailable 
} from '@/lib/audio-capture-api';

interface AudioDeviceSelectorProps {
  selectedDevices: number[];
  onDevicesChange: (devices: number[]) => void;
  useWasapiLoopback: boolean;
  onWasapiLoopbackChange: (use: boolean) => void;
  networkPort: number | null;
  onNetworkPortChange: (port: number | null) => void;
  disabled?: boolean;
}

export function AudioDeviceSelector({ 
  selectedDevices, 
  onDevicesChange,
  useWasapiLoopback,
  onWasapiLoopbackChange,
  networkPort,
  onNetworkPortChange,
  disabled 
}: AudioDeviceSelectorProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [wasapiDevices, setWasapiDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [capabilities, setCapabilities] = useState<AudioCapabilities | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [showNetworkReceiver, setShowNetworkReceiver] = useState(false);
  const [copied, setCopied] = useState(false);

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
      
      const [data, caps, netInfo] = await Promise.all([
        getAudioDevices(),
        getAudioCapabilities(),
        getNetworkInfo(),
      ]);
      
      setDevices(data.devices);
      setWasapiDevices(data.wasapi_loopback_devices || []);
      setCapabilities(caps);
      setNetworkInfo(netInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'デバイスの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const toggleDevice = (index: number) => {
    if (disabled) return;
    
    if (selectedDevices.includes(index)) {
      onDevicesChange(selectedDevices.filter(i => i !== index));
    } else {
      onDevicesChange([...selectedDevices, index]);
    }
  };

  const getDeviceIcon = (device: AudioDevice) => {
    if (device.is_wasapi_loopback) {
      return <Monitor className="w-4 h-4" />;
    }
    if (device.is_loopback) {
      return <Radio className="w-4 h-4" />;
    }
    if (device.name.toLowerCase().includes('mic')) {
      return <Mic className="w-4 h-4" />;
    }
    return <Volume2 className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <div className="spinner w-4 h-4" />
          <span className="text-sm">デバイスを検索中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="section-title">オーディオキャプチャ</span>
        <button
          onClick={loadDevices}
          disabled={disabled}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Capabilities info */}
      {capabilities && (
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${capabilities.wasapi_loopback ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {capabilities.wasapi_loopback ? '✓' : '✗'} WASAPI Loopback
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${capabilities.network_streaming ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {capabilities.network_streaming ? '✓' : '✗'} Network Streaming
          </span>
        </div>
      )}

      {/* WASAPI Loopback Toggle */}
      {capabilities?.wasapi_loopback && wasapiDevices.length > 0 && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-400">🎯 WASAPI Loopback（直接フック）</p>
              <p className="text-xs text-green-400/70 mt-1">
                VB-Cable不要でシステム音声を直接キャプチャ
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useWasapiLoopback}
                onChange={(e) => onWasapiLoopbackChange(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50" />
            </label>
          </div>
        </div>
      )}

      {/* WASAPI Loopback devices */}
      {useWasapiLoopback && wasapiDevices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            🔊 システム出力デバイス（WASAPI Loopback）
          </p>
          <div className="space-y-2">
            {wasapiDevices.map((device) => {
              const isSelected = selectedDevices.includes(device.index);
              return (
                <button
                  key={device.index}
                  onClick={() => toggleDevice(device.index)}
                  disabled={disabled}
                  className={`
                    w-full p-3 rounded-xl text-left transition-all duration-200
                    ${isSelected
                      ? 'bg-green-500/20 border-green-500'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                    }
                    border ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected ? 'bg-green-500 text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                    `}>
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-green-400' : 'text-[var(--text-primary)]'}`}>
                        {device.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {device.sample_rate}Hz • {device.channels}ch • WASAPI
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular input devices */}
      {!useWasapiLoopback && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            🎤 入力デバイス（マイク・仮想デバイス）
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {devices.filter(d => d.is_loopback || d.name.toLowerCase().includes('mic') || d.name.toLowerCase().includes('input')).map((device) => {
              const isSelected = selectedDevices.includes(device.index);
              return (
                <button
                  key={device.index}
                  onClick={() => toggleDevice(device.index)}
                  disabled={disabled}
                  className={`
                    w-full p-3 rounded-xl text-left transition-all duration-200
                    ${isSelected
                      ? 'bg-[var(--accent-glow)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                    }
                    border ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isSelected ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                    `}>
                      {getDeviceIcon(device)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                          {device.name}
                        </p>
                        {device.is_loopback && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            Loopback
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {device.sample_rate}Hz • {device.channels}ch • {device.host_api}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Network Receiver */}
      <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">ネットワーク受信</p>
              <p className="text-xs text-[var(--text-muted)]">
                別PCから音声を受信
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNetworkReceiver(!showNetworkReceiver)}
            disabled={disabled}
            className="text-xs text-[var(--accent-primary)] hover:underline disabled:opacity-50"
          >
            {showNetworkReceiver ? '閉じる' : '設定'}
          </button>
        </div>

        {showNetworkReceiver && networkInfo && (
          <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                受信ポート:
              </label>
              <input
                type="number"
                value={networkPort || ''}
                onChange={(e) => onNetworkPortChange(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="9999"
                disabled={disabled}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] disabled:opacity-50"
              />
            </div>

            {/* Connection Info Card - 接続情報カード */}
            {networkPort && networkInfo && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">接続情報</span>
                </div>
                
                <p className="text-xs text-blue-300/80 mb-3">
                  📡 このアドレスを同じネットワークの別PCに入力してください
                </p>
                
                {/* Connection String */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-blue-500/30 font-mono text-sm text-blue-300 select-all">
                    {networkInfo.ip_addresses[0]}:{networkPort}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${networkInfo.ip_addresses[0]}:${networkPort}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`
                      p-2.5 rounded-lg transition-all duration-200
                      ${copied 
                        ? 'bg-green-500 text-white' 
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      }
                    `}
                    title="コピー"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {copied && (
                  <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    クリップボードにコピーしました
                  </p>
                )}

                {/* Multiple IPs */}
                {networkInfo.ip_addresses.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-blue-500/20">
                    <p className="text-xs text-blue-300/60 mb-1">その他のIPアドレス:</p>
                    <div className="flex flex-wrap gap-1">
                      {networkInfo.ip_addresses.slice(1).map((ip) => (
                        <code 
                          key={ip} 
                          className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300/70 cursor-pointer hover:bg-blue-500/20"
                          onClick={() => {
                            navigator.clipboard.writeText(`${ip}:${networkPort}`);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                        >
                          {ip}:{networkPort}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hostname */}
                <div className="mt-3 pt-3 border-t border-blue-500/20">
                  <p className="text-xs text-blue-300/60">
                    ホスト名: <span className="text-blue-300">{networkInfo.hostname}</span>
                  </p>
                </div>
              </div>
            )}

            {!networkPort && (
              <p className="text-xs text-[var(--text-muted)]">
                💡 ポート番号を入力すると接続情報が表示されます
              </p>
            )}
          </div>
        )}
      </div>

      {/* Selected count */}
      {selectedDevices.length > 0 && (
        <p className="text-xs text-[var(--accent-primary)]">
          ✓ {selectedDevices.length}個のデバイスを選択中
          {networkPort && ' + ネットワーク受信'}
        </p>
      )}

      {/* Help text */}
      {!useWasapiLoopback && !capabilities?.wasapi_loopback && (
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)]">
            💡 <strong>システム音声をキャプチャするには:</strong>
            <br />
            <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">
              VB-Cable
            </a>
            をインストールし、Windows出力を「CABLE Input」に設定してください。
          </p>
        </div>
      )}
    </div>
  );
}
