# GIJIROKU - AI議事録作成アプリ 📝

音声から自動で議事録を作成するWebアプリケーションです。  
**完全ローカル動作対応** - 音声認識・話者識別をGPU対応でローカル実行。APIキー不要で動作可能。

![GIJIROKU](https://img.shields.io/badge/GIJIROKU-AI%E8%AD%B0%E4%BA%8B%E9%8C%B2-a8c7fa)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)

## ✨ 主な機能

### 🎙️ 音声録音・キャプチャ
- **マイク録音**: 自分の声を録音
- **システム音声キャプチャ**: Zoom、Teams等の音声をキャプチャ
- **WASAPI Loopback**: VB-Cable不要でシステム音声を直接キャプチャ
- **ネットワーク転送**: 別PCの音声をリアルタイムで受信

### 🗣️ 音声認識（ローカル動作）
| エンジン | 特徴 |
|---------|------|
| **kotoba-whisper-v2.2-faster** | 日本語特化・超高速・完全ローカル動作 |
| **Web Speech API（リアルタイム）** | 録音中に仮文字起こしを表示 |

> 💡 kotoba-whisperは**完全にローカルで動作**します。インターネット接続は初回のモデルダウンロード時のみ必要です。
>
> 📝 録音中はWeb Speech APIで**リアルタイム仮文字起こし**を表示。停止後にkotoba-whisperで高精度版に置き換わります。

### 👥 話者識別（ローカル動作）
| エンジン | 特徴 |
|---------|------|
| **pyannote.audio 3.1** | 声紋ベース識別・高精度・ローカル動作 |

**話者識別の仕組み:**
```
音声ファイル
    ↓
pyannote.audio（声紋分析）
    ↓
「誰がいつ話したか」をタイムスタンプ付きで特定
    ↓
kotoba-whisperの文字起こし結果と結合
    ↓
「話者1: こんにちは」「話者2: よろしくお願いします」
```

> ⚠️ **pyannote.audioの初回セットアップ:**
> 1. [Hugging Faceでライセンスに同意](https://huggingface.co/pyannote/speaker-diarization-3.1)
> 2. [Hugging Faceトークンを取得](https://huggingface.co/settings/tokens)
> 3. 設定画面の「Pythonバックエンド」→「Hugging Faceトークン」に入力
> 4. **モデルダウンロード後はトークン不要**（完全オフライン動作）

### 📋 議事録自動生成(要ローカルLLM/BYOK)
- 会議の概要
- 重要ポイント
- 決定事項
- アクションアイテム（担当者付き）
- 完全な発言録

### 🎧 音声保存・再生機能
- 録音音声をIndexedDBに自動保存
- 履歴から音声を再生（速度調整、シーク対応）
- ダウンロードしてNotebookLMにアップロード可能

### 🔐 LLM対応（要約生成用）

#### ローカルLLM（APIキー不要・推奨）
| プロバイダー | 説明 |
|------------|------|
| **Ollama** 🦙 | Llama 3.2, Gemma 2, Qwen 2.5など |
| **KoboldCpp** 🐉 | GGUFカスタムモデル |

#### クラウドAI（BYOK）
| プロバイダー | モデル |
|------------|-------|
| **OpenAI** 🤖 | GPT-5.1, GPT-4o |
| **Google Gemini** ✨ | Gemini 3.0 Pro, 2.5 Pro/Flash |
| **Anthropic Claude** 🎭 | Claude Opus 4.5, Sonnet 4.5 |

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
| **音声認識** | kotoba-whisper-v2.2-faster (ローカル) |
| **話者識別** | pyannote.audio 3.1 (ローカル) |
| **GPU対応** | PyTorch 2.0+ (CUDA) |

## 🚀 クイックスタート

### 必要条件
- Node.js 18以上
- **Python 3.10 または 3.11** （3.12以降は非推奨、pyannote.audioの互換性問題）
- CUDA対応GPU（推奨、CPUでも動作可）
- 初回のみインターネット接続（モデルダウンロード用）

> ⚠️ **Python 3.12以降は非推奨**: pyannote.audio 4.0は3.10-3.11での動作が安定しています。

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

### 初回起動時
初回起動時に以下が自動で行われます：
1. Python仮想環境の作成
2. 依存関係のインストール
3. **kotoba-whisper-v2.2-fasterのダウンロード（約10GB）**

> 💡 2回目以降はダウンロード済みモデルを使用するため、オフラインでも動作します。

## 📖 使い方

### 1. 録音
1. 音声ソースを選択（マイク / システム音声 / 両方）
2. 録音ボタンをクリック
3. 停止ボタンで録音終了

### 2. 議事録の確認
録音中：
- 🎙️ **リアルタイム仮文字起こし**が表示されます（Web Speech API）

録音終了後、自動的に処理されます：
1. 🎤 高精度文字起こし（kotoba-whisper・ローカル）
2. 👥 **音声ベース話者識別**（pyannote.audio・ローカル）
3. 🔗 文字起こし + 話者識別の結合
4. 📋 議事録生成（Ollama等のLLM）

> 💡 リアルタイム文字起こしは仮のものです。停止後にkotoba-whisperで高精度版に置き換わります。
>
> 🎯 **話者識別はテキストではなく「声」で判断**します。同じ人の声は同じ話者として認識されます。

### 3. LLMの設定（要約生成用）
設定画面で以下のいずれかを設定：
- **Ollama（推奨）**: ローカルで動作、APIキー不要
- **クラウドAI**: 各プロバイダーのAPIキーを入力

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

### 音声認識モデル（kotoba-whisper-v2.2-faster）

| モデル | 必要VRAM | 特徴 |
|-------|----------|------|
| **Kotoba Whisper v2.2** | ~10GB | 日本語特化・超高速・完全ローカル |

**機能:**
- 🇯🇵 日本語に特化した高精度認識
- ⚡ CTranslate2による超高速推論
- 🔒 完全ローカル動作（APIキー不要）
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
│   ├── setup_model.py       # モデルダウンローダー
│   ├── prompts.yaml         # バックエンド用プロンプト
│   ├── models/              # ダウンロード済みモデル
│   │   └── kotoba-whisper-v2.2-faster/
│   └── services/            # サービス層
│       ├── transcription.py # kotoba-whisper（ローカル）
│       ├── diarization.py   # pyannote.audio（ローカル）
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

- **音声認識**: kotoba-whisperで完全ローカル処理（APIキー不要）
- **話者識別**: pyannote.audioで完全ローカル処理（APIキー不要）
- **要約生成**: Ollamaならローカル、クラウドAIなら直接送信
- 中間サーバーを経由しないため安全
- **初回モデルダウンロード後はオフラインで動作可能**（Ollama使用時）

### 🔑 必要なAPIキー・トークン

| 用途 | 必要なもの | 備考 |
|------|-----------|------|
| 音声認識 | **不要** | kotoba-whisperがローカル動作 |
| 話者識別 | **HFトークン（初回のみ）** | pyannote.audioモデルダウンロード用 |
| 要約生成 | **LLM APIキーまたはOllama** | クラウドAI使用時のみAPIキー必要 |

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

IssueやPull Requestを歓迎します！

## 📚 参考リンク

- [kotoba-whisper-v2.2-faster](https://huggingface.co/RoachLin/kotoba-whisper-v2.2-faster) - 日本語特化音声認識モデル（ローカル動作）
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) - CTranslate2ベースの高速Whisper
- [CTranslate2](https://github.com/OpenNMT/CTranslate2) - 高速推論エンジン
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) - 話者識別ライブラリ（ローカル動作）
- [Ollama](https://ollama.ai/) - ローカルLLM実行環境
