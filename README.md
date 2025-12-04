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
| **音声認識** | kotoba-whisper-v2.2-faster (CTranslate2) |
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
| `openbrowser.bat` | localhost:3000をブラウザで開く |

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

### 音声認識モデル（kotoba-whisper-v2.2-faster専用）

| モデル | 必要VRAM | 特徴 |
|-------|----------|------|
| **Kotoba Whisper v2.2** | ~10GB | 日本語特化・超高速・CTranslate2最適化 |

**機能:**
- 🇯🇵 日本語に特化した高精度認識
- ⚡ CTranslate2による超高速推論
- 🎯 ホットワード対応（固有名詞の認識精度向上）
- 🔇 VADフィルタリング（無音区間の自動除去）
- ⏱️ 単語レベルタイムスタンプ

**モデルダウンロード:**
初回起動時に自動でダウンロードされます（約10GB）。

手動でダウンロードする場合:
```bash
cd backend
python setup_model.py
```

HuggingFace: [RoachLin/kotoba-whisper-v2.2-faster](https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster)

**推奨設定（自動適用）:**
```python
chunk_length=5
condition_on_previous_text=False
beam_size=5
language="ja"
```

## 🌐 ブラウザ対応

| ブラウザ | マイク | システム音声 | WASAPI Loopback | ネットワーク受信 |
|---------|--------|-------------|-----------------|----------------|
| Chrome | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ❌ | ✅ | ✅ |
| Safari | ✅ | ❌ | ✅ | ✅ |

### システム音声キャプチャ方法

#### 方法1: WASAPI Loopback（推奨・VB-Cable不要）
1. バックエンドキャプチャを有効化
2. 「WASAPI Loopback」をON
3. スピーカー/ヘッドホンの出力デバイスを選択
4. 録音開始 → システム音声を直接キャプチャ！

#### 方法2: VB-Cable経由
1. [VB-Cable](https://vb-audio.com/Cable/)をインストール
2. Windowsの「サウンド設定」→「出力」で「CABLE Input」を選択
3. デバイス一覧から「CABLE Output」を選択して録音

### 別PCからの音声転送（ローカルネットワーク）

複数PCの音声を1台に集約して録音できます。

> ⚠️ **ポート開放は不要です！** 同じWiFi/LAN内であれば、ルーターのポート開放なしで通信できます。

**受信側（メインPC）:**
1. 録音画面で「バックエンドキャプチャ」を有効化
2. 「ネットワーク受信」でポート番号を設定（例: 9999）
3. 表示された接続情報（`192.168.x.x:9999`）をコピー
4. 録音開始

**送信側（サブPC）:**
1. 設定画面の「ネットワーク音声送信」を開く
2. 送信するデバイス（マイク or WASAPI Loopback）を選択
3. 受信側PCの接続情報を貼り付け
4. 送信開始

## 📁 プロジェクト構成

```
├── start.bat / stop.bat      # 起動スクリプト
├── openbrowser.bat           # ブラウザを開くだけ
├── prompts.yaml              # カスタマイズ可能なプロンプト
├── backend/                  # Pythonバックエンド
│   ├── main.py              # FastAPIエントリポイント
│   ├── prompts.yaml         # バックエンド用プロンプト
│   └── services/            # サービス層
│       ├── transcription.py # kotoba-whisper-v2.2-faster
│       ├── diarization.py   # pyannote.audio
│       ├── summarization.py # LLM統合
│       ├── prompt_loader.py # YAMLプロンプトローダー
│       ├── audio_capture.py # WASAPI Loopback + ネットワーク受信
│       └── audio_sender.py  # ネットワーク音声送信
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

- [kotoba-whisper-v2.2-faster](https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster) - 日本語特化音声認識モデル
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - CTranslate2ベースの高速Whisper
- [CTranslate2](https://github.com/OpenNMT/CTranslate2) - 高速推論エンジン
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) - 話者識別ライブラリ
- [Ollama](https://ollama.ai/) - ローカルLLM実行環境
