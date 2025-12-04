'use client';

import { useStore } from '@/store/useStore';
import { AI_PROVIDERS } from '@/lib/constants';

export function Header() {
  const { settings } = useStore();
  
  const provider = AI_PROVIDERS.find(p => p.id === settings.selectedProvider);
  const model = provider?.models.find(m => m.id === settings.selectedModel);

  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">
          {/* タイトルは動的に変更可能 */}
        </h2>
      </div>
      
      <div className="flex items-center gap-3">
        {/* 現在のモデル表示 */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)]">
          <span className="text-sm">{provider?.icon}</span>
          <span className="text-sm text-[var(--text-secondary)]">{model?.name || 'モデル未選択'}</span>
        </div>
      </div>
    </header>
  );
}
