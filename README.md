# 外部音声入力検証

## 目的

GAS HtmlService の iframe 外に置いた通常の HTTPS ページで、Web Speech API による音声入力が正常に開始・停止・追記できるかを確認するための最小検証です。

## これは本番機能ではない

- 本番の入力画面ではありません
- GAS、認証、AI、スプレッドシートには接続しません
- `index.html` だけで動く静的ページです
- GitHub＋Vercel で HTTPS 公開して確認する想定です

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
- 署名付きトークン
- GAS API
- OpenAI API
- `deal_records` 書き込み
- 店舗選び
- S-03

## 実装メモ

- 外部ライブラリは使用しません
- `external_voice_poc_text` を localStorage のキーとして使います
- `unsent_text` は読み書きしません
- interimResults の途中結果は保存しません

