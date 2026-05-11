# tenbou - 麻雀成績管理アプリ

## プロジェクト概要

身内のセット（4〜5人）向けの麻雀成績管理Webアプリ。
グループを作成し、対局ごとの素点を入力すると精算額を自動計算する。

**主な利用環境はスマートフォン**。UIはモバイルファーストで設計する。

## セッション開始時の必須手順

1. `progress.md` を読んで現在の実装状況と直近の決定事項を把握する
2. `.claude/rules/` 配下のルールファイルを確認する
3. 作業開始前に「現在地の認識」を簡潔に報告する

## ディレクトリ構成

```
mahjong-set-manager/
├── frontend/          # SvelteKit
│   ├── src/
│   ├── static/
│   └── package.json
├── backend/           # Cloudflare Workers + Hono
│   ├── src/
│   ├── migrations/    # D1マイグレーションSQL
│   ├── wrangler.toml
│   └── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json       # ルート（pnpm workspace）
```

## よく使うコマンド

```bash
pnpm dev              # 開発サーバー起動（frontend/backend並列）
pnpm build            # 全パッケージビルド
pnpm test             # 全パッケージテスト
pnpm lint             # Biome lint
pnpm format           # Biome format
```

## 技術スタック

- **フロントエンド**: SvelteKit (adapter-static) + TypeScript + Skeleton v3（UIコンポーネント）+ Tailwind CSS
- **APIサーバー**: Cloudflare Workers + Hono
- **DB**: Cloudflare D1（SQLite）
- **ホスティング**: Cloudflare Pages
- **テスト**: Vitest
- **フォーマット・Lint**: Biome
- **モノレポ管理**: Turborepo + pnpm workspaces

## アーキテクチャ上の決定事項

- 認証: 招待リンク方式（UUID v4トークン）+ HttpOnly Cookie（有効期限7日）
- グループ作成の保護: 静的パスワード（クエリパラメータ `?key=xxx`）
- レートリミット: Cloudflare WAFで対応（アプリ側では実装しない）
- セッション管理: D1の `sessions` テーブルで管理（Redisは使わない）

## 機能要件

- グループ作成（参加者4〜5人）
- 4人打ち・5人セット（抜け番あり）の両方に対応
- 対局ごとの素点入力・保存
- ウマ・オカあり（グループごとに設定可能）
- 最終精算額の出力（支払い最適化）

## 絶対に守ること

- 素点の合計は常に ±0 になること（精算バグの防止）
- 招待トークンは必ず UUID v4 を使う（推測可能な値は禁止）
- D1スキーマ変更は必ずマイグレーションファイルを作成する（直接変更禁止）
- `console.log` を本番コードに残さない
- ドメインロジック（精算計算）はWorkers側に置き、フロントに持たせない

## ハーネス構成

| 要素 | 場所 |
|---|---|
| ルール | `.claude/rules/` |
| スキル | `.claude/skills/` |
| フック | `.claude/hooks/hooks.json` |
| メモリ | `progress.md` |
