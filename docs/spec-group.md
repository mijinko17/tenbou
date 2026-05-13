# グループ作成機能 仕様

## 用語定義

| 用語 | 英語 | 意味 |
|---|---|---|
| 点 | point | 麻雀の素点（例: 32000点） |
| スコア | score | 点 ÷ 1000 の値（例: 32）。ウマ・オカ未加算の中間値 |
| G | G | 精算単位。スコア × レート で算出 |

---

## 概要

麻雀セットのグループを作成し、参加者を登録する。グループごとにウマ・オカ設定を持つ。

---

## 未決定事項（要議論）

- [x] グループ名: 最大30文字、文字種制限なし
- [x] 参加者名: 最大10文字、文字種制限なし
- [x] 招待リンクの有効期限: 7日間
- [x] グループ削除機能: なし
- [x] 参加者の追加: 可（招待リンクから参加）
- [x] 参加者の削除: 可（対局記録がない場合のみ）
- [x] 5人セット時のオカ計算 → 4人固定で計算
- [ ] 5人セット時の抜け番ルール（スコアへの影響あり？）

---

## DB スキーマ（案）

```sql
-- グループ
CREATE TABLE groups (
  id          TEXT PRIMARY KEY,  -- UUID v4
  name        TEXT NOT NULL,
  rate        INTEGER NOT NULL DEFAULT 50,    -- 1000点あたりのG数（例: 50 → 1000点=50G）
  chip_rate   INTEGER NOT NULL DEFAULT 2000,  -- チップ1枚あたりの点数（例: 2000 → 1枚=2000点）
  uma_1       INTEGER NOT NULL DEFAULT 20,    -- 1着ウマ（スコア）
  uma_2       INTEGER NOT NULL DEFAULT 10,    -- 2着ウマ（スコア）
  uma_3       INTEGER NOT NULL DEFAULT -10,   -- 3着ウマ（スコア）
  uma_4       INTEGER NOT NULL DEFAULT -20,   -- 4着ウマ（スコア）
  genten      INTEGER NOT NULL DEFAULT 25000, -- 原点（点数、例: 25000点）
  kaeshi      INTEGER NOT NULL DEFAULT 30000, -- 返し（点数、例: 30000点）
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 制約: uma_1 + uma_2 + uma_3 + uma_4 = 0

-- 参加者
CREATE TABLE players (
  id         TEXT PRIMARY KEY,  -- UUID v4
  group_id   TEXT NOT NULL REFERENCES groups(id),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 招待トークン（グループ参加用）
CREATE TABLE invite_tokens (
  token      TEXT PRIMARY KEY,  -- UUID v4
  group_id   TEXT NOT NULL REFERENCES groups(id),
  expires_at TEXT NOT NULL,     -- created_at + 7日
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- セッション
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,  -- UUID v4
  player_id  TEXT NOT NULL REFERENCES players(id),
  expires_at TEXT NOT NULL
);
```

> オカの計算: `(kaeshi - genten) / 1000 × 4` → 1着に加算（5人セット時も4人固定）
> （例: 原点25000・返し30000 → オカ = (30000-25000)/1000×4 = 20スコア）
>
> TODO: インデックス設計

---

## API（案）

### グループ作成

```
POST /groups?key={CREATION_PASSWORD}
```

リクエストボディ:
```json
{
  "name": "グループ名",
  "players": ["Alice", "Bob", "Charlie", "Dave"],
  "rate": 50,
  "chipRate": 2000,
  "uma": [20, 10, -10, -20],
  "genten": 25000,
  "kaeshi": 30000
}
```

レスポンス:
```json
{
  "groupId": "uuid-v4",
  "inviteToken": "uuid-v4"
}
```

> バリデーション:
> - `players` は 4〜5 人
> - `uma[0] + uma[1] + uma[2] + uma[3] === 0`

### 招待リンクでの参加（参加者追加）

```
GET /invite/{token}   → グループ情報を返す
POST /invite/{token}  → プレイヤー登録 + セッション発行（HttpOnly Cookie, 7日）
```

### 参加者削除

```
DELETE /groups/{groupId}/players/{playerId}
```

- 自分自身のみ削除可（セッションの `player_id` と一致しない場合は 403）
- 対局記録（`game_results` テーブル）に該当プレイヤーのレコードが存在する場合は 409
- 削除後の参加者数が3人以下になる場合は 409（4人未満では対局不可）

---

## フロントエンド画面（案）

1. **グループ作成画面** `/create?key=xxx`
   - グループ名入力
   - 参加者名（4〜5人）入力
   - レート設定（スコア1 = X G）
   - チップレート設定（1枚 = X 点）
   - ウマ設定: プリセット選択（10-20 / 10-30）またはカスタム（1〜4着を個別入力、スコア単位）
   - 原点・返し設定（デフォルト: 原点25000・返し30000、点数単位）
   - 送信 → 招待リンクを表示

2. **招待リンク受け取り画面** `/invite/{token}`
   - グループ名・参加者一覧を表示
   - 「参加する」ボタン → Cookie 発行 → ダッシュボードへ

---

## セキュリティ

- グループ作成は `?key=` クエリパラメータによる静的パスワード保護
- 招待トークンは UUID v4（推測不可）
- セッション Cookie は `HttpOnly; Secure; SameSite=Lax`
