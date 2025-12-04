'use client';

import { Mic, History, Settings, FileText, Plus, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export function Sidebar() {
  const { activeTab, setActiveTab, minutes, currentMinutes, setCurrentMinutes } = useStore();

  const navItems = [
    { id: 'record' as const, label: '新規録音', icon: Plus },
    { id: 'history' as const, label: '議事録一覧', icon: FileText },
    { id: 'settings' as const, label: '設定', icon: Settings },
  ];

  return (
    <aside className="w-72 h-screen bg-surface flex flex-col border-r border-[var(--border-color)]">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-purple)] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[var(--bg-primary)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">GIJIROKU</h1>
            <p className="text-xs text-[var(--text-muted)]">AI議事録作成</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'record') setCurrentMinutes(null);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                transition-all duration-200
                ${isActive 
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--accent-primary)]' : ''}`} />
              {item.label}
              {item.id === 'record' && isActive && (
                <span className="ml-auto">
                  <Mic className="w-4 h-4 text-[var(--accent-primary)]" />
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Recent Minutes */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-5 py-3">
          <span className="section-title">最近の議事録</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {minutes.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--text-muted)]">
              議事録がありません
            </p>
          ) : (
            minutes.slice(0, 10).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setCurrentMinutes(m);
                  setActiveTab('history');
                }}
                className={`
                  w-full text-left px-4 py-3 rounded-xl transition-all duration-200
                  ${currentMinutes?.id === m.id 
                    ? 'bg-[var(--bg-tertiary)] border-l-2 border-[var(--accent-primary)]' 
                    : 'hover:bg-[var(--bg-tertiary)]'
                  }
                `}
              >
                <p className={`text-sm font-medium truncate ${currentMinutes?.id === m.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {m.title}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {format(new Date(m.date), 'M/d HH:mm', { locale: ja })}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* BYOK Badge */}
      <div className="p-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-full bg-[var(--accent-glow)]">
          <span className="text-xs font-medium text-[var(--accent-primary)]">🔐 BYOK対応</span>
        </div>
      </div>
    </aside>
  );
}

