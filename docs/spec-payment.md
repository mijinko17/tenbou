# 精算機能 仕様

## 概要

セット終了後に「誰が誰にいくら払うか」を出力する。
対局スコア・チップ収支にレートを掛けて各プレイヤーの収支（G）を算出し、
立替履歴による調整を加えたうえで、支払い回数が最小になるよう精算を最適化する。

---

## URL

`/groups/{groupId}/settlement`

ダッシュボード（`/groups/{groupId}`）に「精算」ボタンを設置し遷移する。

---

## 計算ロジック

### 1. 対局スコア合計（G）

各プレイヤーの全半荘スコアを合算し、レートを掛ける。

```
game_score_total[p] = Σ score（各半荘）
game_G[p]          = game_score_total[p] × rate
```

- `score` はウマ・オカ・トビ込みの値（バックエンドで計算済みの値をそのまま使う）
- `rate` はグループ設定の `rate`（1スコアあたりのG数）

### 2. チップ収支（G）

```
chip_score[p] = chip_count[p] × chip_rate / 1000
chip_G[p]     = chip_score[p] × rate
```

- `chip_rate` はグループ設定の「チップ1枚あたりの点数」
- チップ未入力の場合は 0

### 3. 対局＋チップ合計（G）

```
subtotal_G[p] = game_G[p] + chip_G[p]
```

### 4. 立替調整

各立替記録 `advance_payment` に対して:
```
per_person = amount / beneficiaryIds.length  （円、端数切り捨て）

立替者（payer）  の調整額 += amount          （受け取り側：プラス）
被立替者（beneficiary）の調整額 -= per_person （支払い側：マイナス）
```

- 立替の金額単位は「円」（G ではなく現金）
- 立替調整は G の合計額に加算（単位混在のため最終的に円で統一する）

> **単位統一の考え方**
>
> 精算の最終出力は「円」で統一する。
> - G は `subtotal_G[p]` をそのまま円換算する（1G = 1円）
> - 立替は元々円単位なのでそのまま加算

### 5. 最終収支（円）

```
final_balance[p] = subtotal_G[p] + advance_adjustment[p]
```

- 正の値 → このプレイヤーは合計 `final_balance[p]` 円を受け取る
- 負の値 → このプレイヤーは合計 `|final_balance[p]|` 円を支払う

### 6. 支払い最小化アルゴリズム（Greedy）

```
creditors = final_balance[p] > 0 のプレイヤー（受け取り側、降順ソート）
debtors   = final_balance[p] < 0 のプレイヤー（支払い側、昇順ソート）

while creditors と debtors が両方とも空でない:
  c = creditors の最大値
  d = debtors  の最小値（最大の負）
  amount = min(c.balance, |d.balance|)
  → 「d は c に amount 円払う」を記録
  c.balance -= amount
  d.balance += amount
  balance が 0 になったプレイヤーをリストから除外
```

このアルゴリズムで支払い回数は最大 n-1 回（n = プレイヤー数）に抑えられる。

---

## API

### GET /groups/{groupId}/settlement

レスポンス:
```json
{
  "players": [
    { "id": "uuid", "name": "Alice" }
  ],
  "breakdown": [
    {
      "playerId": "uuid",
      "gameScoreTotal": 15.0,
      "gameG": 750,
      "chipScore": 4.0,
      "chipG": 200,
      "subtotalG": 950,
      "advanceAdjustment": -500,
      "finalBalance": 450
    }
  ],
  "payments": [
    { "from": "uuid-bob", "to": "uuid-alice", "amount": 450 }
  ]
}
```

| フィールド | 説明 |
|---|---|
| `gameScoreTotal` | 全半荘スコアの合計（小数1桁） |
| `gameG` | `gameScoreTotal × rate`（整数、円） |
| `chipScore` | チップスコア合計（小数1桁） |
| `chipG` | `chipScore × rate`（整数、円） |
| `subtotalG` | `gameG + chipG`（整数、円） |
| `advanceAdjustment` | 立替による調整額（整数、円。正=受け取り、負=支払い） |
| `finalBalance` | `subtotalG + advanceAdjustment`（整数、円） |
| `payments[].from` | 支払う側のプレイヤーID |
| `payments[].to` | 受け取る側のプレイヤーID |
| `payments[].amount` | 金額（円、正の整数） |

アクセス制御:
- セッション Cookie 必須
- セッションがこのグループに属さない場合は 403

---

## UI

### 精算ページ（`/groups/{groupId}/settlement`）

#### ヘッダー

- タイトル「精算」
- 戻るボタン（ダッシュボードへ）

#### 支払い一覧（メインセクション）

「誰が誰にいくら払うか」を大きく表示する。

```
┌──────────────────────────────┐
│ 支払い                        │
├──────────────────────────────┤
│ Bob → Alice    ¥ 450         │
│ Charlie → Alice ¥ 200        │
│ Dave → Bob     ¥ 100         │
└──────────────────────────────┘
```

支払いがゼロの場合（全員がプラスマイナス0）:
```
精算なし（全員ゼロ）
```

#### 内訳テーブル（折りたたみ可能）

| プレイヤー | 対局G | チップG | 小計G | 立替調整 | 最終収支 |
|---|---|---|---|---|---|
| Alice | +750 | +200 | +950 | -500 | **+450** |
| Bob | -300 | -100 | -400 | 0 | **-400** |

- 最終収支の列は正なら緑・負なら赤でハイライト
- 立替調整は立替がない場合は「—」表示

---

## 端数処理

### 五捨六入

`score × rate` の計算結果は五捨六入（小数第1位が 0〜5 なら切り捨て、6〜9 なら切り上げ）して整数Gにする。

```
五捨六入(x) = x の小数第1位が 6 以上なら ceil(x)、それ以外は floor(x)

例:
  15.3 × 30 = 459.0 → 459G（小数なし）
  15.1 × 30 = 453.0 → 453G（小数なし）
  15.1 × 33 = 498.3 → 498G（.3 → 切り捨て）
  15.1 × 37 = 558.7 → 559G（.7 → 切り上げ）
  15.5 × 30 = 465.0 → 465G（小数なし）
  15.5 × 33 = 511.5 → 511G（.5 → 切り捨て）
```

`chipG`（= `chipScore × rate`）も同様に五捨六入する。

### 帳尻合わせ

五捨六入の結果、全プレイヤーの `subtotalG` の合計が 0 にならない場合がある。
その際は **`subtotalG` が最も高いプレイヤー（1着）** の値を増減して合計を 0 に調整する。

```
adjustment = -(全員の subtotalG の合計)
最高スコアプレイヤーの subtotalG += adjustment
```

- `adjustment` は通常 ±1〜±数G 程度の微小な値
- 立替調整は帳尻合わせの対象外（立替は現金の実費なのでそのまま）

### 立替の人数割り

```
per_person = floor(amount / beneficiaryIds.length)
remainder  = amount - per_person × beneficiaryIds.length
```

- 各被立替者は `per_person` を負担する
- `remainder > 0` の場合、被立替者を登録順（`players.created_at` 昇順）に並べ、先頭から `remainder` 人に 1 ずつ追加負担させる
  - 例: amount=10、被立替者 3 人 → per_person=3、remainder=1 → 登録順1位が 4、2位・3位が各 3
  - 例: amount=11、被立替者 3 人 → per_person=3、remainder=2 → 登録順1位・2位が各 4、3位が 3
  - 閲覧者によらず常に同じ結果になる

---

## 未決定事項

- [ ] 精算結果のシェア機能（テキストコピー or 画像）
- [ ] 精算完了の「ロック」機能（確定後に成績変更を防ぐ）
