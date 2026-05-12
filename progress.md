# progress.md

## 現在のフェーズ

**最小構成 + CI/CD 完成**。機能実装はこれから。

---

## 実装済み

### インフラ・環境
- [x] pnpm workspaces + Turborepo モノレポ
- [x] Biome（lint/format）
- [x] GitHub Actions CI（lint → build → test）
- [x] GitHub Actions CD（main push → Cloudflare Workers + Pages 自動デプロイ）
- [x] Devcontainer（gh CLI、ホストの `~/.config/gh` をマウント）

### フロントエンド（`frontend/`）
- [x] SvelteKit v2 + Svelte 5 + TypeScript
- [x] Tailwind CSS v4（設定ファイルなし、`@import "tailwindcss"` のみ）
- [x] adapter-static でビルド → `frontend/build/` に出力
- [x] Vite `host: true`（devcontainer ポート転送対応）

### バックエンド（`backend/`）
- [x] Cloudflare Workers + Hono v4
- [x] `GET /` → `{ status: 'ok' }` のみ

---

## 未実装（これから作る機能）

- [ ] DB スキーマ設計（D1）
- [ ] 認証（招待リンク + HttpOnly Cookie）
- [ ] グループ管理 API
- [ ] 対局記録 API
- [ ] 精算計算ロジック
- [ ] フロントエンド UI

---

## 決定事項（変更する場合は要議論）

| 項目 | 決定内容 |
|---|---|
| コードスタイル | タブインデント、ダブルクォート（Biome） |
| pnpm バージョン | 10.33.0（`packageManager` フィールドで固定） |
| Tailwind | v4（`@tailwindcss/vite` プラグイン方式、設定ファイルなし） |
| CD デプロイ方法 | `wrangler-action` の `workingDirectory: backend` から両方デプロイ |
| Pages プロジェクト名 | `tenbou` |
| Workers 名 | `tenbou-backend` |

## 既知の注意点

- `wrangler dev` のポートは 8787（devcontainer で転送済み）
- `turbo build` で backend に "no output files" 警告が出るが無害（`tsc --noEmit` は出力ファイルを生成しない仕様）
- Cloudflare workers.dev サブドメインは手動で1回登録が必要（登録済みなら次回以降は不要）
