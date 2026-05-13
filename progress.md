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

## 実装済み（グループ作成機能）

- [x] D1 マイグレーション（`backend/migrations/0001_initial.sql`）
- [x] `POST /groups` — グループ作成（`?key=` による保護）
- [x] `GET /invite/:token` — 招待リンク情報取得
- [x] `POST /invite/:token` — 参加（既存プレイヤー選択 or 新規追加）+ セッション発行
- [x] `DELETE /groups/:groupId/players/:playerId` — 参加者自身の脱退
- [x] フロントエンド `/create` — グループ作成ページ
- [x] フロントエンド `/invite/[token]` — 招待リンク参加ページ

## 未実装（これから作る機能）

- [ ] 対局記録 API
- [ ] 精算計算ロジック
- [ ] ダッシュボード UI（参加後のトップ画面）

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

## D1 初回セットアップ手順（デプロイ前に1回だけ必要）

```bash
# 1. D1 データベースを作成（出力された database_id を控える）
cd backend && pnpm exec wrangler d1 create tenbou

# 2. backend/wrangler.toml の database_id を置き換える
#    "00000000-0000-0000-0000-000000000000" → 実際の ID

# 3. ローカルでマイグレーション適用（wrangler dev 用）
pnpm exec wrangler d1 migrations apply tenbou --local

# 4. CREATION_PASSWORD を本番用シークレットに変更
pnpm exec wrangler secret put CREATION_PASSWORD
```

## 既知の注意点

- `wrangler dev` のポートは 8787（devcontainer で転送済み）
- `turbo build` で backend に "no output files" 警告が出るが無害（`tsc --noEmit` は出力ファイルを生成しない仕様）
- Cloudflare workers.dev サブドメインは手動で1回登録が必要（登録済みなら次回以降は不要）
