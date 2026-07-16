# 外部入力専用マイクページ

## 目的

営業AIメモの本番用外部入力ページです。GAS HtmlService の iframe ではなく、通常の HTTPS ページとして公開し、音声入力を主手段にした入力体験と本番 GAS への送信を担います。

## 公開先

- GitHub Pages
- 公開URL: `https://xxxinakenxxx-hash.github.io/external-voice-poc/external/input-page/`

## このページでやること

- マイク開始・停止
- 音声認識結果の末尾追記
- 手入力・編集
- URL フラグメントから token を受け取り、sessionStorage に保持
- token のないアクセスを拒否
- ページ表示直後の GPS 取得
- 近い順 4 件の店舗候補表示
- 店舗候補の選択
- 店舗名の手入力と部分一致名寄せ
- `unsent_text` の保存と復元
- GAS への POST 送信
- 成功時の結果表示

## このページでやらないこと

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
- 送信先 URL は `external/input-page/index.html` 内の定数で1か所にまとめています
- 現在の送信先は送信API用デプロイB `https://script.google.com/macros/s/AKfycbyji7sp3rftUVwQIRunFp1ClXc_9m_UDzXASkFHDq6P4_-j3srqWrr7I0XSfrj0FTk/exec` です
- token は localStorage ではなく sessionStorage に保存します
- `storeCandidates`、`storeSearch`、`submit` を使います
- GPS に失敗した場合は、候補表示をスキップして手入力と送信を続けます
- 店舗名の確定順は、近隣候補、部分一致候補、手入力の順です
- 送信は1回で完結します
- token や個人情報を README に実値で記載しません
