# TASK_CURRENT.md

営業AI音声メモ（営業メモ音声入力システム＋メモ活用）プロジェクトの作業台帳。
このファイルは、別チャットに引き継いでも単体で現在地が復元できることを目的とする。
claudeはプロジェクト内でチャット連携を持たないため、本ファイルが唯一の引き継ぎ手段である。

最終更新：2026-07-13（EX-01「外部HTTPS音声入力検証」完了。EX-02「外部ページ→GAS通信検証」完了。EX-03「GAS TOP認証・外部API公開方式検証」は実機確認の結果、同一デプロイでのTOPメール取得と外部POSTの両立は成立せず、停止条件に該当。案B改成立判定へは進まず、デプロイ分離または別GASプロジェクト方式の再検討が必要。`external/voice-poc/index.html` と `external/voice-poc/README.md` を新規作成し、GAS、認証、AI、スプレッドシート接続は実装していない。Git操作で EX-02 の2ファイルをコミット・push し、GitHub Pages は公開URLで EX-02 通信UI の表示を確認済み。通信テストは未実行。`src` 配下は変更していない。`external/voice-poc/index.html` の `<script>` 部分を一時 `.js` に抽出して `node --check` を実行し、構文エラーなしを確認済み。一時ファイルは削除済み。`window.SpeechRecognition` と `window.webkitSpeechRecognition` の両方を判定し、二重start防止、末尾追記、`external_voice_poc_text` の localStorage 保存、`unsent_text` 不使用、GAS/AI/スプレッドシート通信なし、外部ライブラリ・CDN不使用も確認済み。GitHub リポジトリ `https://github.com/xxxinakenxxx-hash/external-voice-poc` へ `index.html` と `README.md` を push 済み、commit メッセージは `Add EX-02 GAS communication test`、commit ID は `730b9da`。GitHub Pages は `Deploy from a branch`・`main`・`/(root)` で設定済み、公開URLは `https://xxxinakenxxx-hash.github.io/external-voice-poc/`。Windows 11＋Chrome、Android＋Chrome、iPhone＋Chrome で公開URLを実機確認し、いずれも音声入力が正常に動作した。iPhone＋Safari も別端末で正常動作を確認し、対応ブラウザとして扱う。1台目の iPhone＋Safari では iPhone 側でマイク使用を許可しても音声認識が起動しなかったが、原因は不明で端末固有の未解明事象として残す。GAS HtmlService内で発生していた音声認識拒否は、外部HTTPSページ化によって回避できることを確認した。EX-02 用に `external/gas-poc/` を新規作成し、`external/gas-poc/.clasp.json`、`external/gas-poc/appsscript.json`、`external/gas-poc/Code.gs`、`external/gas-poc/README.md` を追加した。`external/gas-poc/Code.gs` には `doGet(e)` を追加し、`Session.getActiveUser().getEmail()` の取得結果だけを表示する最小構成を入れ、`doPost(e)` は EX-02 の検証用受け口として維持した。`external/gas-poc/README.md` には、同一デプロイ、デプロイ分離、別GASプロジェクトの確認欄と手動確認項目を追記した。固定検証データは `token=EX02_DUMMY_TOKEN` と `text=EX-02 communication test`、使用 Content-Type は不要なプリフライトを避けるための `text/plain;charset=UTF-8`。`external/gas-poc/Code.gs` は一時 `.js` に抽出して `node --check` を実行し、構文エラーなしを確認済み。一時ファイルは削除済み。`external/gas-poc/` で `clasp push --force` を実行し、`appsscript.json` と `Code.gs` の 2 ファイルを反映した。`request to https://oauth2.googleapis.com/token failed, reason: connect ECONNREFUSED 127.0.0.1:9` の失敗は発生していない。Git操作、デプロイ操作、EX-04以降、IS-06 には未着手。EX-02 の実機確認で、GitHub Pages上の外部ページから検証用GASへPOST到達し、HTTP 200 を確認し、GAS の JSON 応答本文を外部ページで取得済み。receivedToken は `EX02_DUMMY_TOKEN`、receivedText は `EX-02 communication test`、CORS による拒否なし、Content-Type は `text/plain;charset=UTF-8`、GAS公開設定は「自分として実行」「アクセスできるユーザー：全員」、検証用GASへの `clasp push --force` は手動実行で成功、GitHub Pages 反映済み、EX-02 の停止条件には該当せず、EX-02 完了確定。EX-03 の実機確認結果を待ち、案B改成立判定はその後にChatGPTが行う。

---

## 1. 現在地

- 現在の状態：**EX-02 外部ページ→GAS通信検証 完了。EX-03「GAS TOP認証・外部API公開方式検証」は実機確認の結果、同一デプロイでのTOPメール取得と外部POSTの両立は成立せず、停止条件に該当。案B改成立判定へは進まず、デプロイ分離または別GASプロジェクト方式の再検討が必要。** `external/voice-poc/index.html` と `external/voice-poc/README.md` を新規作成し、GAS、認証、AI、スプレッドシート接続は実装していない。Git操作で EX-02 の2ファイルをコミット・push し、GitHub Pages は公開URLで EX-02 通信UI の表示を確認済み。通信テストは未実行。`src` 配下は変更していない。`external/voice-poc/index.html` の `<script>` 部分を一時 `.js` に抽出して `node --check` を実行し、構文エラーなしを確認済み。一時ファイルは削除済み。`window.SpeechRecognition` と `window.webkitSpeechRecognition` の両方を判定し、二重start防止、末尾追記、`external_voice_poc_text` の localStorage 保存、`unsent_text` 不使用、GAS/AI/スプレッドシート通信なし、外部ライブラリ・CDN不使用も確認済み。GitHub リポジトリ `https://github.com/xxxinakenxxx-hash/external-voice-poc` へ `index.html` と `README.md` を push 済み、commit メッセージは `Add EX-02 GAS communication test`、commit ID は `730b9da`。GitHub Pages は `Deploy from a branch`・`main`・`/(root)` で設定済み、公開URLは `https://xxxinakenxxx-hash.github.io/external-voice-poc/`。Windows 11＋Chrome、Android＋Chrome、iPhone＋Chrome で公開URLを実機確認し、いずれも音声入力が正常に動作した。iPhone＋Safari は別端末で正常動作を確認し、対応ブラウザとして扱う。1台目の iPhone＋Safari では iPhone 側でマイク使用を許可しても音声認識が起動しなかったが、原因は不明で端末固有の未解明事象として残す。GAS HtmlService内で発生していた音声認識拒否は、外部HTTPSページ化によって回避できることを確認した。EX-02 用に `external/gas-poc/` を新規作成し、`external/gas-poc/.clasp.json`、`external/gas-poc/appsscript.json`、`external/gas-poc/Code.gs`、`external/gas-poc/README.md` を追加した。`external/voice-poc/index.html` に GAS 通信検証 UI を追加し、`external/voice-poc/README.md` に EX-02 通信検証の説明を追記した。固定検証データは `token=EX02_DUMMY_TOKEN` と `text=EX-02 communication test`、使用 Content-Type は不要なプリフライトを避けるための `text/plain;charset=UTF-8`。`external/voice-poc/index.html` の `<script>` 部分と `external/gas-poc/Code.gs` はそれぞれ一時 `.js` に抽出して `node --check` を実行し、構文エラーなしを確認済み。一時ファイルも削除済み。`external/gas-poc/` で `clasp push --force` を実行したが、`request to https://oauth2.googleapis.com/token failed, reason: connect ECONNREFUSED 127.0.0.1:9` で失敗し、GAS 反映は未完了。継続作業として `external/gas-poc/` で `clasp push --force` を1回だけ再実行したが、同じ `request to https://oauth2.googleapis.com/token failed, reason: connect ECONNREFUSED 127.0.0.1:9` で失敗し、GAS 反映は未完了のまま停止した。Git操作で EX-02 の2ファイルをコミット・push し、GitHub Pages は公開URLで EX-02 通信UI の表示を確認済み。通信テストは未実行。EX-01 の内容そのものは変更していない。EX-01 の実機確認をやり直していない。EX-02 は実機通信未確認。認証、GAS API接続、AI、スプレッドシート接続、IS-06 には未着手。EX-02 の実機確認で、GitHub Pages上の外部ページから検証用GASへPOST到達し、HTTP 200 を確認し、GAS の JSON 応答本文を外部ページで取得済み。receivedToken は `EX02_DUMMY_TOKEN`、receivedText は `EX-02 communication test`、CORS による拒否なし、Content-Type は `text/plain;charset=UTF-8`、GAS公開設定は「自分として実行」「アクセスできるユーザー：全員」、検証用GASへの `clasp push --force` は手動実行で成功、GitHub Pages 反映済み、EX-02 の停止条件には該当せず、EX-02 完了確定。EX-03 は実機確認待ち。
- 次にやること：**EX-04 実装指示作成待ち**
- 追記：EX-03R 実機確認の結果、TOP用デプロイAを「アクセスユーザーとして実行」「自分として実行」の両方で確認したが、いずれも `Session.getActiveUser().getEmail()` は「取得できず」だった。`Session.getEffectiveUser().getEmail()` は `inamori240@marubishi-group.co.jp` を取得し、`EX03_API_URL` は送信API用デプロイBのURLを正常表示した。GitHub Pages の外部ページからデプロイBへのPOSTは成功し、HTTP 200、JSON応答取得、`receivedToken=EX02_DUMMY_TOKEN`、`receivedText=EX-02 communication test` を確認した。デプロイ分離でも「TOPのGoogleログイン中メール取得」と「外部POST」の同時成立は確認できなかったため、EX-03R は停止条件に該当する。EX-04以降、IS-06以降には進まない。
- 追記：EX-03R2 では `external/gas-poc/appsscript.json` の `oauthScopes` に `https://www.googleapis.com/auth/userinfo.email` を追加し、既存設定は維持した。JSON構文確認を行い、`external/gas-poc/` で `clasp push --force` を実行して `appsscript.json` と `Code.gs` の 2 ファイルを反映済み。次の状態はユーザーによる EX-03R2 実機確認待ち。
- 追記：EX-03R2 で `external/gas-poc/appsscript.json` の `oauthScopes` に `https://www.googleapis.com/auth/userinfo.email` を追加済み。JSON構文確認済み。`external/gas-poc/` で `clasp push --force` 成功済み。スコープ追加後、新規作成したTOP用デプロイAで確認し、実行するユーザー＝自分、アクセスできるユーザー＝marubishi-group.co.jp の全員、承認画面は表示されなかった。`Session.getActiveUser().getEmail()` で `inamori240@marubishi-group.co.jp` の取得に成功し、`Session.getEffectiveUser().getEmail()` でも `inamori240@marubishi-group.co.jp` の取得に成功した。`EX03_API_URL` はデプロイBのURLを正常表示し、GitHub Pages の外部ページからデプロイBへのPOSTを再確認して HTTP 200、JSON応答取得成功、`receivedToken=EX02_DUMMY_TOKEN`、`receivedText=EX-02 communication test` を確認した。TOP認証と外部POSTが同時に成立し、EX-03R2 の完了条件を満たしたため、EX-03 は成立。次の状態は「案B改成立判定待ち」。EX-04以降、IS-06以降には未着手。
- 追記：EX-03R2 の実機確認結果により、TOP用デプロイで `Session.getActiveUser().getEmail()` の取得に成功した。送信API用デプロイで、GitHub Pages からの外部POST、HTTP 200、JSON応答取得に成功した。TOP認証と外部POSTが同時成立し、EX-03 は成立、案B改は成立と判定した。EX-03R および EX-03R2 の検証は完了した。次の状態は「EX開発工程表に従う次工程の実装指示作成待ち」。EX-04以降、IS-06以降にはまだ着手していない。
- 追記：案B改成立後の正本文書改訂を DOC-01 として完了した。改訂した正本は要件定義書、API一覧・内部関数一覧、技術選定理由書、案件概要書、画面遷移図、画面一覧・項目定義・権限表の6点で、DB設計書はトークンがステートレスでDB追加がないため改訂不要とした。要件定義書へ外部入力画面、S-00 TOP、トークン、外部ホスティング、2デプロイ構成、OAuthスコープを反映し、API一覧へ API-16〜19 を追加して API-01・API-03・処理シーケンスを案B改へ更新した。技術選定理由書へ外部ホスティング、音声入力外部化、認証、2デプロイ、匿名送信APIのリスクを反映し、案件概要書を案B改構成に更新した。画面遷移図は GAS TOP、外部入力、送信API、トークン検証の構成へ差し替え、画面一覧へ S-00 を追加して S-02外部化、token、unsent_text、2デプロイ構成を反映した。2026-07-08確定事項の退行はなく、Word・Excelの形式確認済み、要件定義書と画面遷移図のPDF目視確認済み、技術選定理由書のWhisper行の実在確認だけ未確認として残した。次の状態は「EX-04 実装指示作成待ち」。EX-04以降の実装には未着手。
- **参考**：手順3成果物（開発工程表・工程00配置md 11本・AIプロンプト設計書・実装指示書 IS-01〜IS-08）は `/mnt/user-data/outputs/` に出力済み。正本7ファイルの手順2反映もproject_knowledgeに反映済み（project_knowledge_searchでGoogleログイン版・store_masterを確認済み）
- 次にやらないこと：
  - 複数工程をまとめて指示しない（1工程＝1指示書）
  - Phase 2の正本作成・未確認事項に先に手をつけない（手順4の実装と並行で手順5以降）
  - 現在地を推測で補完しない。実装状況を推測しない
  - ファイル名・列位置等、正本に答えがある事項を照合せず決めない（8章参照）

### 1-1. 手順1で確定・反映済みの修正内容（差分表A〜F・確定版）※履歴として保持

- **A-1（音声入力デフォルト化）**：音声を主・テキストを補助とする主従関係に改訂。「音声入力の品質（iPhone依存）によっては並列運用に変更する場合がある」旨を注記
- **B（GPS記録）**：確定（FR-09としてPhase 1正本に反映済み）
- **C-1（通話録音の取り込み方式）**：レベル0（iPhoneの文字起こしを営業担当が手作業でコピー＆ペーストしてS-02入力欄から送信。新規開発ゼロ）で確定
- **C-4／C-5**：C-1がレベル0のため、API一覧・画面一覧/画面遷移図とも修正なし
- **D-4（開発パイプライン）**：①デスクトップ版Codexでコード編集→②ローカルで編集→③GASへ`clasp push --force`。GitHub・Web版Claude Codeは介在しない
- **E-1（record_id桁数）**：3桁ゼロ埋めに統一
- **E-2（赤背景の範囲・色）**：#FF0000・空欄セル単位（E/G/H列）に統一
- **E-3（書込列数）**：Phase 1書込は12列固定、シート全体定義は18列（＋GPS3列S〜U）と両文書に明記
- **F（活用3案のPhase 1繰入）**：#13日報・#14マネージャー資料・#15朝TODO配信をPhase 1側MVPに含める形に案件概要書8章を修正

### 1-2. 手順2で確定した内容（2026-07-08・全項目けんたろう判断済み）※§1-3で正本反映済み

| # | 論点 | 確定内容 |
|---|---|---|
| 1・3 | GPS→店舗確定フロー | **外部API不使用**。送信時にGPS取得→店舗マスタ（新設、顧客名＋緯度経度）と距離照合→**近い順に4店舗を候補表示**→タップ選択で確定。該当なし→**店舗名を手入力**→部分一致で名寄せ候補表示→選択で確定。マスタにも該当なしは手入力文字列をそのまま格納、マスタ追加は管理者運用 |
| 2 | GPS同意画面 | 設けない。ブラウザ標準の許可ダイアログのみ。ON/OFF切替UIも不要 |
| 4 | GPS列位置 | S・T・U列（19〜21列目）で確定。既存A〜L列は不変 |
| 5 | 担当者識別 | **Googleログイン方式**。GASが `Session.getActiveUser().getEmail()` でメールアドレスを自動取得→担当者マスタ照合。user_key＝メールアドレス。**S-01（初回設定画面）と担当者情報のlocalStorage保存は廃止**。会社はGoogle Workspace契約済み。※未送信テキスト保全（FR-01）のlocalStorage利用は継続 |
| 6 | 音声デフォルト化 | 自動録音なし。マイクボタンを上部に大型配置。iPhoneの変換品質次第で並列運用に変更（A-1） |
| 7 | AIモデル | **OpenAI APIで確定**。Phase 1のAI使用箇所はFR-04（商談テキストの構造化・分割、送信ごと1回）のみ |
| 8 | 通話録音（レベル0） | 会社iPhoneは全員同型・iOS 18.3.1で条件クリア。「録音前提で進め、MVPまで実施、お客様反応で継続判断」で確定 |
| 9 | branch_master・error_log | 両シート採用 |
| 10 | DB仮定昇格 | ①record_id連番3桁 ②過去レコード不更新 ③無効フラグ担当者はマスタ不一致と同じエラー——3件確定 |
| 11 | デザイン | 配色は暫定値（#1a3a5c／#e8913a等）で実装続行。入力系（S-02〜03）はスマホ画面中心、分析・レポート系（Phase 2）はPC向け |

残るけんたろうアクション（実装をブロックしない・並行実施）：
- 専務了承の取得（通話録音の運用。方針は#8で確定済み）
- 店舗マスタの初期データ整備（パイロット6名の主要顧客の緯度経度をGoogleマップで調べて手入力。S-02店舗候補テストまでに必要）

### 1-3. 正本への反映＝完了（2026-07-08）

**§1-2の確定を正本7ファイルに反映し、`/mnt/user-data/outputs/` にWord/Excelで出力・検証済み。** 各ファイルの反映内容：

| ファイル | 反映済みの内容 |
|---|---|
| 要件定義書 | FR-03/NFR-03/制約#9=Googleログイン化・S-01廃止。FR-09=送信時取得・店舗マスタ照合フロー・S〜U列。FR-04/5-2/5-3=OpenAI API確定・逆ジオ行削除。未決#1/#6/#7/#8=確定クローズ。8章のS-01記述を廃止明記（節番号は維持） |
| 案件概要書 | 7-1/7-2/前提#4/#9/制約#10/完成条件/未決#1/#6=Googleログイン・OpenAI・店舗マスタ照合に改訂 |
| DB設計書 | user_master=user_key＝メールアドレス（仮定#1解消）。**store_master（2-7）新設**：store_id/store_name/latitude/longitude/active_flag。deal_records U列=店舗マスタ照合に改訂（物理名store_name_gpsは不変）。R-08追加。仮定#1/#3/#4/#7/#8/#9/#10/#11を確定昇格 |
| API一覧 | API-02 validateUser=引数なし・Session取得でGoogleログイン照合。**API-14 getStoreCandidates（GPS距離・近い順4件）・API-15 searchStoresByName（部分一致名寄せ）を新設**（旧resolveStoreNameFromGpsを置換）。submitMemo=userKey/userName廃止（サーバー側Session取得）・storeName引数追加。API-07=S〜U列書込明記。処理シーケンス・設計前提もGoogleログイン化 |
| 画面一覧・項目定義・権限表（xlsx） | S-01廃止（画面一覧・UI要素・権限表）。S-02にlist_store_candidates（店舗候補リスト）・txt_store_manual（店舗名手入力）を追加。user_name/user_key/lbl_user_nameをGoogleログイン化。権限表「初回設定」→「Googleログイン」、「担当者名の変更」削除 |
| 画面遷移図 | **graphvizで新規作成（Googleログイン版）**。S-01・localStorage担当者判定・担当者変更導線を削除。送信フローにGPS取得→店舗候補選択を追加。図＋凡例＋遷移ルール補足＋変更点をWord化 |
| 技術選定理由書 | 3-4=OpenAI API、3-6=Googleログイン方式、3-9=店舗マスタ照合に改訂。リスク・負債予防策・未決事項も整合 |

**残存キーワードの扱い（意図的に残した正当なもの）**：
- localStorage＝未送信テキスト（unsent_text）の一時保全用途のみ（担当者情報の保存には使わない）
- Gemini/Claude＝③OEM事例システム（別案件）の説明、AIモデル選定の経緯、切替候補の文脈のみ
- 逆ジオコーディング＝「使用しない／不採用」と明記した箇所のみ

---

## 1-4. 手順3で使う新規設計要素（実装指示書の材料）

§1-3で正本に追加・変更した、実装に直結する要素。手順3の開発工程表・実装指示書はこれを前提に組む。

**認証（Googleログイン）**
- `validateUser()`（API-02、引数なし）：`Session.getActiveUser().getEmail()` でメールアドレス取得→user_master照合→{valid, userKey, userName, branchName, errorMessage}
- S-01（初回設定画面）は廃止。doGetは担当者情報のlocalStorage確認をしない（未送信テキストのみ確認）
- submitMemo（API-03）はクライアントから担当者情報を受け取らず、サーバー側でSession取得

**店舗マスタ照合（GPS）**
- 新シート `store_master`（DB設計書2-7）：store_id / store_name / latitude / longitude / active_flag
- `getStoreCandidates(lat, lng)`（API-14）：store_masterと距離計算し近い順4件を返す
- `searchStoresByName(name)`（API-15）：部分一致で名寄せ候補を返す
- 確定した店舗名は submitMemo の payload.storeName で受け取り、deal_records U列（store_name_gps）に格納
- リレーション R-08：store_master.store_name → deal_records.store_name_gps
- deal_records GPS列：S=latitude / T=longitude / U=store_name_gps（19〜21列目）
- writeRecordsToSheet（API-07）はA〜L列に加えS〜U列も書込対象

**S-02のUI追加**
- list_store_candidates（近い順4店舗のタップ選択）／txt_store_manual（該当なしの手入力→名寄せ）

**AI**
- OpenAI API（Chat Completions）。callAiApi を再利用。System Promptのモデル名指定を変えれば切替可能

---

## 1-5. 手順3の成果物（2026-07-09・完了）

すべて `/mnt/user-data/outputs/` に出力済み。位置づけは「正本（Word/Excel）を正とした、Codex/実装用のmd」。正本を二重管理しない。運用規約はルールブック.mdを正とする。

**開発工程表.md**：工程00〜08（Phase 1）。00準備／01データの器／02入り口と本人確認／03AI仕分け／04書き込み／05入力画面と送信（初回テスト公開）／06位置と店舗選び／07完了画面／08仕上げ。デプロイの初回は工程05に統一（工程02〜04はGASエディタでの関数確認まで）。配信3案（#13〜15）は入力工程完了後に別工程で定義。

**工程00で配置するmd 11本**：
- AGENTS.md（Codexの不変ルール。全工程共通で必ず読む3つ＝tasks/TASK_CURRENT.md・docs/ルールブック.md・AGENTS.md を明記。工程別に読むmdは実装指示書が指定。src分割の標準方針を提示）
- PROJECT_OVERVIEW.md（目的・範囲・やらないこと）
- SPEC_WEBAPP.md（機能範囲・業務ルール＝FR抜粋）
- DB_SCHEMA.md（5シート抜粋。deal_records A〜U／M〜Rは活用フェーズで見出し枠のみ・データ書かない）
- SCREEN_FLOW.md（S-02・S-03、S-01廃止、SPA）
- API_INTERNAL.md（API-01〜15。API-20以降はPhase 2で対象外）
- TEST_PLAN.md（完成条件・合格観点。工程08で使う）
- 利用者確認観点.md／フィードバック一覧.md（パイロット確認・指摘記録）
- 運用手順書.md（パイロット運用。Git不使用）
- MVP_HANDOVER.md（引継ぎ枠。完了確定は実画面確認後）

**AIプロンプト設計書.md**：getSystemPrompt が返す System Prompt 本文＋few-shot例を確定（6キーJSON配列＝customer_name/customer_type/deal_theme/deal_content/todo_item/todo_deadline、分割ルール・粒度・期限そのまま）。IS-03はこの確定版を実装する。

**実装指示書 IS-01〜IS-08**：ルールブック§7の10項目構成。全ISに「工程管理（ChatGPT）への指示の出し方」（端折り禁止・けんたろうの作業を1ステップずつ・6章の作業依頼をそのまま伝える）を明記。工程00はCodexを動かさないため指示書なし。

**record_id 衝突対策の決定**：全拠点展開（50名）時に案A（record_id末尾に担当者識別子〔user_keyのハッシュ数桁〕を付与）を採用と確定。パイロット（6名）では衝突しないため **Phase 1では実装しない**（正本のrecord_id形式 YYYYMMDD-HHMMSS-NNN のまま）。全拠点展開の判断時に、DB設計書を更新してから実装する。

---

## 2. 役割分担

| 役割 | 担当 | 主な作業 |
|---|---|---|
| 監督（人間） | けんたろう | 目的・仕様判断・承認・差戻し・画面目視確認・デプロイ判断 |
| 管理・指揮 | ChatGPT | 要件整理・工程指揮・実装指示プロンプト作成・codex報告の読み解き |
| 実装 | codex | 指示範囲の実ファイル編集・静的チェック・条件付き clasp push --force・完了報告 |
| 文書作成・基本設計 | claude | 正本文書の作成、基本設計、開発工程表、実装指示書（プロンプト化はChatGPT） |

### 実装作業の基本フロー（codex）
1. ローカルで修正 → 2. GASへ `clasp push --force` → 3. デプロイを手動実行 → 4. /exec 画面確認
（静的チェックは別に実施）

---

## 3. 正本・参照資料（最新版）

設計確定前に必ず照合する。§3の一覧が正。「仕様書①Webアプリ／仕様書②生成AI分析」という名称は存在せず使わない。

| 資料 | 版・状態 | フェーズ |
|---|---|---|
| 要件定義書（入力フェーズ） | v3＋手順1＋**手順2反映済み（要差し替え）** | Phase 1（分冊） |
| 要件定義書（活用フェーズ） | v1.0（2026-06-17） | Phase 2（分冊） |
| 案件概要書（入力フェーズ） | 2026-03-31版＋手順1＋**手順2反映済み（要差し替え）** | Phase 1（分冊） |
| 案件概要書（活用フェーズ） | v1.0（2026-06-17） | Phase 2（分冊） |
| DB設計書 | 全フェーズ統合版v2＋手順1＋**手順2反映済み（store_master新設・要差し替え）** | Phase 1＋2 |
| API一覧・内部関数一覧 | 全フェーズ統合版v2＋手順1＋**手順2反映済み（getStoreCandidates/searchStoresByName新設・要差し替え）** | Phase 1＋2 |
| 画面遷移図 | **Googleログイン版で新規作成済み（要差し替え）** | Phase 1のみ |
| 画面一覧・項目定義・権限表 | 手順1＋**手順2反映済み（要差し替え）** | Phase 1のみ |
| 技術選定理由書 | v1.0＋手順1＋**手順2反映済み（要差し替え）** | Phase 1のみ |
| クロスレビュー報告書 | v1.0。**本物Word。正本の体裁テンプレート基準として保持** | Phase 1分のみ |
| 未確認事項確認書 | Phase 1分は§1-2で完了。Phase 2分は手順5 | — |
| ルールブック.md / TASK_CURRENT.mdの書き方.md | 受領済み | 運用規約／テンプレート |

### 資料の切り分けルール（確定）
- フェーズ別に作る：要件定義書、案件概要書
- 統合1冊：API一覧、DB設計書
- Phase 2分が未作成：画面遷移図、画面一覧・項目定義・権限表、技術選定理由書、クロスレビュー報告書

---

## 4. 確定事項

### 4-1. Phase定義
- Phase 1＝入力（貯める）。Phase 2＝活用（output）。

### 4-2. 2026-07-07営業打ち合わせの追加案（手順1・2で正本反映済み）
- 入力3案：①音声入力デフォルト（§1-2 #6） ②GPS＋店舗名（§1-2 #1〜4・店舗マスタ照合） ③通話記録メモ化（レベル0・§1-2 #8）
- 活用3案（Phase 1側MVP・既存FR実装）：①日報→FR-34 ②マネージャー集約→FR-34 ③朝TODO→FR-25＋FR-32

### 4-3. 活用10案 採用一覧（Phase 2向けOUTPUT。#13〜15は既存FR実装）

| # | 案名 | 群 | 成果物 | 実装区分 | 対応FR | 駆動 | 対象 |
|---|---|---|---|---|---|---|---|
| 3 | 引継ぎブック | A 商談支援 | 文書 | Claude Code拡張 | 新規 | オンデマンド | 営業／管理 |
| 4 | 同業態×同課題 照合 | B ナレッジ | 回答・示唆 | Claude Code拡張 | 新規(FR-35関連) | 投稿発火 | 営業 |
| 8 | 失注分析→ナレッジ編纂 | B ナレッジ | レポート | Claude Code拡張 | 新規 | 定期 | 管理 |
| 11 | 自己成長QA掲示板 | B ナレッジ | Web資産 | Claude Code拡張 | 新規 | 投稿発火＋定期 | 営業 |
| 7 | クロスセル全社スキャン | C 経営可視化 | xlsx | Claude Code拡張 | 新規 | 定期 | 管理 |
| 10 | 月次経営報告スライド | C 経営可視化 | pptx | Claude Code拡張 | 新規 | 月次 | 管理 |
| 12 | 営業AIダッシュボード | C 経営可視化 | Web可視化 | Claude Code拡張 | 新規(FR-34表示先) | 定期更新 | マネージャー |
| 13 | 各担当者の日報 | C 経営可視化 | 配信・文書 | 既存FR実装 | FR-34 | 日次 | 営業／管理 |
| 14 | マネージャー向け集約資料 | C 経営可視化 | 配信・文書 | 既存FR実装 | FR-34 | 日次/週次 | マネージャー |
| 15 | 朝のTODO配信 | 配信基盤 | チャット配信 | 既存FR実装 | FR-25/FR-32 | 日次 | 営業 |

- Claude Code拡張の新規7案＝#3・4・8・11・7・10・12（Phase 2の個票展開対象）
- Phase 2の画面設計方針：分析・レポート系はPC向け（入力系はスマホ中心）

### 4-4. 判断記録（非採用・保留・別Phase・一覧外）

| # | 案名 | 判定 | 理由 |
|---|---|---|---|
| 1 | 原料コスト変動→代替提案書 | 却下 | 取扱原料が市場価格と連動しない |
| 1' | 商品部の価格変更メール→週刊レポート | 別Phase | 1の代替案。後続フェーズ |
| 2 | OEM事例マッチング | 保留 | ③OEM事例システムがHTML段階で停滞。先方待ち |
| 5 | 機器デモ後フォロー | 却下 | 必要性が低い |
| 6 | 季節商材の地域別需要予測 | 保留 | データ蓄積が前提。現段階は困難 |
| 9 | 新規GAS機能の自作 | 一覧外 | OUTPUTでなく開発手段。カタログ対象外 |

### 4-5. 作業手順（確定・6ステップ）と進捗

| 順 | 作業 | 担当 | 状態 |
|---|---|---|---|
| 1 | 入力3案＋役割分担・ルールブック導入のPhase 1正本書き換え | claude | **完了**（2026-07-07） |
| 2 | Phase 1未確認事項確認表でMVP確定 | claude作成→けんたろう判断 | **完了**（2026-07-08。§1-2） |
| — | §1-2確定の正本7ファイル反映（Word/Excel化） | claude | **完了**（2026-07-08。§1-3。要プロジェクト差し替え） |
| 3 | 開発工程表・実装指示書を作成（Phase 1→MVP） | claude | **完了**（2026-07-09。§1-5。工程表・md11本・AIプロンプト設計書・IS-01〜08） |
| 4 | 手順3成果物をローカル配置→Codexへ実装引き渡し（IS-01から） | けんたろう／ChatGPT／codex | **次** |
| 5 | 活用10案に基づくPhase 2正本作成 | claude | 未着手（Phase 1実装と並行予定） |
| 6 | Phase 2の未確認事項確認表 | claude作成→けんたろう判断 | 未着手 |
| 7 | 開発工程表・実装指示書を作成（Phase 2） | claude | 未着手 |

成果物カタログ（既完成）：「活用フェーズ拡張_ユースケースカタログ_v1.0.docx」作成済み。

---

## 5. 未確認・保留・注意事項

### 5-1. Phase 1の未確認事項
**全件クローズ（2026-07-08、§1-2）。** けんたろう側の並行アクション2件（専務了承・店舗マスタ初期データ）のみ残（実装非ブロック）。

### 5-2. Phase 2の未確認事項（手順5でつぶす。まだ開かない）
- Phase 2正本作成後に洗い出す。現段階では着手しない。

### 5-3. 注意
- claudeはプロジェクト内チャット連携なし。本ファイルが命綱。判断根拠と表データを原文粒度で残す。
- 打ち合わせ・協議・正本作成の記録は、別チャットで「見るだけ」で足りるよう表を省略せず記載する。
- OpenAI API使用量予測を開発/PoC段階で作り直し、課金上限（月間予算）・自動チャージ設定を再設定する（現状は自動チャージ有効。パイロット中は月間予算を下げる推奨）。

---

## 6. 禁止事項・固定ルール（ルールブック準拠）

- 推測で現在地を補完しない。次工程へ自動で進まない。「実装済み」と「完了確定」を混同しない。
- 指定外ファイル・指定外関数を変更しない。ユーザー確認待ちのまま完了扱いにしない。
- GAS反映は必ず `clasp push --force` と書く。
- 既存のシート名・列名・関数名・画面名・ファイル構成・値定義・業務用語を勝手に変更・改名しない。
- 承認ゲート（Git操作・デプロイ・外部通信・外部API追加・DB/シート/列変更等）は人間の明示承認を得てから。
- 認証情報・APIキー・トークン等は見ない・触らない・出力しない。

### 6-2. 応答の鉄則（claudeの応答時に最優先）
- 結論・目的を先に書く。前置きや過程を先に並べない。
- 「私は何をすればいいか」には最初の一文で「あなたがやること」を動作と回数で言い切る。
- 指示が曖昧なら、説明前に「何を決める話か」を一行で問い返す。
- 枝葉の論点を持ち出さない。先回りで広げない。付け足さない。
- ミスは最初の一文で「私のミスです。○○が間違いでした」と認める。言い訳・背景を後ろに付けない。謝罪は一度だけ。
- ユーザーが既に出した結論を、別案・言い換え・選択肢で蒸し返さない。聞き直さない。
- 一度確定したことを勝手に再オープンしない。
- **表・記号ばかりの提示をけんたろうに承認させない。仕様変更は「業務としてどう変わるか」を記号なしの平易な言葉で説明する（技術記号の表は承認材料にしない）。**

### 6-3. 説明義務（2026-07-07確定）
- 「理解できない」「意味が分からない」は拒否として扱う。承認済み扱いにしない。
- 同じ圧縮表現・略語を言い換えるだけで繰り返さない。まだ書いていない具体的内容を新たに追加して説明する。
- 明示の「はい」「OK」がない限り確定扱いにしない。

### 6-5. 正本ファイルの形式と反映タイミング（重要・2026-07-08更新）
- **正本はWord（.docx）／Excel（.xlsx）で管理する。** 過去のチャットでclaudeが正本docxの中身をMarkdownプレーンテキストに変換して.docx拡張子で保存していた（表・図が壊れる原因）。2026-07-08に本物のWord/Excelへ再構築した。
- **docx生成手順**：Markdown内容を修正→`pandoc 修正.md -o out.docx`（reference-docは指定しない＝pandoc標準の罫線付きTableスタイルになる）。reference-docにクロスレビュー報告書を使うと表が罫線なしになるため使わない（体裁テンプレートが必要な場合はフォント埋め込みを除去してから使う）。python-docxで開けることを必ず検証。
- **xlsx**：openpyxlで値書換・行削除・行挿入（挿入行は隣接行からスタイルコピー）。既存書式を保持。
- **画面遷移図（図）**：graphviz（dot）で作成。日本語は `IPAGothic` フォント指定（Noto Sans CJK SCは中国語字形が混じるため不可）。PNG化してpython-docxで埋め込み。
- チャット内の `/mnt/project` の実体はチャット開始時点で固定。差し替え後は新チャットで、または `project_knowledge_search` で最新を読む。**正本の修正・出力は差し替え後に新チャットで行う。**

---

## 7. 次回チャット冒頭で読むこと

- まずこの TASK_CURRENT.md を読む。現在地を推測しない。実装状況を推測しない。
- 現在地：**手順3＝完了（§1-5）。次＝けんたろうが成果物をローカル配置→手順4（Codexへ実装引き渡し、IS-01から1工程ずつ）**
- 手順3の成果物は§1-5に一覧。すべて `/mnt/user-data/outputs/` に出力済み（開発工程表・md11本・AIプロンプト設計書・IS-01〜08）。
- 実装はIS-01（データの器）から。工程00はCodexを動かさない準備工程のため実装指示書なし。1工程＝1指示書、まとめない。
- 各実装指示書は「全工程共通で必ず読む3つ＋その工程で読むmd」を指定済み。ChatGPTがCodex向けプロンプトに変換する際、けんたろうの作業を端折らず1ステップずつ伝える（各IS冒頭に明記）。
- Codexの完了報告→けんたろうのデプロイ・実画面確認→次工程、の順。「実装済み」と「完了確定」を混同しない。
- Phase 2（手順5以降）は、Phase 1実装と並行で着手可。ただし勝手に先行しない。

---

## 8. ルール違反ログ

同じ種類のミス（確認せず推測で進める・検証せず断定する）を繰り返さないため、違反パターンを事前に読む。

### 2026-07-07

| # | 違反内容 | 該当ルール | 詳細 |
|---|---|---|---|
| 1 | 未承認の内容を承認済みとして進めた | 絶対ルール／6-3 | C-1の選択を2回拒否された直後、確認なく「レベル0で確定」として進めた |
| 2 | 略語・圧縮表現を、説明を求められた後も繰り返した | 6-3 | 「Lv」を説明せず使用し、指摘後も繰り返した（5回） |
| 3 | 誤った情報を正本の修正指示に含めた | 絶対ルール | 開発パイプラインを誤記載 |
| 4 | 修正一覧を提示済みと誤認させた | 応答の鉄則 | 一覧を出さないまま着手許可を求めた |
| 5 | ファイルの実体を検証せず提出した | 絶対ルール／7 | 「.docx」が実際はプレーンテキストで、Word破損エラー |
| 6 | ファイル名を典拠と照合せず推測で3回誤った | 絶対ルール | 一次資料の個別照合で最終確定 |
| 7 | 確認不足の自覚がなかった | 絶対ルール全般 | 指摘まで独立した違反と認識せず |

### 2026-07-08

| # | 違反内容 | 該当ルール | 詳細 |
|---|---|---|---|
| 8 | 検証せず「反映されない」と断定した | 推測で補完しない | 差し替え後、/mnt/project実体のみ見て断定。project_knowledge_searchで読めた |
| 9 | 情報の所在を誤って説明した | 応答の鉄則 | プロジェクト指示欄の文面を「メッセージ冒頭に再掲」と誤説明 |
| 10 | 正本docxをMarkdownに変換して保存していた（過去チャット分の発覚） | 絶対ルール／7 | 正本7ファイルが.docx拡張子だが中身はMarkdownテキストだった。表・図が壊れた状態。2026-07-08に本物Word/Excelへ再構築して解消。今後は§6-5の手順で扱う |
| 11 | 承認材料として技術記号ばかりの対応表を提示した | 6-2 | 「記号ばかりで確認しろと言うのか」と指摘。業務影響を平易な言葉で説明し直した。仕様説明は§6-2の平易化ルールに従う |

### 2026-07-08（手順3着手時・重大）

| # | 違反内容 | 該当ルール | 詳細 |
|---|---|---|---|
| 12 | 冒頭指示を無視した | 絶対ルール／ルールブック§20 | 「まずルールブックとtaskを確認し、そのうえで手順3に進む」という冒頭指示を守らず、ルールブックの開発順序を踏まえないまま応答した |
| 13 | 開発順序を理解せず、この段階で存在しえない事項を確認した | ルールブック§1（無駄な確認の防止）／§4（検討前に聞く禁止）／§11 | 開発順序は「正本→開発工程表・実装指示書→Codexが実装」。実装指示書がまだない＝コードは未着手なのは自明。にもかかわらず「コードがどこまで作ってあるか」をけんたろうに繰り返し尋ねた。手順3は私が正本から工程分解する作業であり、実装状況の確認は不要 |
| 14 | 引き継ぎメモを誤読し、ありもしない食い違いを作り確認を求めた | 推測で補完しない／応答の鉄則 | §7「次の実装フェーズは I-5 を含む」を「実装済みの前提」と誤読した。実際は手順3で作る実装指示書が扱う工程の話であり、実装済みを意味しない。誤読を根拠にけんたろうへ確認を求めた |
| 15 | 記号（工程番号・節番号）を意味の説明なしに並べ、けんたろうに調べさせた | §6-2／ルールブック§13／既存#11の再発 | I-5・§7・§4-5・I-1〜I-4 等を平易化せず提示。#11と同種の再発 |

**再発防止（次回チャットで適用）：**
- ファイル名・列位置・桁数など正本に答えがある事項は、答える前に一次資料を開いて照合する
- 「できない・反映されない」と断定する前に、全手段（ファイル実体＋project_knowledge_search）で検証する
- ユーザーが選択を拒否したら、次の発言で確定扱いにしない。明示の承認を得るまで保留
- ファイル成果物は、出力前に必ず開ける形式か検証（python-docx／openpyxl）。docxは§6-5の手順で本物Wordにする
- けんたろうへの仕様説明は記号を避け、業務としてどう変わるかを平易な言葉で伝える（§6-2）
- **冒頭指示を最優先で実行する。「ルールブックとtaskを確認→手順3に進む」なら、確認後ただちに正本から工程分解に入る。実装状況の確認・けんたろうへの状態確認を挟まない。**
- **開発順序（正本→開発工程表・実装指示書→Codexが実装）を判断の前提にする。実装指示書ができるまでコードは書かれない。「実装状況」を確認対象にしない。**
- **引き継ぎメモは開発順序に照らして解釈する。工程番号（I-5等）の出現を「実装済み」と読み替えない。手順3で工程表・実装指示書に落とし込む対象を指すと解釈する。**

---

## 9. 2026-07-14 EX-04 追記

- 現在の状態：**EX-04 外部入力専用マイクページ本体 作成・静的チェック・Git反映完了。** `external/input-page/index.html` と `external/input-page/README.md` を新規作成し、音声入力・手入力・未送信テキスト保全・ダミー送信表示だけを実装した。GAS、認証、AI、スプレッドシート接続、位置情報、トークンは実装していない。`external/input-page/index.html` の `<script>` 部分を一時 `.js` に抽出して `node --check` を実行し、構文エラーなしを確認済み。一時ファイルは削除済み。HTML に外部リソース・担当者情報・機密文字列の混入がないことを確認済み。Git commit は `6db80a4`、push は `origin/master` と `origin/main` の両方へ反映済み。GitHub Pages 公開URLは `https://xxxinakenxxx-hash.github.io/external-voice-poc/external/input-page/`。`src` 配下と `external/voice-poc/`、`external/gas-poc/` は変更していない。
- 次にやること：**EX-05 署名付きトークンの発行・検証 実装指示待ち**