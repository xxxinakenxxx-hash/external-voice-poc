# 外部入力専用マイクページ

## 目的

営業AIメモの本番用外部入力ページです。GAS HtmlService の iframe ではなく、通常の HTTPS ページとして公開し、音声入力を主手段にした入力体験を担います。

## 公開先

- GitHub Pages
- 公開URL: `https://xxxinakenxxx-hash.github.io/external-voice-poc/external/input-page/`

## このページでやること

- マイク開始・停止
- 音声認識結果の末尾追記
- 手入力・編集
- `unsent_text` の保存と復元
- 送信時のダミー表示

## このページでやらないこと

- GAS への POST
- トークンの受領・保持・送信
- 位置情報の取得
- `src/` 配下の変更
- OpenAI API 接続
- スプレッドシート連携

## 触ってよい範囲

- `external/input-page/index.html`
- `external/input-page/README.md`

## 触ってはいけない範囲

- `src/`
- `docs/`
- `external/voice-poc/`
- `external/gas-poc/`
- 本番 GAS の設定

## 補足

- 外部ライブラリや CDN は使いません
- Web Speech API は `window.SpeechRecognition || window.webkitSpeechRecognition` を利用します
- 送信ボタンは EX-06 接続前のダミー動作です
