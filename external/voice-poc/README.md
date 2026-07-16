# 外部音声入力検証

## 目的

GAS HtmlService の iframe 外に置いた通常の HTTPS ページで、Web Speech API による音声入力が正常に開始・停止・追記できるかを確認するための最小検証です。

## これは本番機能ではない

- 本番の入力画面ではありません
- GAS、認証、AI、スプレッドシートには接続しません
- `index.html` だけで動く静的ページです
- GitHub Pages で HTTPS 公開して確認する想定です

## EX-08 検証手段

- 画面上部に、検証専用GASの `GAS送信先URL` と `トークン` の入力欄があります
- `GAS送信先URL` は初期値としてデプロイBのURLを入れています
- トークン欄は `#token=` のフラグメントから自動反映しますが、手動編集・全削除もできます
- 画面下部に、検証専用GASへPOSTするための入力欄があります
- 入力欄は `action`、`latitude`、`longitude`、`keyword`、`inputText` です
- トークン欄が空でも送信自体は実行し、GAS側で拒否されるかを確認します
- action に応じて送信する値を切り替えます
- `storeCandidates` は `{ token, action, latitude, longitude }`
- `storeSearch` は `{ token, action, keyword }`
- `submit` は `{ token, action, inputText, latitude, longitude, storeName }`
- Content-Type は `text/plain;charset=UTF-8` のままです
- 応答は HTTP ステータスと応答本文そのままを表示します

## 確認用途

- 正しいトークン
- 1文字改ざんトークン
- 空欄トークン
- 期限切れトークン
- 店舗候補取得
- 店舗名部分一致検索
- 既存 submit の維持確認

## 期限切れ確認

- `issueShortLivedTokenForTest` は EX-08 の実機確認用に再追加しています
- EX-08 完了後に削除する残件として、`TASK_CURRENT.md` に記録します
- このページは action 振り分けと店舗検索の疎通確認にも使います

## 確認対象端末

- Android + Chrome
- Windows 11 + Chrome
- iPhone + Safari

## 合格条件

- マイク権限の確認が表示される
- 音声認識を開始できる
- 認識結果が入力欄へ入る
- 再度開始した結果が末尾へ追記される
- 入力途中の内容が再アクセス時に復元される

## この工程では確認しない内容

- Googleログイン
- 本番入力ページ `external/input-page/`
- OpenAI API
- `deal_records` 書き込み
- 店舗選び
- S-03

## 実装メモ

- 外部ライブラリは使用しません
- `external_voice_poc_text` を localStorage のキーとして使います
- `unsent_text` は読み書きしません
- interimResults の途中結果は保存しません
- 検証用ページは本番入力ページとは別物です
