# 営業AIメモ URL・構成・名称再定義

版数：v1.2　／　作成日：2026-07-16　／　改訂日：2026-07-19（店舗名・顧客名設計是正、確定事項6件を反映）　／　対応する要件定義書：v3（2026-07-19 改訂）

## 1. この文書の目的

営業AIメモで使用する画面、GAS、データ、GitHub、公開先について、名称・役割・URL・正本上の位置づけを一つにそろえる。

この文書に記載した「使用中」のURLだけを、今後の実機確認と運用で使用する。

---

## 2. 現在使用する構成

| # | 再定義名称 | 実体 | 役割 | URL | 正本との整合性 |
|---:|---|---|---|---|---|
| 1 | 営業AIメモ｜利用開始・本人確認 | 社内入口用GAS Webアプリ | 会社Googleアカウントの担当者を確認し、role に応じた利用可能な導線を表示する。role が sales・manager・sysadmin の場合は署名付きトークンを発行し、「商談メモを入力する」「日報を見る」の2ボタンを表示する。role が sales_support の場合はトークンを発行せず、商談入力画面へのリンクも表示せず、「日報を見る」の1ボタンのみを表示する。個人日報（S-05）、管理職向け日報まとめ（S-06）、追記画面（S-04）もこのデプロイ上に置く。新しいボタン種別・入口URLの追加は行わない（既存TOP画面の表示内容とトークン発行条件のみ role 別に変更する） | https://script.google.com/a/macros/marubishi-group.co.jp/s/AKfycbzjuy5sRg9508tMq2EY2_LJfwe8Vky4HQlITv6xkeACfU_cQHIETRNTrfgLsicvsIA/exec | S-00・S-04・S-05・S-06、API-01・API-02・API-17・API-19・API-28・API-36・API-37、社内ドメイン限定のGASデプロイAに対応 |
| 2 | 営業AIメモ｜商談入力 | GitHub Pages上の外部入力画面 | 音声入力、テキスト入力、商談区分（訪問／電話）の選択、店舗指定、訪問時の位置情報取得、送信、保存結果表示を行う。過去の商談記録は表示しない | https://xxxinakenxxx-hash.github.io/external-voice-poc/external/input-page/ | 外部配置のS-02に対応。保存結果表示は同じ画面内のS-03相当 |
| 3 | 営業AIメモ｜商談送信・保存API | 商談送信API用GAS Webアプリ | トークン検証、担当者確定、商談区分・店舗指定の必須検証、商談先店舗の確定（正式名称の再取得）、店舗候補取得・店舗名検索、AI解析、商談記録保存を行う | https://script.google.com/macros/s/AKfycbyji7sp3rftUVwQIRunFp1ClXc_9m_UDzXASkFHDq6P4_-j3srqWrr7I0XSfrj0FTk/exec | API-16・API-18・API-03・API-38・API-14・API-15、全員アクセスのGASデプロイBに対応 |
| 4 | 営業AIメモ｜GAS処理本体 | Apps Scriptプロジェクト | 入口画面、トークン、送信API、AI解析、シート保存のGASコードと2デプロイを管理する | https://script.google.com/u/0/home/projects/1KAkb-GLq8XKnbo207YXgTP8BFpz_PpKtikUHh_O8rb8Rxso6vrJL9UAG/edit | 正本の「1プロジェクト・2デプロイ」構成に対応 |
| 5 | 営業AIメモ｜商談記録データ | Googleスプレッドシート | deal_records、user_master、branch_master、store_master、deal_additions、error_logを管理する | https://docs.google.com/spreadsheets/d/1fByTWWIWfGMuXIYkoRO7UXrtXQ7OWSsEDcUk6WifVdw/edit | DB設計書のPhase 1シート構成に対応 |
| 6 | 営業AIメモ｜外部入力画面ソース | GitHubリポジトリ | 外部入力画面と検証ページのソースコードを管理する | https://github.com/xxxinakenxxx-hash/external-voice-poc | 技術選定理由書の外部静的ホスティング構成に対応 |
| 7 | 営業AIメモ｜外部入力画面公開設定 | GitHub Pages設定 | GitHub Pagesの公開元と公開状態を管理する | https://github.com/xxxinakenxxx-hash/external-voice-poc/settings/pages | 実公開先は#2。リポジトリはpublic、既定ブランチはmain |

---

## 3. 利用者が使うURL

本システムの利用者が使用する入口は、次の1本だけとする（sales／manager／sales_support／sysadmin のいずれも同じURLを使用する。表示される導線は role により異なる）。

- 営業AIメモ｜利用開始・本人確認  
  https://script.google.com/a/macros/marubishi-group.co.jp/s/AKfycbzjuy5sRg9508tMq2EY2_LJfwe8Vky4HQlITv6xkeACfU_cQHIETRNTrfgLsicvsIA/exec

外部入力画面と送信APIのURLは、利用者が直接選んで開く入口として案内しない。

---

## 4. GASデプロイの確定区分

| 画面上の表示 | バージョン | URLまたは識別 | 確定区分 | 今後の扱い |
|---|---:|---|---|---|
| 無題 | 13 | AKfycbyji7sp3rftUVwQIRunFp1ClXc_9m_UDzXASkFHDq6P4_-j3srqWrr7I0XSfrj0FTk | 使用中 | 「営業AIメモ｜商談送信・保存API」として扱う |
| 無題 | 15 | AKfycbzjuy5sRg9508tMq2EY2_LJfwe8Vky4HQlITv6xkeACfU_cQHIETRNTrfgLsicvsIA | 使用中 | 「営業AIメモ｜利用開始・本人確認」として扱う。WebアプリURLを開いてTOP画面が表示されることを確認済み |
| 無題 | 8 | AKfycby6gJUcMgaZv-lghshPhI7rbw25XdP5cCXg1ukf4CXdgEGZUGopCqf4QPv9dxfBf4o | 旧・不成立 | ログインメール取得に失敗する旧入口候補。使用禁止。削除・アーカイブは別途承認後 |
| 無題 | 5 | AKfycbyfgnbD8jH6xanmWkKc7vN6E2tzpFCevSiCqDUEiC_qhLl8eb65KUBx7SeGjWwZm8g | 旧 | GAS内に商談入力画面を置いていた旧構成。使用禁止。削除・アーカイブは別途承認後 |
| 無題 | 2 | AKfycbzeeSJ7TcsHpD7Vx22YfVqfoQbw5hE-qbnmfnbJOOkLLcwmRSWDd_5OR0bkN9632xo | 用途不明 | 現行構成では使用しない。使用禁止。用途不明のまま保存し、削除・アーカイブは別途承認後 |
| 無題 | 1 | AKfycbwewc2X1Hsh2TLyjAaX7fhF9s5A4cjpTQOByiNbuj1g_oChxuAlShtkzDG7-f48BnM | 用途不明 | 現行構成では使用しない。使用禁止。用途不明のまま保存し、削除・アーカイブは別途承認後 |
| EX-08 action振り… | アーカイブ済み | ライブラリURLが表示されたもの | 運用対象外 | WebアプリURLではない。現行の入口・送信APIとして使用しない |

「用途不明」は推測で用途を付けない。現行構成で使用しないことだけを確定する。

---

## 5. 用語の再定義

| 旧表現・曖昧表現 | 今後使う名称 | 意味 |
|---|---|---|
| TOP、TOP画面、S-00、デプロイA | 営業AIメモ｜利用開始・本人確認 | 本人確認後、role に応じた利用可能な導線を表示する画面 |
| 外部入力画面、S-02、入力専用ページ | 営業AIメモ｜商談入力 | 音声・テキスト・商談区分の選択・店舗指定・送信を行う外部ページ |
| 追記画面、S-04 | 営業AIメモ｜商談記録への追記 | 個人日報で選択した商談記録へ追記を保存するGAS側の社内向け画面（デプロイA） |
| 日報、個人日報、view=daily | 営業AIメモ｜個人日報（S-05） | 本人の商談記録と追記を表示する既存の稼働中画面（デプロイA）。現在の view=daily を維持する。利用できるのは sales と sysadmin のみ。manager・sales_support は利用せず、いずれもS-06を使用する |
| 管理職向けまとめ、view=summary | 営業AIメモ｜管理職向け日報まとめ（S-06） | 閲覧権限内の商談記録と追記を表示する既存の稼働中画面（デプロイA）。現在の view=summary を維持する。利用できるのは manager（同一master_branch_name）、sales_support（全営業所・全営業担当の全件。閲覧専用）、sysadmin（全記録）。sales は利用しない |
| S-03、保存完了画面 | 商談入力画面内の保存結果表示 | 独立URLではなく、送信成功後に同じ外部入力画面内で表示する結果領域 |
| 送信API、デプロイB、doPost | 営業AIメモ｜商談送信・保存API | 外部入力画面からの通信を受け、本人確認・AI解析・保存を行うGAS |
| GAS本体、プロジェクト | 営業AIメモ｜GAS処理本体 | 2つのGAS Webアプリを持つApps Scriptプロジェクト |
| DB、営業AIメモ_DB | 営業AIメモ｜商談記録データ | 商談記録と各マスタを保持するGoogleスプレッドシート |

---

## 6. 実際の処理経路

1. 本システムの利用者（sales／manager／sales_support／sysadmin）が「営業AIメモ｜利用開始・本人確認」を開く。
2. GASが会社Googleアカウントの担当者を確認する。
3. role が sales・manager・sysadmin の場合にのみ署名付きトークンを発行する。role が sales_support には発行しない。
4. role が sales・manager・sysadmin の場合は「商談メモを入力する」「日報を見る」の2つのボタンを表示する。role が sales_support の場合は「日報を見る」の1つのみを表示し、商談入力画面へのリンクは表示しない。いずれの role でも追記専用ボタンは表示しない。
5. 商談入力画面がトークンを受け取り、商談区分（訪問／電話）の選択、商談先店舗の指定、商談内容をまとめる。訪問時に「現在地から店舗を探す」を押した場合のみ位置情報を取得する。
6. 「営業AIメモ｜商談送信・保存API」へ送信する。
7. GASがトークン検証、担当者確定、商談区分・店舗指定の必須検証、店舗マスタからの正式名称の再取得（顧客店舗の確定）、AI解析を行う。店舗の確定はAI解析より前に行う。
8. 「営業AIメモ｜商談記録データ」のdeal_recordsへ保存する。
9. 商談入力画面内に保存結果を表示する。
10. 「日報を見る」の遷移先は role により異なる。sales・sysadmin は個人日報（S-05）、manager・sales_support は管理職向け日報まとめ（S-06）へ進む。追記画面（S-04）へ進めるのは、S-05を利用する sales・sysadmin のみである。対象の商談記録を選択して追記画面（S-04）で追記する。追記対象は record_id で特定する。元の商談記録は更新しない。

---

## 7. 正本との対応

- 要件定義書：FR-01、FR-02、FR-03、FR-09、FR-10（商談先店舗の指定）、FR-11（商談区分の選択）、FR-12（元記録への追記）
- 画面遷移図：S-00、外部S-02、S-03相当表示、S-04（追記画面）、S-05（個人日報）、S-06（管理職向け日報まとめ）、GASデプロイA・B
- API一覧：API-01、API-02、API-03、API-13〜19、API-28（generateManagerReport）、API-36（getMyDealRecords）、API-37（addDealAddition）、API-38（resolveCustomerStore）
- DB設計書：deal_records（V〜Z列を追加）、user_master、branch_master、store_master（F列addressを追加）、deal_additions（新設）、error_log
- 技術選定理由書：GAS 1プロジェクト・2デプロイ、外部静的ホスティング、GitHub Pages
- TASK_CURRENT.md：EX-05〜EX-09の実装・公開・URL・デプロイ履歴

---

## 8. 次の工程

次は、この文書の「営業AIメモ｜利用開始・本人確認」のURLを起点に、EX-09の実機確認を行う。

実機確認では、次を確認する。

- 担当者確認から商談入力画面へ進める
- 画面を開いた時点で位置情報の許可ダイアログが出ないこと
- 商談区分（訪問／電話）の選択
- 「現在地から店舗を探す」押下による近隣店舗候補表示
- 店舗選択または店舗名検索。マスタ未登録時の手入力
- 音声またはテキスト入力
- 店舗未指定での送信が拒否されること
- 送信成功と保存結果表示（確定した顧客名・商談区分が表示されること）
- deal_recordsのS・T列への緯度・経度の保存（訪問時のみ）、E・V・W列への顧客店舗の保存
- 失敗時の未送信テキスト保持

実機確認が終わるまで、EX-09完了確定とはしない。

---

## 9. 未決事項

2026-07-19 追加改修（店舗名・顧客名設計是正）に関する未決事項は0件である。
