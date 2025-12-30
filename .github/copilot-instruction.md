# Web Labs - Copilot Instructions

実用的で便利なツールを集めたユーティリティプラットフォームです。
複数の Web ツールをワンストップで利用できるように設計されています。


## 技術スタック

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **UI Library**: Mantine v8
- **Linter/Formatter**: Biome


## コーディング規約・ガイドライン

### ログ出力

- **クライアントサイド**: `src/utils/logger.client.ts` の `logMessage` を使用
  - 第1引数には機能名やアプリケーションID (例: `"umatoma"`, `"video-downloader"`) を指定
  - ファイルパスは指定しない
- **サーバーサイド**: `src/utils/logger.server.ts` の `log` オブジェクトを使用
  - `log.info("app-id", "message", { context })` の形式で呼び出し

### コンポーネント設計

- **ロジックの分離**: 基本的にページ内コンポーネントを使用、ただし汎用的なページは `src/components/` 配下にまとめる

### 型安全性 (TypeScript)

- **`any` の回避**: 原則として `any` 型の使用は避け、具体的な型定義を行う
- **型定義の場所**: 共有される型定義は `src/types/` ディレクトリに配置
