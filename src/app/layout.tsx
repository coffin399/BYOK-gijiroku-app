import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GIJIROKU - AI議事録作成アプリ',
  description: '音声から自動で議事録を作成。話者識別機能付き。BYOK対応でお好みのAIを使用可能。',
  keywords: ['議事録', '音声認識', 'AI', 'Whisper', 'GPT', 'Gemini', '話者識別'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-mesh min-h-screen">
        {children}
      </body>
    </html>
  );
}

