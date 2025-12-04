'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, Check, Bot, Sparkles, Brain, Smile, Server, Cpu, Zap, CheckCircle2, XCircle, Send } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { AI_PROVIDERS, WHISPER_MODELS } from '@/lib/constants';
import { AIProvider } from '@/types';
import { checkBackendHealth } from '@/lib/backend-api';
import { NetworkAudioSender } from './NetworkAudioSender';

export function SettingsPanel() {
  const { settings, updateSettings, setAPIKey, updateLocalLLM, updateBackend } = useStore();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // バックエンドの状態を確認
  useEffect(() => {
    async function checkBackend() {
      if (settings.backend.enabled) {
        setBackendStatus('checking');
        const isOnline = await checkBackendHealth();
        setBackendStatus(isOnline ? 'online' : 'offline');
      }
    }
    checkBackend();
    const interval = setInterval(checkBackend, 10000); // 10秒ごとに確認
    return () => clearInterval(interval);
  }, [settings.backend.enabled, settings.backend.url]);

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleKeyChange = (provider: AIProvider, value: string) => {
    setAPIKey(provider, value);
    setSavedKeys((prev) => ({ ...prev, [provider]: false }));
  };

  const handleKeySave = (provider: string) => {
    setSavedKeys((prev) => ({ ...prev, [provider]: true }));
    setTimeout(() => {
      setSavedKeys((prev) => ({ ...prev, [provider]: false }));
    }, 2000);
  };

  const providerIcons: Record<string, typeof Bot> = {
    huggingface: Smile,
    openai: Bot,
    gemini: Sparkles,
    anthropic: Brain,
    ollama: Server,
    koboldcpp: Cpu,
  };

  // 音声認識とLLM用にプロバイダーを分類
  const sttProviders = AI_PROVIDERS.filter(p => p.id === 'huggingface' || p.id === 'openai');
  const cloudLLMProviders = AI_PROVIDERS.filter(p => !p.isLocal && p.id !== 'huggingface');
  const localLLMProviders = AI_PROVIDERS.filter(p => p.isLocal);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--border-color)]">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">設定</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          BYOK（Bring Your Own Key）またはローカルLLMで議事録を生成
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl mx-auto space-y-10 stagger">
          {/* STT (音声認識) Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-[var(--accent-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">音声認識 (STT)</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              日本語特化の<span className="text-[var(--accent-primary)]">kotoba-whisper</span>を推奨
            </p>

            <div className="space-y-3">
              {sttProviders.map((provider) => {
                const Icon = providerIcons[provider.id] || Key;
                const currentKey = settings.apiKeys[provider.id] || '';
                const isRecommended = provider.id === 'huggingface';
                
                return (
                  <div
                    key={provider.id}
                    className={`
                      p-5 rounded-2xl transition-all duration-200 card
                      ${isRecommended ? 'border-[var(--accent-primary)]/30' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-xl flex items-center justify-center
                          ${isRecommended ? 'bg-[var(--accent-glow)] text-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[var(--text-primary)]">{provider.name}</h3>
                            {isRecommended && (
                              <span className="chip chip-accent">推奨</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {provider.id === 'huggingface' ? 'kotoba-whisper-v2.2-faster' : 'Whisper API'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type={showKeys[provider.id] ? 'text' : 'password'}
                        value={currentKey}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        placeholder={`${provider.name} APIキーを入力`}
                        className="input-field pr-24"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          onClick={() => toggleShowKey(provider.id)}
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleKeySave(provider.id)}
                          disabled={!currentKey}
                          className={`
                            p-2 rounded-lg transition-all duration-200
                            ${savedKeys[provider.id] 
                              ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]' 
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                            }
                            disabled:opacity-50
                          `}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cloud LLM Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[var(--accent-purple)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">クラウドLLM (BYOK)</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              話者識別と議事録生成に使用するクラウドAIモデル
            </p>

            <div className="space-y-3">
              {cloudLLMProviders.map((provider) => {
                const Icon = providerIcons[provider.id] || Key;
                const currentKey = settings.apiKeys[provider.id] || '';
                const isSelected = settings.selectedProvider === provider.id;
                
                return (
                  <div
                    key={provider.id}
                    className={`
                      p-5 rounded-2xl transition-all duration-200 card
                      ${isSelected ? 'border-[var(--accent-purple)]/30 bg-[var(--bg-tertiary)]' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-xl flex items-center justify-center
                          ${isSelected ? 'bg-[rgba(197,138,249,0.15)] text-[var(--accent-purple)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-[var(--text-primary)]">{provider.name}</h3>
                          <p className="text-xs text-[var(--text-muted)]">{provider.icon}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateSettings({ selectedProvider: provider.id })}
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                          ${isSelected 
                            ? 'bg-[var(--accent-purple)] text-[var(--bg-primary)]' 
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                          }
                        `}
                      >
                        {isSelected ? '選択中' : '選択'}
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <input
                          type={showKeys[provider.id] ? 'text' : 'password'}
                          value={currentKey}
                          onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                          placeholder={`${provider.name} APIキーを入力`}
                          className="input-field pr-24"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            onClick={() => toggleShowKey(provider.id)}
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          >
                            {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleKeySave(provider.id)}
                            disabled={!currentKey}
                            className={`
                              p-2 rounded-lg transition-all duration-200
                              ${savedKeys[provider.id] 
                                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]' 
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                              }
                              disabled:opacity-50
                            `}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Model Selection */}
                      {isSelected && (
                        <div className="space-y-2">
                          <span className="section-title">モデル選択</span>
                          <div className="grid grid-cols-2 gap-2">
                            {provider.models.map((model) => (
                              <button
                                key={model.id}
                                onClick={() => updateSettings({ selectedModel: model.id })}
                                className={`
                                  p-3 rounded-xl text-left transition-all duration-200
                                  ${settings.selectedModel === model.id 
                                    ? 'bg-[rgba(197,138,249,0.15)] border-[var(--accent-purple)]/30' 
                                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                                  }
                                  border
                                `}
                              >
                                <span className={`
                                  text-sm font-medium
                                  ${settings.selectedModel === model.id ? 'text-[var(--accent-purple)]' : 'text-[var(--text-secondary)]'}
                                `}>
                                  {model.name}
                                </span>
                                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">{model.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Local LLM Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-green-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">ローカルLLM</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              APIキー不要。ローカルで動作するLLMを使用
            </p>

            <div className="space-y-3">
              {localLLMProviders.map((provider) => {
                const Icon = providerIcons[provider.id] || Server;
                const isSelected = settings.selectedProvider === provider.id;
                const isOllama = provider.id === 'ollama';
                
                return (
                  <div
                    key={provider.id}
                    className={`
                      p-5 rounded-2xl transition-all duration-200 card
                      ${isSelected ? 'border-green-500/30 bg-[var(--bg-tertiary)]' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-xl flex items-center justify-center
                          ${isSelected ? 'bg-green-500/15 text-green-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}
                        `}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-[var(--text-primary)]">{provider.name}</h3>
                            <span className="chip">ローカル</span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">{provider.icon} APIキー不要</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateSettings({ selectedProvider: provider.id })}
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                          ${isSelected 
                            ? 'bg-green-500 text-[var(--bg-primary)]' 
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                          }
                        `}
                      >
                        {isSelected ? '選択中' : '選択'}
                      </button>
                    </div>

                    {isSelected && (
                      <div className="space-y-4">
                        {/* URL Setting */}
                        <div className="space-y-2">
                          <label className="section-title">エンドポイントURL</label>
                          <input
                            type="text"
                            value={isOllama ? settings.localLLM.ollamaUrl : settings.localLLM.koboldcppUrl}
                            onChange={(e) => updateLocalLLM(
                              isOllama 
                                ? { ollamaUrl: e.target.value }
                                : { koboldcppUrl: e.target.value }
                            )}
                            placeholder={isOllama ? 'http://localhost:11434' : 'http://localhost:5001'}
                            className="input-field"
                          />
                        </div>

                        {/* Model Selection for Ollama */}
                        {isOllama && (
                          <div className="space-y-2">
                            <label className="section-title">モデル選択</label>
                            <div className="grid grid-cols-2 gap-2">
                              {provider.models.map((model) => (
                                <button
                                  key={model.id}
                                  onClick={() => updateLocalLLM({ ollamaModel: model.id })}
                                  className={`
                                    p-3 rounded-xl text-left transition-all duration-200
                                    ${settings.localLLM.ollamaModel === model.id 
                                      ? 'bg-green-500/15 border-green-500/30' 
                                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]'
                                    }
                                    border
                                  `}
                                >
                                  <span className={`
                                    text-sm font-medium
                                    ${settings.localLLM.ollamaModel === model.id ? 'text-green-400' : 'text-[var(--text-secondary)]'}
                                  `}>
                                    {model.name}
                                  </span>
                                  <p className="text-xs text-[var(--text-muted)] mt-1">{model.description}</p>
                                </button>
                              ))}
                            </div>
                            <div className="mt-2">
                              <input
                                type="text"
                                value={settings.localLLM.ollamaModel}
                                onChange={(e) => updateLocalLLM({ ollamaModel: e.target.value })}
                                placeholder="カスタムモデル名を入力"
                                className="input-field"
                              />
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                ollama listで確認できるモデル名を入力
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Other Settings */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">その他の設定</h2>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-4 rounded-xl card">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">話者識別</span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">AIを使って発言者を自動識別</p>
                </div>
                <button
                  onClick={() => updateSettings({ speakerDiarization: !settings.speakerDiarization })}
                  className={`toggle ${settings.speakerDiarization ? 'toggle-active' : ''}`}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl card">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">自動保存</span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">議事録を自動的に保存</p>
                </div>
                <button
                  onClick={() => updateSettings({ autoSave: !settings.autoSave })}
                  className={`toggle ${settings.autoSave ? 'toggle-active' : ''}`}
                >
                  <div className="toggle-knob" />
                </button>
              </div>
            </div>
          </section>

          {/* Backend Settings */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Pythonバックエンド</h2>
              {settings.backend.enabled && (
                <span className={`chip ${backendStatus === 'online' ? 'chip-accent' : backendStatus === 'offline' ? 'bg-red-500/15 text-red-400' : ''}`}>
                  {backendStatus === 'checking' ? '確認中...' : backendStatus === 'online' ? 'オンライン' : 'オフライン'}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              ローカルで高精度な音声認識・話者識別を実行（GPU推奨）
            </p>

            <div className="p-5 rounded-2xl card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.backend.enabled ? 'bg-yellow-500/15 text-yellow-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--text-primary)]">バックエンドを使用</h3>
                    <p className="text-xs text-[var(--text-muted)]">faster-whisper + pyannote.audio</p>
                  </div>
                </div>
                <button
                  onClick={() => updateBackend({ enabled: !settings.backend.enabled })}
                  className={`toggle ${settings.backend.enabled ? 'toggle-active' : ''}`}
                >
                  <div className="toggle-knob" />
                </button>
              </div>

              {settings.backend.enabled && (
                <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
                  {/* Backend URL */}
                  <div className="space-y-2">
                    <label className="section-title">バックエンドURL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settings.backend.url}
                        onChange={(e) => updateBackend({ url: e.target.value })}
                        placeholder="http://localhost:8000"
                        className="input-field flex-1"
                      />
                      {backendStatus === 'online' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : backendStatus === 'offline' ? (
                        <XCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <div className="spinner w-5 h-5" />
                      )}
                    </div>
                  </div>

                  {/* Whisper Model - kotoba-whisper固定 */}
                  <div className="space-y-2">
                    <label className="section-title">音声認識モデル</label>
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-400">
                          🎯 Kotoba Whisper v2.2
                        </span>
                        <span className="text-xs text-green-400/70">~10GB VRAM</span>
                      </div>
                      <p className="text-xs text-green-400/70 mb-3">
                        日本語特化・超高速（CTranslate2最適化）
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {['日本語特化', 'ホットワード対応', 'VADフィルタ', '単語タイムスタンプ'].map((feature) => (
                          <span key={feature} className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                            {feature}
                          </span>
                        ))}
                      </div>
                      <a 
                        href="https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-green-400 hover:underline mt-2 inline-block"
                      >
                        HuggingFaceで詳細を見る →
                      </a>
                    </div>
                  </div>

                  {/* Diarization */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)]">
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">ローカル話者識別</span>
                      <p className="text-xs text-[var(--text-muted)]">pyannote.audio使用（HFトークン必要）</p>
                    </div>
                    <button
                      onClick={() => updateBackend({ useLocalDiarization: !settings.backend.useLocalDiarization })}
                      className={`toggle ${settings.backend.useLocalDiarization ? 'toggle-active' : ''}`}
                    >
                      <div className="toggle-knob" />
                    </button>
                  </div>

                  {backendStatus === 'offline' && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-400">
                        バックエンドに接続できません。<br/>
                        <code className="bg-[var(--bg-tertiary)] px-1 rounded">start.bat</code> を実行してください。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Network Audio Sender */}
          {settings.backend.enabled && backendStatus === 'online' && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">ネットワーク音声送信</h2>
              </div>
              <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                <NetworkAudioSender />
              </div>
            </section>
          )}

          {/* Info */}
          <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">🔐 プライバシーについて</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              • <strong>BYOK</strong>: あなた自身のAPIキーを使用。キーはブラウザのローカルストレージにのみ保存されます。<br/>
              • <strong>ローカルLLM</strong>: データは外部に送信されません。完全にローカルで処理されます。<br/>
              • <strong>Pythonバックエンド</strong>: 音声認識・話者識別を完全ローカルで実行。<br/>
              • 中間サーバーを経由しないため、データの安全性が確保されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
