'use client';

import { Sidebar } from '@/components/Sidebar';
import { RecordingPanel } from '@/components/RecordingPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useStore } from '@/store/useStore';

export default function Home() {
  const { activeTab } = useStore();

  return (
    <div className="h-screen flex bg-notebook overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden animate-fade-in">
        {activeTab === 'record' && <RecordingPanel />}
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}
