# 立替記録機能

## 概要

グループ内での立替（一人が他のメンバーの支払いを肩代わりする）を記録し、精算時に参照できるようにする。

## データモデル

### advance_payments テーブル

| カラム | 型 | 説明 |
|---|---|---|
| id | text (PK) | UUID v4 |
| group_id | text (FK) | グループID |
| payer_id | text (FK) | 立て替えたプレイヤーのID |
| beneficiary_ids | text | 立て替えてもらったプレイヤーIDのJSON配列 |
| description | text | 何を立て替えたか |
| amount | integer | 合計金額（円） |
| created_at | integer | 作成日時（Unix timestamp） |

## API

### GET /groups/:groupId
レスポンスに `advancePayments` を追加：
```json
{
  "advancePayments": [
    {
      "id": "...",
      "payerId": "player-uuid",
      "beneficiaryIds": ["player-uuid", "player-uuid"],
      "description": "飲み物代",
      "amount": 1000,
      "createdAt": 1700000000
    }
  ]
}
```

### POST /groups/:groupId/advance-payments
立替を登録する。認証不要。

リクエスト:
```json
{
  "payerId": "player-uuid",
  "beneficiaryIds": ["player-uuid", "player-uuid"],
  "description": "飲み物代",
  "amount": 1000
}
```

レスポンス: `201 Created`

### DELETE /groups/:groupId/advance-payments/:paymentId
立替を削除する。認証不要。

レスポンス: `200 OK`

## UI

### 登録ボタン
「登録」ドロップダウンメニューに「立替登録」を追加する。

### 登録ダイアログ
- 立替者（誰が立て替えたか）: プレイヤー選択（Select）
- 被立替者（誰の分か）: プレイヤー選択（Select）
- 内容（何を立て替えたか）: テキスト入力
- 金額: 数値入力（円）

### 履歴表示
成績テーブルの下に立替履歴を表示する。

| 日時 | 立替者 | 被立替者 | 内容 | 金額 |
|---|---|---|---|---|
| xx/xx | Aさん | Bさん | 飲み物代 | ¥500 |

各行に削除ボタンを設ける。
