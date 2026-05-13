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
| lint / format エラー（biome） | `pnpm format` で自動修正後、`pnpm exec biome ci .` で確認 |
| wrangler deploy 失敗 | `wrangler.toml` や secrets を確認 |
| D1 migration 失敗 | マイグレーション SQL を確認 |
| pnpm install 失敗 | `pnpm-lock.yaml` の整合性を確認 |

### 4. ローカルで CI と同じコマンドを実行して通ることを確認

**CI と同じコマンドを使うこと。** `pnpm lint` だけでは不十分で、フォーマット・import 整序も検査される。

```bash
pnpm build              # 型チェック（CI: tsc --noEmit）
pnpm test               # テスト（CI: vitest run）
pnpm exec biome ci .    # lint + format + organizeImports（CI と同一コマンド）
```

`pnpm exec biome ci .` がエラーを出した場合は `pnpm format` で自動修正してから再確認する。

```bash
pnpm format             # biome format --write（自動修正）
pnpm exec biome ci .    # 再確認（エラー 0 になるまで繰り返す）
```

### 5. ローカルでエラー 0 を確認してからコミット・プッシュ

```bash
git add <files>
git commit -m "fix: ..."
git push
```

push 後、新しいランが全ジョブ成功することを確認する：

```bash
gh run list --limit 3
```
