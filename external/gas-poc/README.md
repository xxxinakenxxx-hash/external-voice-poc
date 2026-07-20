# EX-02 / EX-03R 検証専用 GAS

## これは何か

- EX-02「外部ページ→GAS通信検証」専用の Apps Script プロジェクトです
- 本番GASとは分離されています
- 本番の `doGet`、`submitMemo`、`validateUser` には触れません
- 本番接続ではありません

## 使用するスクリプトID

`1BKtsbPP703iHt97WKCMKGlJ8_ytwWztUq05bbQpfa_JJE5zWGru_exNs`

## 実行場所

- `external/gas-poc/` で `clasp push --force` を実行します
- `external/gas-poc/.clasp.json` はこの検証専用プロジェクトを指しています
- 本番ルートの `.clasp.json` は使いません

## デプロイについて

- GASウェブアプリのデプロイまたは更新はユーザーが行います
- Codex は `clasp push --force` までを担当します

## 実装内容

- `doPost(e)` が POST データを受け取り、JSON文字列で返します
- 受信項目は `token` と `text` です
- 応答項目は `success`、`receivedToken`、`receivedText`、`receivedAt` です
- AI、認証、スプレッドシート書き込み、error_log 書き込みは行いません

## EX-03R 追記

- `doGet(e)` で `Session.getActiveUser().getEmail()`、`Session.getEffectiveUser().getEmail()`、`EX03_API_URL` の3項目だけを表示します
- `doPost(e)` は EX-02 と同じ検証用受け口として維持します
- TOP 用デプロイは社内ドメイン限定、送信API 用デプロイは全員公開に分けて検証します
- 送信API 用デプロイ URL はスクリプトプロパティ `EX03_API_URL` から読む前提です
- デプロイ分離または別プロジェクトが必要かどうかは、けんたろうの手動確認結果で整理します

## けんたろう手動確認欄

| 構成 | メール取得可否 | 外部POST到達可否 | 備考 |
|---|---|---|---|
| 同一デプロイ | 未確認 | 未確認 | 初回EX-03で停止条件に該当した構成 |
| デプロイ分離 | 未確認 | 未確認 | TOP 用と送信API 用を分けて確認する |
| 別GASプロジェクト | 未確認 | 未確認 | デプロイ分離でも成立しない場合に確認する |

## 手動確認項目

- GAS デプロイ設定は Codex では変更しません
- TOP 用 URL を開き、メールアドレスが 1 行だけ表示されるかを確認します
- 外部ページから POST を 1 回送信し、既存の JSON 応答が返るかを確認します
- 同一デプロイで成立しない場合は、分離または別プロジェクトの要否を記録します
