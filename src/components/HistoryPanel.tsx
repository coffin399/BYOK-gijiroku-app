'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { 
  Clock, Users, FileText, Trash2, Download, ChevronRight, ChevronLeft,
  CheckCircle2, Circle, ListTodo, Lightbulb, MessageSquare, Calendar, Headphones
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { MeetingMinutes } from '@/types';
import { AudioPlayer } from './AudioPlayer';
import { deleteAudio } from '@/lib/audio-storage';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (hrs > 0) {
    return `${hrs}時間${mins}分`;
  }
  return `${mins}分`;
}

function MinutesCard({ minutes, onSelect, onDelete }: { 
  minutes: MeetingMinutes; 
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div 
      className="group card card-interactive p-5"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
            {minutes.title}
          </h3>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(minutes.date), 'M/d', { locale: ja })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(minutes.date), 'HH:mm', { locale: ja })}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {minutes.participants.length}名
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${confirmDelete 
                ? 'bg-red-500/20 text-red-400' 
                : 'text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
              }
            `}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
        </div>
      </div>
      
      {minutes.summary && (
        <p className="mt-3 text-sm text-[var(--text-secondary)] line-clamp-2">
          {minutes.summary}
        </p>
      )}
      
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {minutes.keyPoints.length > 0 && (
          <span className="chip chip-accent flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            {minutes.keyPoints.length}
          </span>
        )}
        {minutes.actionItems.length > 0 && (
          <span className="chip chip-purple flex items-center gap-1">
            <ListTodo className="w-3 h-3" />
            {minutes.actionItems.length}
          </span>
        )}
        {minutes.decisions.length > 0 && (
          <span className="chip flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {minutes.decisions.length}
          </span>
        )}
        {/* Audio indicator */}
        {minutes.audioId && (
          <span className="chip flex items-center gap-1" title="音声あり">
            <Headphones className="w-3 h-3" />
          </span>
        )}
        {/* Speaker avatars */}
        <div className="flex -space-x-2 ml-auto">
          {minutes.participants.slice(0, 4).map((p) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full border-2 border-[var(--bg-secondary)]"
              style={{ backgroundColor: p.color }}
              title={p.name}
            />
          ))}
          {minutes.participants.length > 4 && (
            <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--bg-secondary)] flex items-center justify-center">
              <span className="text-[10px] text-[var(--text-muted)]">+{minutes.participants.length - 4}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MinutesDetail({ minutes, onBack }: { minutes: MeetingMinutes; onBack: () => void }) {
  const { updateMinutes } = useStore();
  const [audioError, setAudioError] = useState<string | null>(null);

  const toggleActionItem = (itemId: string) => {
    const updatedItems = minutes.actionItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateMinutes(minutes.id, { actionItems: updatedItems });
  };

  const exportToMarkdown = () => {
    const md = `# ${minutes.title}

📅 日時: ${format(new Date(minutes.date), 'yyyy年M月d日 HH:mm', { locale: ja })}
⏱️ 所要時間: ${formatDuration(minutes.duration)}
👥 参加者: ${minutes.participants.map(p => p.name).join(', ')}

## 概要
${minutes.summary}

## 重要ポイント
${minutes.keyPoints.map(p => `- ${p}`).join('\n')}

## 決定事項
${minutes.decisions.map(d => `- ${d}`).join('\n')}

## アクションアイテム
${minutes.actionItems.map(item => `- [${item.completed ? 'x' : ' '}] ${item.description}${item.assignee ? ` (@${item.assignee})` : ''}`).join('\n')}

## 発言録
${minutes.transcript.segments.map(seg => {
  const speaker = minutes.transcript.speakers.find(s => s.id === seg.speakerId);
  return `**${speaker?.name || '不明'}**: ${seg.text}`;
}).join('\n\n')}
`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${minutes.title.replace(/[/\\?%*:|"<>]/g, '-')}_${format(new Date(minutes.date), 'yyyyMMdd')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--border-color)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{minutes.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-muted)]">
              <span>{format(new Date(minutes.date), 'yyyy年M月d日 HH:mm', { locale: ja })}</span>
              <span>•</span>
              <span>{formatDuration(minutes.duration)}</span>
            </div>
          </div>
        </div>
        <button onClick={exportToMarkdown} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          エクスポート
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6 stagger">
          {/* Participants */}
          <div className="flex items-center gap-2 flex-wrap">
            {minutes.participants.map((participant) => (
              <span
                key={participant.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)]"
              >
                <span className="speaker-dot" style={{ backgroundColor: participant.color }} />
                <span className="text-sm text-[var(--text-secondary)]">{participant.name}</span>
              </span>
            ))}
          </div>

          {/* Audio Player */}
          {minutes.audioId && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <Headphones className="w-5 h-5 text-[var(--accent-primary)]" />
                録音音声
              </h3>
              <AudioPlayer 
                audioId={minutes.audioId} 
                filename={`${minutes.title.replace(/[/\\?%*:|"<>]/g, '-')}_${format(new Date(minutes.date), 'yyyyMMdd_HHmm')}`}
                onError={setAudioError}
              />
              {audioError && (
                <p className="text-xs text-red-400">{audioError}</p>
              )}
            </section>
          )}

          {/* Summary */}
          <section className="p-6 rounded-2xl card">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-3">
              <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
              概要
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">{minutes.summary}</p>
          </section>

          {/* Key Points */}
          {minutes.keyPoints.length > 0 && (
            <section className="p-6 rounded-2xl card">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-4">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                重要ポイント
              </h3>
              <ul className="space-y-3">
                {minutes.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[var(--text-secondary)]">
                    <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                      {idx + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Decisions */}
          {minutes.decisions.length > 0 && (
            <section className="p-6 rounded-2xl card">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-4">
                <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)]" />
                決定事項
              </h3>
              <ul className="space-y-3">
                {minutes.decisions.map((decision, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[var(--text-secondary)]">
                    <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                    {decision}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Action Items */}
          {minutes.actionItems.length > 0 && (
            <section className="p-6 rounded-2xl card">
              <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-4">
                <ListTodo className="w-5 h-5 text-[var(--accent-purple)]" />
                アクションアイテム
              </h3>
              <ul className="space-y-3">
                {minutes.actionItems.map((item) => (
                  <li 
                    key={item.id} 
                    className="flex items-start gap-3 cursor-pointer group p-2 -mx-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                    onClick={() => toggleActionItem(item.id)}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-purple)] flex-shrink-0 mt-0.5 transition-colors" />
                    )}
                    <div className={item.completed ? 'opacity-50' : ''}>
                      <p className={`text-[var(--text-secondary)] ${item.completed ? 'line-through' : ''}`}>
                        {item.description}
                      </p>
                      {item.assignee && (
                        <span className="text-xs text-[var(--text-muted)]">担当: {item.assignee}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Transcript */}
          <section className="p-6 rounded-2xl card">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-4">
              <MessageSquare className="w-5 h-5 text-[var(--accent-primary)]" />
              発言録
            </h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {minutes.transcript.segments.map((segment) => {
                const speaker = minutes.transcript.speakers.find(s => s.id === segment.speakerId);
                return (
                  <div key={segment.id} className="flex gap-3">
                    <span 
                      className="speaker-dot mt-2 flex-shrink-0" 
                      style={{ backgroundColor: speaker?.color || '#64748b' }}
                    />
                    <div>
                      <span className="text-sm font-medium" style={{ color: speaker?.color || '#64748b' }}>
                        {speaker?.name || '不明'}
                      </span>
                      <p className="text-[var(--text-secondary)] mt-1">{segment.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const { minutes, currentMinutes, setCurrentMinutes, deleteMinutes } = useStore();

  const handleDelete = async (m: MeetingMinutes) => {
    // 音声データも削除
    if (m.audioId) {
      try {
        await deleteAudio(m.audioId);
      } catch (e) {
        console.error('Failed to delete audio:', e);
      }
    }
    deleteMinutes(m.id);
  };

  if (currentMinutes) {
    return <MinutesDetail minutes={currentMinutes} onBack={() => setCurrentMinutes(null)} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[var(--border-color)]">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">議事録一覧</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {minutes.length}件の議事録
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {minutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
              <FileText className="w-10 h-10 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-secondary)]">議事録がありません</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              録音を開始して、最初の議事録を作成しましょう
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4 stagger">
            {minutes.map((m) => (
              <MinutesCard
                key={m.id}
                minutes={m}
                onSelect={() => setCurrentMinutes(m)}
                onDelete={() => handleDelete(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
