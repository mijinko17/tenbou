# グループダッシュボード仕様

## 概要

グループに参加したプレイヤーが使うメイン画面。半荘ごとの成績を登録し、累計スコアを一覧で確認する。

---

## URL

`/groups/{groupId}`

## アクセス制御

- セッション Cookie 必須
- セッションなし → `/invite/{inviteToken}` へ誘導（招待リンクの配布方法は別途検討）
- 別グループのセッションでアクセス → 403

---

## 画面構成

1. **成績一覧テーブル**（メイン）
2. **成績登録フォーム**（テーブル下部 or フローティングボタン → モーダル）

---

## 1. 成績一覧テーブル

### 列構成

| # | Alice | Bob | Charlie | Dave |
|---|---|---|---|---|
| 1 | +15.0 | −5.0 | +10.0 | −20.0 |
| 2 | −10.0 | +5.0 | −（抜け番）| … |
| **チップ** | **+4.0** | **−2.0** | … | … |
| **合計** | **+9.0** | **−2.0** | … | … |

- 先頭列 `#` は通し番号
- プレイヤー列は登録順（グループ作成時の順）
- チップ行は入力済みの場合のみ表示（合計行の1つ上）
- 最下行は **合計行**（全半荘スコア＋チップスコアの総和）

### セルの表示値

各プレイヤーの **ウマ・オカ・トビ込みスコア**（小数点1桁）を表示する。

```
base = (素点 − 返し) / 1000 + ウマ

トビあり（素点 < 0）の場合:
  飛んだプレイヤー:   base -= tobi
  飛ばしたプレイヤー: base += tobi

1位のプレイヤーにはさらにオカを加算:
  oka = (返し − 原点) / 1000 × 4
  1位 score = base + oka
```

チップ行のスコア:
```
chip_score = chip_count × chip_rate / 1000
```

合計行のスコア:
```
total = 全半荘スコアの総和 + chip_score
```

- 正の値は `+` を付けて表示（例: `+15.0`）
- トビの判定: 素点 < 0

### 未決定（後フェーズ）

- [ ] 成績の編集・削除機能
- [ ] 精算額（G）の表示画面

---

## 2. 成績登録フォーム

### 入力項目

| 項目 | 内容 |
|---|---|
| 各プレイヤーの素点（4人分） | 整数、点数単位（例: 32000） |
| 飛ばしたプレイヤー（トビあり時のみ） | 素点 < 0 のプレイヤーがいる場合に表示 |

---

## 3. チップ入力

### 概要

セット終了後などにチップ収支を入力する。グループ単位で1回だけ記録する（半荘ごとではない）。

### UI

- ダッシュボード上部に「チップを入力」ボタンを設置
- ボタン押下でフォームを展開（成績登録フォームと同様のトグル形式）
- 入力済みの場合はボタンを「チップを編集」に変更

### 入力項目

| 項目 | 内容 |
|---|---|
| 各プレイヤーのチップ収支 | 整数（正 = 獲得、負 = 放出）。空欄は 0 扱い |

### バリデーション

- 全プレイヤーのチップ収支の合計が 0 であること

### バリデーション

- 素点の合計 = 原点 × 4 であること（例: 原点25000 → 合計100000）
- 各素点は整数であること
- 素点 < 0 のプレイヤーがいる場合、飛ばしたプレイヤーの選択が必須

### UI フロー

1. 「成績を登録」ボタンをタップ
2. モーダルまたは別エリアにフォーム表示
3. 4人の素点を入力 → リアルタイムで合計を表示（ズレていたらエラー色）
4. 素点 < 0 のプレイヤーが存在する場合、「飛ばしたのは誰ですか？」選択欄を表示
   - 飛んだプレイヤー自身は選択肢から除外する
5. 「登録」→ テーブルに行が追加

---

## DB スキーマ（案）

```sql
-- チップ収支（グループ単位・プレイヤーごと）
CREATE TABLE chip_totals (
  id         TEXT PRIMARY KEY,              -- UUID v4
  group_id   TEXT NOT NULL REFERENCES groups(id),
  player_id  TEXT NOT NULL REFERENCES players(id),
  chips      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (group_id, player_id)
);

-- 半荘（1ゲーム単位）
CREATE TABLE game_rounds (
  id         TEXT PRIMARY KEY,              -- UUID v4
  group_id   TEXT NOT NULL REFERENCES groups(id),
  round_no   INTEGER NOT NULL,              -- 表示用通し番号（グループ内で連番）
  played_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 半荘ごとのプレイヤー成績
CREATE TABLE game_results (
  id         TEXT PRIMARY KEY,              -- UUID v4
  round_id   TEXT NOT NULL REFERENCES game_rounds(id),
  player_id  TEXT NOT NULL REFERENCES players(id),
  raw_points INTEGER NOT NULL,              -- 素点
  UNIQUE (round_id, player_id)
);
```

> スコア・ウマ・オカの計算はバックエンド側で行い、フロントには計算済みの値を返す。

---

## API（案）

### 成績一覧取得

```
GET /groups/{groupId}/rounds
```

レスポンス:
```json
{
  "players": [
    { "id": "uuid", "name": "Alice" }
  ],
  "rounds": [
    {
      "id": "uuid",
      "roundNo": 1,
      "playedAt": "2026-05-14T12:00:00Z",
      "results": [
        { "playerId": "uuid", "rawPoints": 32000, "score": 15.0 },
        { "playerId": "uuid", "rawPoints": 22000, "score": -5.0 }
      ]
    }
  ],
  "totals": [
    { "playerId": "uuid", "score": 15.0 }
  ]
}
```

### 成績登録

```
POST /groups/{groupId}/rounds
```

リクエストボディ:
```json
{
  "results": [
    { "playerId": "uuid", "rawPoints": 32000 },
    { "playerId": "uuid", "rawPoints": 22000 },
    { "playerId": "uuid", "rawPoints": 24000 },
    { "playerId": "uuid", "rawPoints": -4000 }
  ],
  "tobiKillerId": "uuid"
}
```

- `tobiKillerId`: 素点 < 0 のプレイヤーがいる場合のみ必須。飛ばしたプレイヤーの ID。

バリデーション（バックエンド側）:
- セッションがこのグループに属すること
- `rawPoints` の合計 = 原点 × 4
- `playerId` がすべてこのグループの参加者であること
- 参加者は4人固定
- 素点 < 0 のプレイヤーが存在する場合、`tobiKillerId` が必須かつ飛んだプレイヤー以外であること

### チップ登録・更新

```
PUT /groups/{groupId}/chips
```

リクエストボディ:
```json
{
  "chips": [
    { "playerId": "uuid", "count": 3 },
    { "playerId": "uuid", "count": -1 },
    { "playerId": "uuid", "count": 0 },
    { "playerId": "uuid", "count": -2 }
  ]
}
```

バリデーション（バックエンド側）:
- `count` の合計が 0 であること
- `playerId` がすべてこのグループの参加者であること

`GET /groups/{groupId}` のレスポンスに `chips` フィールドを追加:
```json
{
  "chips": [
    { "playerId": "uuid", "count": 3 }
  ]
}
```
