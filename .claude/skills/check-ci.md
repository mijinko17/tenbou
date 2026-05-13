# check-ci スキル

GitHub Actions の最新実行を確認し、失敗していれば原因を調査して修正する。

## 手順

### 1. 最新の CI 状態を確認

```bash
gh run list --limit 5
```

失敗しているランがあれば、そのRun IDを取得して詳細を確認する。

```bash
gh run view <RUN_ID>
```

### 2. 失敗ジョブのログを取得

```bash
gh run view <RUN_ID> --log-failed
```

エラーメッセージを読み、根本原因を特定する。

### 3. 原因に応じて修正

よくある原因と対処：

| 原因 | 対処 |
|---|---|
| 型エラー（tsc） | 該当ファイルを修正 |
| テスト失敗（vitest） | テストまたは実装を修正 |
| lint エラー（biome） | `pnpm lint` でローカル確認後修正 |
| wrangler deploy 失敗 | `wrangler.toml` や secrets を確認 |
| D1 migration 失敗 | マイグレーション SQL を確認 |
| pnpm install 失敗 | `pnpm-lock.yaml` の整合性を確認 |

### 4. ローカルで再現確認

```bash
pnpm build   # 型チェック
pnpm test    # テスト
pnpm lint    # lint
```

### 5. 修正をコミット・プッシュして CI 再実行を確認

```bash
git add <files>
git commit -m "fix: ..."
git push
gh run watch  # 新しいランを監視
```

最新のランが全ジョブ成功するまで 1〜3 を繰り返す。
