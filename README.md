# GIJIROKU - AI議事録作成アプリ 📝

音声から自動で議事録を作成するWebアプリケーションです。  
**Pythonバックエンド**でGPU対応のローカル音声認識・話者識別を実行可能。

![GIJIROKU](https://img.shields.io/badge/GIJIROKU-AI%E8%AD%B0%E4%BA%8B%E9%8C%B2-a8c7fa)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)

## ✨ 主な機能

### 🎙️ 音声録音・キャプチャ
- **マイク録音**: 自分の声を録音
- **システム音声キャプチャ**: Zoom、Teams等の音声をキャプチャ（Chrome/Edge）
- **両方**: マイクとシステム音声を同時に録音

### 🗣️ 音声認識
| モード | エンジン | 特徴 |
|-------|---------|------|
| **ローカル（推奨）** | faster-whisper | GPU対応、高速、オフライン動作 |
| **クラウド** | kotoba-whisper (HF) | 日本語特化 |
| **クラウド** | OpenAI Whisper | 高精度、多言語対応 |

### 👥 話者識別（Speaker Diarization）
| モード | エンジン | 特徴 |
|-------|---------|------|
| **ローカル（推奨）** | pyannote.audio 4.0 | 声の特徴で識別、高精度 |
| **クラウド** | LLMベース | テキストから推定 |

### 📋 議事録自動生成
- 会議の概要
- 重要ポイント
- 決定事項
- アクションアイテム（担当者付き）
- 完全な発言録

### 🎧 音声保存・再生機能
- 録音音声をIndexedDBに自動保存
- 履歴から音声を再生（速度調整、シーク対応）
- ダウンロードしてNotebookLMにアップロード可能

### 🔐 BYOK + ローカルLLM対応

#### クラウドAI（BYOK）
| プロバイダー | 用途 | モデル |
|------------|------|-------|
| **Hugging Face** 🤗 | 音声認識 | kotoba-whisper-v2.2 |
| **OpenAI** 🤖 | 音声認識 / LLM | Whisper, GPT-5.1, GPT-4o |
| **Google Gemini** ✨ | LLM | Gemini 3.0 Pro, 2.5 Pro/Flash |
| **Anthropic Claude** 🎭 | LLM | Claude Opus 4.5, Sonnet 4.5 |

#### ローカルLLM（APIキー不要）
| プロバイダー | 説明 |
|------------|------|
| **Ollama** 🦙 | Llama 3.2, Gemma 2, Qwen 2.5など |
| **KoboldCpp** 🐉 | GGUFカスタムモデル |

## 🛠️ 技術スタック

### フロントエンド
| カテゴリ | 技術 |
|---------|------|
| **フレームワーク** | Next.js 14 (App Router) |
| **言語** | TypeScript 5.6 |
| **スタイリング** | Tailwind CSS 3.4 |
| **状態管理** | Zustand 5.0 |
| **アイコン** | Lucide React |

### バックエンド（Python）
| カテゴリ | 技術 |
|---------|------|
| **フレームワーク** | FastAPI 0.115 |
| **音声認識** | faster-whisper 1.0 |
| **話者識別** | pyannote.audio 4.0.2 |
| **GPU対応** | PyTorch 2.0+ (CUDA) |

## 🚀 クイックスタート

### 必要条件
- Node.js 18以上
- Python 3.10以上（バックエンド使用時）
- CUDA対応GPU（推奨、CPUでも動作可）

### インストール

```bash
git clone https://github.com/yourusername/BYOK-gijiroku-app.git
cd BYOK-gijiroku-app
```

### 起動方法

```batch
# 全サービス起動（フロントエンド + バックエンド）
start.bat

# 全サービス停止
stop.bat
```

| バッチファイル | 説明 |
|--------------|------|
| `start.bat` | フロントエンド + バックエンド起動、ブラウザを開く |
| `stop.bat` | 全サービス停止 |

## 📖 使い方

### 1. APIキーの設定（クラウドモード）
1. サイドバーの「設定」をクリック
2. **音声認識**: Hugging Face APIキーを入力
3. **LLM**: 使用したいプロバイダーのAPIキーを入力

### 2. Pythonバックエンドの設定（ローカルモード・推奨）
1. `start.bat` でバックエンドが自動起動
2. 設定画面で「Pythonバックエンド」を有効化
3. GPUのVRAMに応じてWhisperモデルを選択

> ⚠️ **pyannote.audio使用時**: [Hugging Faceでライセンスに同意](https://huggingface.co/pyannote/speaker-diarization-3.1)し、環境変数`HF_TOKEN`にトークンを設定してください。

### 3. 録音
1. 音声ソースを選択（マイク / システム音声 / 両方）
2. 録音ボタンをクリック
3. 停止ボタンで録音終了

### 4. 議事録の確認
録音終了後、自動的に処理されます：
1. 🎤 音声の文字起こし
2. 👥 話者識別
3. 📋 議事録生成

## 🔧 カスタマイズ

### システムプロンプト
`prompts.yaml` を編集してAIの挙動をカスタマイズ：

```yaml
system:
  role: |
    カスタムシステムプロンプト...

meeting_summary:
  prompt: |
    カスタム要約プロンプト...
```

### Whisperモデル
| モデル | 必要VRAM | 速度 |
|-------|----------|------|
| tiny | ~1GB | 最速 |
| base | ~1GB | 高速 |
| small | ~2GB | 普通 |
| medium | ~5GB | やや遅い |
| large-v3 | ~10GB | 最高精度 |
| kotoba-v2.2 | ~10GB | 日本語特化・超高速|

kotoba-whisperダウンロード: [RoachLin/kotoba-whisper-v2.2-faster](https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster)

## 🌐 ブラウザ対応

| ブラウザ | マイク | システム音声 |
|---------|--------|-------------|
| Chrome | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Firefox | ✅ | ❌（マイクのみ） |
| Safari | ✅ | ❌ |

## 📁 プロジェクト構成

```
├── start.bat / stop.bat      # 起動スクリプト
├── prompts.yaml              # カスタマイズ可能なプロンプト
├── backend/                  # Pythonバックエンド
│   ├── main.py              # FastAPIエントリポイント
│   ├── prompts.yaml         # バックエンド用プロンプト
│   └── services/            # サービス層
│       ├── transcription.py # faster-whisper
│       ├── diarization.py   # pyannote.audio
│       ├── summarization.py # LLM統合
│       └── prompt_loader.py # YAMLプロンプトローダー
├── src/                     # Next.jsフロントエンド
│   ├── app/                 # App Router
│   ├── components/          # UIコンポーネント
│   ├── hooks/               # カスタムフック
│   ├── lib/                 # ユーティリティ
│   └── store/               # 状態管理
└── README.md
```

## 🔒 プライバシー

- **ローカルモード**: 音声データは完全にローカルで処理
- **クラウドモード**: データは直接AIプロバイダーに送信
- 中間サーバーを経由しないため安全

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

IssueやPull Requestを歓迎します！

## 📚 参考リンク

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - 高速Whisper実装
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) - 話者識別ライブラリ
- [kotoba-whisper](https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster) - 日本語特化モデル
- [Ollama](https://ollama.ai/) - ローカルLLM実行環境
