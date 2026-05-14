# Drizzle マイグレーションのルール

## マイグレーションファイルの生成

マイグレーションファイルは必ず drizzle-kit で生成する。手動で SQL ファイルを作成してはいけない。

```bash
# --name で内容がわかる名前を必ず指定する
pnpm db:generate --name <名前>

# 例
pnpm db:generate --name add_tobi
pnpm db:generate --name add_game_results
pnpm db:generate --name add_player_index
```

`--name` を省略するとランダムな名前（`0003_bent_madame_hydra.sql` 等）になるため、必ず指定すること。

## 既存ファイルの扱い

- 既存のマイグレーションファイルは変更・削除しない
- 新しいマイグレーションは drizzle-kit の差分生成（`db:generate`）で追加する

## ローカル D1 への適用

```bash
pnpm db:migrate:local
```
