# 【営業AIメモ】IS-R02_権限・日報・追記の改修

作成日：2026-07-19
作成：Claude（設計主幹）
文書種別：Codex向け実装指示書（1工程＝1本）
対応工程：開発工程表 第3版「工程R-02 権限・日報・追記の改修」
版数：第1版

---

## 1. 工程番号・工程名

- 工程番号：R-02
- 工程名：権限・日報・追記の改修
- 本工程の実装指示書は本書1本のみである。R-01の再改修、R-03の公開反映は本工程で行わない。

---

## 2. 目的

4ロール（`sales`／`manager`／`sales_support`／`sysadmin`）の権限、TOP画面の導線、日報の閲覧範囲、追記機能を一括で改修する。

具体的には次の状態にする。

- `validateUser`／`verifyToken` が `role` を返す
- TOP画面のボタンとトークン発行が role 別になる
- `sales_support` が送信APIを直接呼んでもサーバー側で拒否される
- 「日報を見る」の遷移先が role 別になる（sales・sysadmin＝S-05／manager・sales_support＝S-06）
- 追記（S-04）が `deal_additions` へ保存され、元記録が変更されない
- 日報（S-05・S-06）で元記録の直下に追記が表示される

---

## 3. 現在地

| 項目 | 状態 |
|---|---|
| R-01（基盤・入力・保存の改修） | 完了・ユーザー承認済み（本工程の着手条件） |
| R-01のGit commit | ローカルに存在。**未push** |
| R-02の実装 | **未着手** |
| R-03 | 未着手 |
| GAS公開デプロイの更新 | 未実施 |
| Git push | 未実施 |
| GitHub Pages反映 | 未実施 |
| 実通信確認・実機確認 | 未実施 |
| `deal_records` のテストデータ削除 | 未実施（R-03完了後の個別承認ゲート） |

---

## 4. 着手条件

次がすべて満たされている場合にのみ着手する。ひとつでも満たされない場合は着手せず、その旨を報告して停止する。

1. R-01がけんたろうの承認により完了している
2. 本指示書がけんたろうの承認を得ている
3. `user_master` に `role` 列が存在し、パイロット6名分の値（`sales`／`manager`／`sales_support`／`sysadmin` のいずれか）が登録されている
4. `deal_additions` シートが見出し行つきで存在する（R-01で作成済み）
5. `deal_records` にV〜Z列の見出しが存在する
6. R-01の一時確認関数（`tmpR01_` で始まるもの）が削除されている

3〜5が未了の場合は、実装を始めずに不足を報告して停止する。

---

## 5. 実装前に読むファイル

| # | ファイル | 読む理由 |
|---|---|---|
| 1 | `tasks/TASK_CURRENT.md` | 現在地・R-01の実施結果 |
| 2 | `docs/ルールブック.md` | 三者共通の運用規約（最上位） |
| 3 | `AGENTS.md` | Codexの不変ルール |
| 4 | `営業AIメモ_追加改修_変更設計_確定版.md` 第2版 | C-12〜C-16、C-21〜C-23、E-10、E-15、E-16、E-20 |
| 5 | `_営業AI音声メモ_API一覧_内部関数一覧_全フェーズ統合版v2.docx` v2.1 | API-01、API-02、API-16、API-17、API-18、API-28、API-36、API-37 |
| 6 | `_営業AI音声メモ_DB設計書_全フェーズ統合版v2.docx` v2.1 | 2-2（`role`・managerの閲覧範囲の判定手順）、2-8（`deal_additions`）、3-2（R-11・R-12・R-13） |
| 7 | `_営業AI音声メモ_要件定義書.docx` v3 | FR-03、FR-12、6-1 ユーザー権限 |
| 8 | `_営業AI音声メモ_画面一覧_項目定義_権限表.xlsx` v1.2 | 画面一覧S-00・S-04・S-05・S-06、項目定義（S-00／S-04／S-05／S-06のUI要素、追記シート）、権限表全体 |
| 9 | `_営業AI音声メモ_画面遷移図.docx` | S-00からS-05・S-06・S-04への遷移ルール |
| 10 | `営業AIメモ_URL_構成_名称再定義.md` v1.2 | §2・§3・§5・§6。新しいURL・ボタン種別を追加しないことの確認 |
| 11 | `TEST_PLAN.md` v1.2 | §1条件12・13・15、§2.8、§2.9 |
| 12 | `開発工程表.md` 第3版 | 工程R-02の範囲・変更禁止範囲・完了条件 |
| 13 | `【営業AIメモ】IS-R01_基盤・入力・保存の改修.md` | R-01との境界の確認 |

---

## 6. 現行実装で確認すべきファイル・関数・画面

| ファイル | 確認する関数・箇所 | 確認内容 |
|---|---|---|
| `src/01_auth.gs` | `doGet(e)` | `view` が `summary`／`daily`／それ以外の3分岐であること。`record_id` を見ていないこと |
| `src/01_auth.gs` | `validateUser()` | 戻り値が `{valid, userKey, userName, branchName, errorMessage}` の5項目で、`role` を返していないこと |
| `src/01_auth.gs` | `findUserMasterRow_()` | すでに `role` を読み取り、戻り値へ含めていること（`roleIndex >= 0` のとき） |
| `src/01_auth.gs` | `createTopPageModel_()` | roleに関係なく `issueToken` を実行し、入力画面リンクと日報リンクの両方を生成していること |
| `src/01_auth.gs` | `getCurrentUserRole_()`／`isManagerUser_()` | `isManagerUser_()` が `role === 'manager'` の完全一致であり、`sysadmin`・`sales_support` を通さないこと |
| `src/05_token.gs` | `verifyToken(token)` | 戻り値が `{valid, userKey, errorMessage}` で `role` を含まないこと |
| `src/05_token.gs` | `getUserMasterRows_()` | `role` を読み取っていないこと（`findUserMasterRow_` と異なる） |
| `src/05_token.gs` | `doPost(e)` | トークン検証後にroleを確認していないこと |
| `src/06_output.gs` | `getDailyReportData(userName)` | 担当者の絞り込みが `user_name`（表示名）であること |
| `src/06_output.gs` | `getManagerSummaryData()` | 冒頭で `isManagerUser_()` を呼び、当日分の全担当者を返していること。追記を読んでいないこと |
| `src/06_output.gs` | `createDailyPageModel_()` | `validateUser()` の `userName` で日報を取得していること |
| `src/06_output.gs` | `getDailyReportColumnIndexes_()` | 見出し名で列位置を解決していること（`user_key` は未対応） |
| `src/daily.html`／`src/summary.html` | テンプレート全体 | 追記の表示領域と追記ボタンが存在しないこと |
| `src/top.html` | ボタン部分 | `model.inputPageLinkUrl` があるときだけボタン群を出し、その中に日報ボタンを入れていること |

**現行コードに `generateManagerReport` は存在しない。** API-28（`generateManagerReport`）は出力側の集約関数であり、現行は `getManagerSummaryData()`／`notifyManagerSummary()` が該当機能を担っている。本工程では `generateManagerReport` を新規作成せず、既存の `getManagerSummaryData()` を API-36 準拠へ改修することで対応する（§9-6）。

---

## 7. 変更対象ファイル

| # | ファイル | 変更区分 |
|---|---|---|
| 1 | `src/01_auth.gs` | 修正 |
| 2 | `src/05_token.gs` | 修正 |
| 3 | `src/06_output.gs` | 修正（新規関数を追加） |
| 4 | `src/top.html` | 修正 |
| 5 | `src/daily.html` | 修正 |
| 6 | `src/summary.html` | 修正 |
| 7 | `src/addition.html` | **新規作成**（S-04 追記画面） |
| 8 | `tasks/TASK_CURRENT.md` | 追記（§24。工程の最後に更新する） |

上記8ファイル以外は変更しない。`src/00_setup.gs`・`src/02_ai.gs`・`src/03_write.gs`・`src/04_submit.gs`・`src/index.html`・`external/input-page/index.html`・`appsscript.json`・`.clasp.json` は本工程の対象外である。

---

## 8. 変更対象関数・HTML・シート

### 8-1. 関数

| 関数 | ファイル | 区分 |
|---|---|---|
| `validateUser` | `src/01_auth.gs` | 修正（`role` を戻り値へ追加） |
| `doGet` | `src/01_auth.gs` | 修正（`view`＋`record_id`＋roleで振り分け） |
| `createTopPageModel_` | `src/01_auth.gs` | 修正（role別のボタンとトークン発行） |
| `createManagerSummaryPageModel_` | `src/01_auth.gs` | 修正（manager／sales_support／sysadminを許可） |
| `createAdditionPageModel_` | `src/01_auth.gs` | **新規**（S-04） |
| `isManagerUser_` | `src/01_auth.gs` | 修正（`isSummaryViewer_` へ用途変更） |
| `getCurrentUserRole_` | `src/01_auth.gs` | 変更しない |
| `issueToken` | `src/05_token.gs` | 変更しない（呼び出し条件のみ変更） |
| `verifyToken` | `src/05_token.gs` | 修正（`role` を戻り値へ追加） |
| `getUserMasterRows_` | `src/05_token.gs` | 修正（`role` を読み取る） |
| `doPostMemo`（現行の `doPost`） | `src/05_token.gs` | 修正（`sales_support` の全action拒否） |
| `getMyDealRecords` | `src/06_output.gs` | **新規**（API-36） |
| `addDealAddition` | `src/06_output.gs` | **新規**（API-37） |
| `getDealAdditionsByRecordIds_` | `src/06_output.gs` | **新規** |
| `getUserKeysInSameBranch_` | `src/06_output.gs` | **新規** |
| `generateAdditionId_` | `src/06_output.gs` | **新規** |
| `createDailyPageModel_` | `src/06_output.gs` | 修正（`getMyDealRecords` を使う） |
| `getDailyReportData` | `src/06_output.gs` | 修正（`user_key` で絞り込む） |
| `getManagerSummaryData` | `src/06_output.gs` | 修正（role別の範囲判定・追記の併読） |
| `getDailyReportColumnIndexes_` | `src/06_output.gs` | 修正（`record_id`・`user_key`・`input_method` を追加） |
| `notifyDailyReport`／`notifyManagerSummary`／`runDailyDelivery`／`getOutputConfig`／`setupOutputConfig` | `src/06_output.gs` | 変更しない |

### 8-2. HTML

| ファイル | 変更内容 |
|---|---|
| `src/top.html` | role別のボタン表示。`model.inputPageLinkUrl` がない場合でも「日報を見る」を表示する構造へ変更 |
| `src/daily.html` | 追記の表示（元記録の直下）、追記画面への選択ボタン（`canAdd` が true のときのみ）、商談区分の表示 |
| `src/summary.html` | 追記の表示（元記録の直下）、閲覧範囲の説明表示。追記ボタンは表示しない |
| `src/addition.html` | **新規**。追記入力欄・保存ボタン・結果表示・S-05へ戻る導線 |

### 8-3. シート・列

| シート | 本工程での扱い |
|---|---|
| `deal_additions` | **書き込む**（A〜E列） |
| `deal_records` | **読み取りのみ**。更新・上書きは一切行わない |
| `user_master` | 読み取りのみ（`user_key`／`user_fullname`／`master_branch_name`／`active_flag`／`role`） |
| `store_master`／`error_log`／`output_config` | 変更しない（`error_log` への書込は既存の `logError` 経由のみ） |

---

## 9. 今回実装する内容

### 9-1. role の取得（`src/01_auth.gs`・`src/05_token.gs`）

1. `createValidationResult_` の引数と戻り値へ `role` を追加し、`validateUser()` が `{valid, userKey, userName, branchName, role, errorMessage}` を返すようにする。
   - `valid: true` の場合のみ `role` に値を入れる。`valid: false` のときは空文字
   - `findUserMasterRow_` はすでに `role` を返しているため、その値をそのまま使う
2. **role の妥当性検証**：`role` が `sales`／`manager`／`sales_support`／`sysadmin` のいずれでもない場合（空欄・`admin_staff`・不明値を含む）は、`valid: false` とし、`errorMessage` に「利用権限が設定されていません。管理者に連絡してください。」を設定する。
3. `src/05_token.gs` の `getUserMasterRows_()` に `role` の読み取りを追加する（`headers.indexOf('role')`。列がない場合は空文字とする）。
4. `verifyToken(token)` の戻り値へ `role` を追加する（`createTokenValidationResult_` を修正）。
   - `findUserMasterRowByHash_` が返した行の `role` を使う
   - `role` が4値のいずれでもない場合は `valid: false` とし、`errorMessage` に「利用権限が設定されていません。管理者に連絡してください。」を設定する
5. `submitMemo` から `Session.getActiveUser()` を呼ばない現行構造を維持する（送信API用デプロイBは匿名アクセスのため）。R-01で変更していないことを確認する。

### 9-2. TOP画面（`src/01_auth.gs`・`src/top.html`）

`createTopPageModel_()` を次に変更する。

1. `validateUser()` を呼び、`valid` でなければ現行どおりエラーメッセージのみのモデルを返す（トークンもリンクも生成しない）。
2. `role` によって分岐する。

| role | `issueToken` | `inputPageLinkUrl` | `dailyReportLinkUrl` の遷移先 |
|---|---|---|---|
| `sales` | 実行する | 生成する | S-05（`?view=daily`） |
| `manager` | 実行する | 生成する | S-06（`?view=summary`） |
| `sysadmin` | 実行する | 生成する | S-05（`?view=daily`） |
| `sales_support` | **実行しない** | **生成しない（空文字）** | S-06（`?view=summary`） |

3. `sales_support` のときは、`issueToken` を呼ばず、`getInputPageUrl_()` も呼ばない。
4. `dailyReportLinkUrl` は、`getDailyReportUrl()`（`DAILY_REPORT_URL`）を基に組み立てる。S-06向けは `getManagerSummaryUrl()` を使う（既存関数）。
5. 追記画面（S-04）へのボタンは、いずれの role でも**生成しない**。
6. `src/top.html` を次に変更する。
   - 「商談メモを入力する」は `model.inputPageLinkUrl` があるときだけ表示する（現行どおり）
   - 「日報を見る」は `model.dailyReportLinkUrl` があれば**単独でも表示する**（現行はボタン群全体が `inputPageLinkUrl` の有無に依存しているため、`sales_support` でボタンが1つも出なくなる。この依存を解消する）
   - モバイル用（`mobile-shell`）とデスクトップ用（`stack`）の**両方**を同じ条件に修正する
   - ボタン種別を追加しない（2種類のまま）

### 9-3. 送信APIの権限制御（`src/05_token.gs`・`doPost`）

`doPost(e)` を次に変更する。処理順を守る。

1. `parseRequestPayload_(e)` でリクエストを取り出す（現行どおり）
2. `verifyToken(token)` を実行する（現行どおり）。`valid !== true` ならここで拒否して終了する
3. **role の確認（新規。必須検証よりも前に行う）**
   - `verification.role === 'sales_support'` の場合、`action` の値にかかわらず拒否する
   - 戻り値：`{success: false, errorMessage: 'このアカウントでは商談入力を利用できません。日報の閲覧のみご利用いただけます。'}`
   - `submitMemo`（API-03）、`getStoreCandidates`（API-14）、`searchStoresByName`（API-15）、`resolveCustomerStore`（API-38）、`writeRecordsToSheet`（API-07）、AI解析（API-04）の**いずれへも進まない**
   - `role` が `sales`／`manager`／`sysadmin` の場合は従来どおり処理を継続する
4. 以降の `storeCandidates`／`storeSearch`／`submit` の分岐は、R-01で確定した内容を変更しない

画面側で「商談メモを入力する」を非表示にする制御だけに依存しない。

### 9-4. 画面の振り分け（`src/01_auth.gs`・`doGet`）

`doGet(e)` を次に変更する。

```
view = e.parameter.view
recordId = e.parameter.record_id
```

| view | record_id | role | 返す画面 |
|---|---|---|---|
| なし | — | 全role | S-00（TOP） |
| `daily` | なし | `sales`／`sysadmin` | S-05（`daily.html`） |
| `daily` | なし | `manager`／`sales_support` | **S-06（`summary.html`）へ自動遷移**。S-05を表示しない。アクセス拒否にはしない |
| `daily` | あり | `sales`／`sysadmin` | S-04（`addition.html`） |
| `daily` | あり | `manager`／`sales_support` | **アクセス拒否**。S-06へ自動遷移しない。対象 `record_id` の情報を一切表示しない |
| `summary` | — | `manager`／`sales_support`／`sysadmin` | S-06（`summary.html`） |
| `summary` | — | `sales` | アクセス拒否（エラーメッセージのみ） |
| 上記以外 | — | 全role | S-00（TOP） |

実装上の確定事項：

- 「自動遷移」は、**サーバー側で `summary.html` を返す**ことで実現する（`createPageHtmlOutput_('summary', createManagerSummaryPageModel_())`）。クライアント側のリダイレクトやURL書き換えは行わない。URLのパラメータは `view=daily` のままだが、表示されるのはS-06である
- 「アクセス拒否」は、拒否専用のモデル（`noticeMessage` に「このページを表示する権限がありません」を設定し、記録データを一切含めないモデル）で `addition.html` を返す。対象 `record_id` の顧客名・商談内容・担当者名を含めない
- 処理順は、①`validateUser()` を呼ぶ、②`role` を確認する、③上表で振り分ける、とする。role確定より前に記録データを読まない

### 9-5. 追記可能な商談記録一覧（`src/06_output.gs`・新規 `getMyDealRecords`）

API-36に従い、次を新規実装する。

```
getMyDealRecords(viewName)
  引数：viewName（'daily' または 'summary'）
  戻り値：{ success: Boolean, records: Array, errorMessage: String }
    records の各要素：
      { recordId, createdAt, customerName, dealTheme, dealContent,
        inputMethod, userName, canAdd, additions: [...] }
      additions の各要素：{ additionId, additionalRecord, addedAt, addedByName }
```

処理順：

1. `validateUser()` でログイン者を確認し、`role` と `branchName`（`master_branch_name`）を得る。無効・未登録なら空配列とエラーメッセージを返す
2. 画面と role の組み合わせをサーバー側で判定する

| viewName | role | 取得範囲 | `canAdd` |
|---|---|---|---|
| `daily` | `sales` | Z列 `user_key` が自分と一致する記録 | `true` |
| `daily` | `sysadmin` | 全件 | `true` |
| `summary` | `manager` | 同一 `master_branch_name` の担当者の記録（自分を含む） | `false` |
| `summary` | `sales_support` | 全件（全営業所・全営業担当） | `false` |
| `summary` | `sysadmin` | 全件 | `true` |
| 上記以外の組み合わせ | — | **データを返さない**（空配列） | — |

   `daily`＋`manager`、`daily`＋`sales_support`、`summary`＋`sales` には一切データを返さない。画面側の制御だけに依存しない。
3. `manager` の範囲は `getUserKeysInSameBranch_(branchName)`（新規）で判定する。`user_master` から `master_branch_name` が一致する行の `user_key` を列挙し、`deal_records` のZ列と突き合わせる。`manager_key` 列・上司列・対応シートは使用しない
4. 対象レコードの `record_id` を集め、`getDealAdditionsByRecordIds_(recordIds)`（新規）で `deal_additions` を検索し、`added_at` の昇順（追記日時順）で各レコードへ付与する
5. 追記者の表示は `user_master` から引き当てた `user_fullname` を使う。メールアドレスは戻り値に含めない
6. `user_key`（Z列）と `original_text`（K列）は戻り値に含めない
7. 件数の集計対象は `deal_records` の行のみとする。追記を加算しない
8. 表示順は `created_at` の降順（新しい順）とする

### 9-6. 日報画面（`src/06_output.gs`・`src/daily.html`・`src/summary.html`）

1. `getDailyReportColumnIndexes_(headers)` へ、`record_id`・`user_key`・`input_method` の列位置解決を追加する。いずれかが見つからない場合は例外を投げる（現行の見出し検証方式を踏襲する）。
2. `getDailyReportData(userName)` を **`user_key` 基準へ変更**する。
   - 引数を `userKey` に変更し、Z列 `user_key` の一致で絞り込む
   - 表示に使う担当者名はD列 `user_name` のまま維持する
   - 直近30日・集計時間窓（`output_config`）の扱いは現行のまま変更しない
3. `createDailyPageModel_()` を、`getMyDealRecords('daily')` の戻り値を使う形へ変更する。
   - `role` が `manager`／`sales_support` の場合、この関数は呼ばれない（`doGet` が S-06 を返すため）
   - 元記録の直下に追記を表示できるよう、モデルへ `additions` と `canAdd` を渡す
4. `getManagerSummaryData()` を `getMyDealRecords('summary')` の戻り値を使う形へ変更する。
   - 冒頭の `isManagerUser_()` による判定を廃止し、`getMyDealRecords` 側のrole判定に一本化する
   - `manager` は同一営業所、`sales_support` は全件、`sysadmin` は全件
   - `notifyManagerSummary()`／`runDailyDelivery()` から呼ばれる経路を壊さない。トリガー実行時（ログインユーザーがオーナー）に例外で停止しないよう、取得できない場合は空配列を返す
5. `isManagerUser_()` を `isSummaryViewer_()` に改め、`manager`／`sales_support`／`sysadmin` の3値で `true` を返すようにする。呼び出し箇所をすべて置き換える。
6. `src/daily.html` を次に変更する。
   - 各記録の表示項目へ**商談区分**（`input_method`）を追加する
   - 元記録の直下に「追記（日付・追記者）」の表示領域を追加し、追記日時順に並べる
   - `canAdd === true` の記録にだけ「追記する」ボタンを表示し、`?view=daily&record_id=xxx` へ遷移させる
   - `user_key`・メールアドレス・`original_text` を表示しない
7. `src/summary.html` を次に変更する。
   - 元記録の直下に「追記（日付・追記者）」の表示領域を追加し、追記日時順に並べる
   - **追記ボタンは表示しない**（`canAdd` の値にかかわらず、この画面には出さない）
   - 件数を表示する場合は元記録の行数のみを数え、追記を加算しない
   - `user_key`・メールアドレス・`original_text` を表示しない

### 9-7. 追記の保存（`src/06_output.gs`・新規 `addDealAddition`・`src/addition.html`）

API-37に従い、次を新規実装する。

```
addDealAddition(recordId, additionalRecord)
  戻り値：{ success: Boolean, additionId: String, addedAt: String, errorMessage: String }
```

処理順：

1. `Session.getActiveUser().getEmail()` でログイン中のメールアドレスを取得する
2. `validateUser()` で `role` を取得する。無効・未登録なら拒否する
3. `additionalRecord` が空文字（空白除去後）→ `{success:false, errorMessage:'追記内容を入力してください'}`
4. `recordId` で `deal_records` を検索する。見つからない → `{success:false, errorMessage:'対象の商談記録が見つかりません'}`
5. **所有者確認（サーバー側で必ず実施する）**

| role | 条件 | 判定 |
|---|---|---|
| `sales` | ログイン中のメールアドレス＝対象行のZ列 `user_key` | 許可 |
| `sales` | 不一致 | 拒否「この商談記録には追記できません」 |
| `sysadmin` | 常に | 許可 |
| `manager` | 自分の記録か他人の記録かにかかわらず | 拒否「この商談記録には追記できません」 |
| `sales_support` | 同上 | 拒否「この商談記録には追記できません」 |

6. `generateAdditionId_()`（新規）で `ADD-YYYYMMDD-HHMMSS-NNN` 形式の `addition_id` を採番する（`record_id`・`error_id` と同一方式。`NNN` は3桁ゼロ埋め）
7. `deal_additions` へ `addition_id`／`record_id`／`additional_record`／`added_at`／`added_by`（ログイン中のメールアドレス）を追加する
8. **元の `deal_records` 行は一切更新しない**

`src/addition.html`（新規）は次を持つ。

- 対象記録の表示（顧客名・案件テーマ・商談内容・登録日時。`user_key` は表示しない）
- 追記入力欄（`txt_addition`。自由文。音声入力は使用しない）
- 「追記を保存」ボタン（`btn_add_addition`）
- 追記結果表示（`lbl_addition_result`）
- 保存後は遷移元の個人日報（S-05／`?view=daily`）へ戻る導線
- 権限がない場合は、`noticeMessage` のみを表示し、対象記録の情報を表示しない

`google.script.run` で `addDealAddition` を呼ぶ。デプロイA（社内ドメイン限定）上の画面であり、署名付きトークンは使用しない。

---

## 10. 既存処理から変更する内容

| # | 既存処理 | 変更後 |
|---|---|---|
| 1 | `validateUser` が `role` を返さない | `role` を返し、4値以外は `valid:false` |
| 2 | `verifyToken` が `role` を返さない | `role` を返し、4値以外は拒否 |
| 3 | `getUserMasterRows_` が `role` を読まない | 読む |
| 4 | 全roleへトークンを発行 | `sales`／`manager`／`sysadmin` のみ |
| 5 | 全roleへ入力画面リンクを生成 | `sales_support` には生成しない |
| 6 | TOPのボタン群が `inputPageLinkUrl` の有無に依存 | 「日報を見る」は単独でも表示 |
| 7 | 「日報を見る」が全role同じ遷移先 | `sales`・`sysadmin`＝S-05／`manager`・`sales_support`＝S-06 |
| 8 | `doGet` が `view` のみで3分岐 | `view`＋`record_id`＋`role` で振り分け（S-00／S-04／S-05／S-06） |
| 9 | `doPost` がroleを見ない | `sales_support` の全actionを拒否 |
| 10 | `isManagerUser_` が `manager` 完全一致 | `isSummaryViewer_`（`manager`／`sales_support`／`sysadmin`） |
| 11 | 日報の絞り込みが `user_name`（表示名） | Z列 `user_key`（会社メールアドレス） |
| 12 | 日報に追記が表示されない | 元記録の直下に追記日時順で表示 |
| 13 | 追記機能が存在しない | S-04＋`deal_additions` への保存 |
| 14 | S-06が `manager` 限定・当日分の全担当者 | `manager`＝同一営業所／`sales_support`＝全件／`sysadmin`＝全件 |

---

## 11. 新規追加する内容

| 種別 | 名称 | 配置 |
|---|---|---|
| 画面 | S-04 追記画面 | `src/addition.html`（新規ファイル） |
| 関数 | `getMyDealRecords(viewName)`（API-36） | `src/06_output.gs` |
| 関数 | `addDealAddition(recordId, additionalRecord)`（API-37） | `src/06_output.gs` |
| 関数 | `getDealAdditionsByRecordIds_(recordIds)` | `src/06_output.gs` |
| 関数 | `getUserKeysInSameBranch_(branchName)` | `src/06_output.gs` |
| 関数 | `generateAdditionId_()` | `src/06_output.gs` |
| 関数 | `createAdditionPageModel_(recordId)` | `src/01_auth.gs` |
| 関数 | `isSummaryViewer_()`（`isManagerUser_` の置き換え） | `src/01_auth.gs` |
| 表示 | 追記表示領域（S-05・S-06）、追記ボタン（S-05のみ） | `src/daily.html`／`src/summary.html` |

---

## 12. 変更してはいけない範囲

- 利用者向け入口URL（1本）、デプロイA・BのURL、GASデプロイ構成（1プロジェクト・2デプロイ）
- 新しい画面URL・新規デプロイ・新規外部ページ・新しいボタン種別の追加（TOPのボタンは2種類のまま。追記専用ボタンを追加しない）
- `view=daily`／`view=summary` のパラメータ名（維持する）
- 元の `deal_records` 行の更新・上書き・削除
- 追記を商談件数・訪問件数・電話件数へ加算すること
- `user_key`（Z列）・メールアドレス・`original_text` の画面表示
- 署名付きトークン方式そのもの（発行条件のみ変更する）
- 外部入力画面（`external/input-page/index.html`）と、そこへの追記・過去記録の導線
- R-01の実装範囲（AI解析・店舗確定・保存・保存結果表示）の再改修
- 代理商談・代理電話コメント・代理追記
- `appsscript.json`・`.clasp.json`
- `src/00_setup.gs`・`src/02_ai.gs`・`src/03_write.gs`・`src/04_submit.gs`・`src/index.html`
- `manager_key` 列・上司列・manager-sales対応シートの追加
- `user_master`・`deal_records`・`store_master` の**データ行**

---

## 13. 削除・撤去対象

| # | 対象 | 場所 |
|---|---|---|
| 1 | `isManagerUser_()` の `role === 'manager'` 完全一致判定 | `src/01_auth.gs`（`isSummaryViewer_` へ置き換え） |
| 2 | `getManagerSummaryData()` 冒頭の `isManagerUser_()` による権限判定 | `src/06_output.gs`（`getMyDealRecords` のrole判定へ一本化） |
| 3 | `getDailyReportData(userName)` の `user_name` による絞り込み | `src/06_output.gs`（`user_key` へ変更） |
| 4 | `createTopPageModel_()` の無条件 `issueToken` 実行 | `src/01_auth.gs` |
| 5 | `src/top.html` のボタン群が `inputPageLinkUrl` の有無に全依存する構造 | `src/top.html`（モバイル用・デスクトップ用の両方） |
| 6 | `admin_staff` を許容する記述・分岐（存在する場合） | 全対象ファイル |

`src/index.html` は本工程でも変更・削除しない。

---

## 14. 一時確認処理を作る場合の名称と撤去条件

本工程のユーザー確認は、引数なしの一時確認関数で行う。Apps Scriptエディタは引数付きの関数を画面から直接実行できないため、`getMyDealRecords(viewName)`・`addDealAddition(recordId, additionalRecord)` を「GASエディタから直接実行する」方式は採らない。

**必ず作成する一時確認関数**

```
tmpR02_checkMyDealRecords()
  引数：なし
  戻り値：daily と summary の取得結果の要約
```

- 関数内部で `getMyDealRecords('daily')` と `getMyDealRecords('summary')` の両方を呼ぶ
- 戻り値には、各画面の**件数**、`canAdd` の値、取得できた営業所名の一覧、追記の件数だけを含める
- `user_key`、メールアドレス、トークン、署名値、`original_text` を、ログ・戻り値・画面のいずれにも出さない
- 実データを一切書き換えない

**条件付きで作成する一時確認関数**

```
tmpR02_checkAddDealAddition()
  引数：なし
  戻り値：{ success, additionId, errorMessage }
```

- 追記先の `record_id` と、追記する固定の確認文（例：`'tmpR02 動作確認'`）を**関数内で決め打ちする**。画面や引数から受け取らない
- **実行前に、対象 `record_id`・追加する内容・実行理由をけんたろうへ説明し、明示承認を得る**。承認前に実行しない
- 実行後、追加された `addition_id` を完了報告に明記する
- **元の `deal_records` 行は変更しない**（更新・上書き・削除を行わない）
- 追加した追記行は `deal_additions` に残る。この行はR-03完了後のテストデータ削除の対象として報告する

**共通ルール**

- 一時確認関数の名称は `tmpR02_` で始める。それ以外の名前で一時関数を作らない
- **一時確認関数はGit commitへ含めない**。R-02本体のコミット（§21）には一時関数を含めず、一時関数を追加・削除したことだけを理由に追加コミットを作らない
- 一時確認関数は `clasp push --force` でGASへ反映してよい（けんたろうが実行するため）
- **けんたろうの確認が完了した時点で削除する**。削除後、再度 `clasp push --force` を実行し、GAS側から一時関数が消えていることを確認する
- 削除後、作業ツリーに一時確認関数の差分が残っていないことを確認する（この時点では `tasks/TASK_CURRENT.md` が未更新のため、その差分は残ってよい）
- R-03へ持ち越さない
- 削除したこと、および作業ツリーの状態を完了報告に明記する

---

## 15. データ構造への影響

| 対象 | 影響 |
|---|---|
| `deal_additions` | 本工程から**データ行の書き込みが始まる**（A〜E列） |
| `deal_records` | **読み取りのみ**。列構成・データ行を変更しない |
| `user_master` | 読み取りのみ。`role` 列の値を参照する |
| `store_master`／`error_log`／`output_config` | 変更しない |

シートの新設・列追加は本工程では発生しない（R-01で実施済み）。もし `deal_additions` が存在しない、または `deal_records` にV〜Z列がない場合は、着手条件（§4）を満たさないため停止して報告する。

---

## 16. 権限への影響

本工程の中心である。実装後は次の状態になる。

| role | TOPのボタン | トークン | 送信API | S-05 | S-06 | S-04（追記） | 元記録の直接修正 |
|---|---|---|---|---|---|---|---|
| `sales` | 2つ | 発行する | 利用可 | 本人分・`canAdd=true` | 利用しない | 自分の記録のみ可 | 不可 |
| `manager` | 2つ | 発行する | 利用可 | 利用しない（S-06へ自動遷移） | 同一 `master_branch_name`・`canAdd=false` | 不可 | 不可 |
| `sales_support` | **1つ（日報を見る）** | **発行しない** | **全action拒否** | 利用しない（S-06へ自動遷移） | 全件・`canAdd=false` | 不可 | 不可 |
| `sysadmin` | 2つ | 発行する | 利用可 | 全件・`canAdd=true` | 全件 | 全記録へ可 | 可（G・H・L列の品質是正。スプレッドシート上の運用であり本工程では実装しない） |

`sysadmin` によるG列・H列・L列の直接修正は、スプレッドシート上での運用であり、コードでは実装しない（要件定義書 FR-08 運用）。

---

## 17. エラー処理

| # | 条件 | 応答 |
|---|---|---|
| 1 | `role` が4値のいずれでもない（空欄・`admin_staff`・不明値） | `validateUser`／`verifyToken` とも `valid:false`。「利用権限が設定されていません。管理者に連絡してください。」 |
| 2 | `sales_support` が送信APIを直接呼んだ（`submit`／`storeCandidates`／`storeSearch`） | `{success:false, errorMessage:'このアカウントでは商談入力を利用できません。日報の閲覧のみご利用いただけます。'}` |
| 3 | `sales` が `view=summary` へアクセス | 「このページを表示する権限がありません」。商談データを1件も表示しない |
| 4 | `manager`／`sales_support` が `view=daily`（`record_id` なし）へアクセス | S-06を表示する（拒否にしない） |
| 5 | `manager`／`sales_support` が `view=daily&record_id=xxx` へアクセス | 「このページを表示する権限がありません」。S-06へ自動遷移しない。対象 `record_id` の情報を一切表示しない |
| 6 | `addDealAddition` の `recordId` が存在しない | `{success:false, errorMessage:'対象の商談記録が見つかりません'}` |
| 7 | `addDealAddition` を `manager`／`sales_support` が呼んだ | `{success:false, errorMessage:'この商談記録には追記できません'}` |
| 8 | `sales` が他人の `record_id` を指定した | 同上 |
| 9 | `additionalRecord` が空文字 | `{success:false, errorMessage:'追記内容を入力してください'}` |
| 10 | `deal_additions` シートが存在しない | 例外を `logError('SHEET_WRITE_ERROR', ...)` へ記録し、`{success:false, errorMessage:'保存に失敗しました。しばらく経ってから、もう一度お試しください。'}` |
| 11 | `getMyDealRecords` で許可されない画面＋roleの組み合わせ | 空配列を返す。エラーメッセージは画面側の `noticeMessage` で扱う |

`recordId` は一覧画面から渡されるため改ざん可能な前提とし、サーバー側で必ず再検証する。

---

## 18. 静的チェック

作業後に必ず次を実行し、結果を報告する。

1. `node --check src/01_auth.gs`
2. `node --check src/05_token.gs`
3. `node --check src/06_output.gs`
4. `src/top.html`／`src/daily.html`／`src/summary.html`／`src/addition.html` のテンプレート構文確認（`<? ?>` スクリプトレットの開閉の対応、`<?= ?>` の閉じ忘れがないこと）
5. `git diff --check`
6. `git status` で、変更ファイルが§7の本体7ファイルだけであることを確認する（この時点では `tasks/TASK_CURRENT.md` は未更新でよい）
7. 旧仕様・権限抜けの残存確認（該当が0件であること）
   - `grep -rn "admin_staff" src/` → 0件
   - `grep -rn "isManagerUser_" src/` → 0件（`isSummaryViewer_` へ置換済み）
   - `grep -rn "role === 'manager'" src/` → `manager` 単独判定が閲覧可否に使われていないこと
   - `getDailyReportData` に `user_name` による絞り込みが残っていないこと
   - `doPost` の role 判定が、`storeCandidates`／`storeSearch`／`submit` の各分岐**より前**にあること
   - `doGet` が `validateUser()` の呼び出しより前に `deal_records` を読んでいないこと
8. `clasp status` で `src/addition.html` が tracked files に含まれることを確認する（新規ファイルのため反映漏れが起きやすい）

いずれかが失敗した場合は、`clasp push --force` を実行せず停止して報告する。

---

## 19. モック確認

実通信・実機を使わない範囲で次を確認する。実施した場合は方法と結果を、実施できない場合は「未実施」と明記する。

1. `doGet` の振り分けについて、`view`／`record_id`／`role` の全組み合わせ（§9-4の表の8行）で、返すテンプレート名が期待どおりであること
2. `getMyDealRecords` の画面＋roleの組み合わせについて、§9-5の表のとおりの取得範囲と `canAdd` になること。許可されない組み合わせで空配列が返ること
3. `addDealAddition` の所有者確認が、`sales`（本人）＝許可／`sales`（他人）＝拒否／`manager`＝拒否／`sales_support`＝拒否／`sysadmin`＝許可 となること
4. `generateAdditionId_()` が `ADD-YYYYMMDD-HHMMSS-NNN` 形式（`NNN` は3桁ゼロ埋め）を返すこと
5. `doPost` に `role='sales_support'` のトークン検証結果を与えたとき、3つの action すべてが拒否され、AI解析・店舗検索・シート書込のいずれの関数も呼ばれないこと

けんたろうによるロール切り替えを伴う実画面確認は、R-03で行う。

---

## 20. 条件付き `clasp push --force`

- 実行対象：**あり**
- 実行条件（ルールブック §8）：§18の静的チェックがすべて成功し、変更ファイルが§7の本体7ファイルだけであり、R-03の作業（公開反映）を前倒ししていないこと
- 実行コマンド：`clasp push --force`
- 実行前に `clasp status` で `src/addition.html` を含む tracked files を確認する
- 反映後、GAS側に `addition.html` が存在することを確認する（R-01でHTMLの反映漏れが起きた前例があるため）
- 次のいずれかに該当する場合は実行しない：構文確認でエラーが出た／対象外ファイルを変更した可能性がある／権限の抜けが残っている／既存機能を壊した可能性がある

---

## 21. Git操作の要否

| 操作 | 要否 |
|---|---|
| `git add`（本体7ファイル＋`tasks/TASK_CURRENT.md` の計8ファイル） | **行う** |
| `git commit` | **行う**。コミットメッセージ：`Implement R-02 role-based access, daily report scope and deal additions` |
| `git push` | **行わない**（R-03で行う） |
| 新しいブランチ・リポジトリの作成 | 行わない |
| 一時確認関数（`tmpR02_`）のコミット | **行わない**。追加・削除のいずれもコミットしない |

R-02の本体コミットは**1件**とし、本体7ファイルと `tasks/TASK_CURRENT.md` の計8ファイルを含める。一時確認関数の追加・削除を理由に追加コミットを作らない。R-01・R-02のコミットは未pushのままローカルに残す（**未pushの本体コミットは2件**）。R-03で既存リモートの既存ブランチへまとめてpushする。

**実施順（この順序を守る）**

1. 本体実装（§9）
2. 静的確認（§18）
3. 一時確認関数の追加と `clasp push --force` によるGAS反映（§14・§20）
4. **けんたろうによる機能確認**（§26 第1段階）
5. 一時確認関数の削除と再度の `clasp push --force`（§14）
6. `tasks/TASK_CURRENT.md` の更新（§24）
7. 本体7ファイル＋`tasks/TASK_CURRENT.md` を**1コミット**にまとめる
8. `git status` に未コミット差分がないことを確認する
9. Codexの完了報告（§25）
10. **けんたろうによるR-02完了承認**（§26 第2段階）

第1段階の機能確認は工程完了の承認ではない。完了承認は、9まで終わったあとに行う。

---

## 22. 外部入力画面側の反映方法

- 本工程では `external/input-page/index.html` を**変更しない**
- したがって GitHub Pages への反映は**なし**
- R-01で行った外部入力画面の変更も、本工程では公開反映しない（R-03で行う）

---

## 23. デプロイ更新の扱い

- デプロイA（営業AIメモ｜利用開始・本人確認）：**更新しない**
- デプロイB（営業AIメモ｜商談送信・保存API）：**更新しない**
- 新規デプロイの作成・URLの変更：行わない

本工程の変更はGASプロジェクトへは反映されるが、デプロイを更新しないため、公開URLの挙動は旧バージョンのままである。これを完了報告に明記する。

---

## 24. `TASK_CURRENT.md` へ記録する内容

§21の実施順6の時点で、`tasks/TASK_CURRENT.md` へ次を追記する（既存の記載は削除しない）。追記後、本体7ファイルと合わせて1コミットにする。

- 見出し：`## 42. 2026-07-19 R-02 権限・日報・追記の改修 実装`
- 変更したファイル（7点。`src/addition.html` は新規作成）と、各ファイルで変更した関数名
- 新規追加した関数（`getMyDealRecords`／`addDealAddition`／`getDealAdditionsByRecordIds_`／`getUserKeysInSameBranch_`／`generateAdditionId_`／`createAdditionPageModel_`／`isSummaryViewer_`）
- 4ロールの権限（TOPボタン・トークン発行・送信API・S-05／S-06・追記可否）の実装結果
- `sales_support` の送信API拒否をサーバー側で実装したこと
- 日報の絞り込みを `user_name` から `user_key` へ変更したこと
- 追記が `deal_additions` へ保存され、`deal_records` を更新しないこと
- 静的チェックの結果、`clasp push --force` の結果（`addition.html` の反映確認を含む）
- 一時確認関数（`tmpR02_checkMyDealRecords()`／`tmpR02_checkAddDealAddition()`）の確認結果、削除の実施、削除後の `clasp push --force` の結果
- `tmpR02_checkAddDealAddition()` を実行した場合は、承認を得た内容と追加された `addition_id`
- コミット予定のメッセージ：`Implement R-02 role-based access, daily report scope and deal additions`
- 本体7ファイルと `tasks/TASK_CURRENT.md` を**1コミット**にまとめる予定であること
- **Git push は未実施であること**
- 未実施・未確認の項目：デプロイA・B更新、GitHub Pages反映、実通信確認、4ロールの実機確認、R-03
- 次の状態：完了承認待ち。R-03未着手

`tasks/TASK_CURRENT.md` へ、**このとき作成するコミット自身のハッシュを書かない**（更新後にコミットするため、事前に確定しない）。確定したコミットハッシュは§25の完了報告にだけ記載する。コミット後に `tasks/TASK_CURRENT.md` へハッシュを追記して、追加コミットや `git commit --amend` を行わない。

---

## 25. Codexの完了報告形式

ルールブック §10 に従い、次の形式で報告する。

```text
- 判定：
- 変更したファイル：
- 変更した内容：
- 変更していない内容：
- 構文確認結果：
- clasp push --force 結果：
- TASK_CURRENT.md 更新内容：
- コミットしたファイル数・コミット数：
- コミットハッシュ（確定値。TASK_CURRENT.mdには書かない）：
- Git push：未実施
- git status の確認結果：
- 次の状態：
- ユーザーへの依頼：
```

「変更していない内容」には、少なくとも次を明記する。
`src/00_setup.gs`／`src/02_ai.gs`／`src/03_write.gs`／`src/04_submit.gs`／`src/index.html`／`external/input-page/index.html`／`appsscript.json`／`.clasp.json`／正本11点／`deal_records` のデータ行／Git push／GitHub Pages／デプロイA・B。

デプロイ更新と実画面確認を完了判定に含めない（ルールブック §18）。

---

## 26. ユーザー（けんたろう）が行う確認

確認は2段階に分ける。第1段階は機能確認であり、工程完了の承認ではない。

### 26-1. 第1段階：機能確認（実施順4）

| # | 依頼内容 |
|---|---|
| 1 | `user_master` の `role` に4値が正しく登録されていることの確認（`admin_staff` が残っていないこと） |
| 2 | GASエディタから **`tmpR02_checkMyDealRecords()`**（引数なし）を実行し、`daily` と `summary` の取得範囲・件数・`canAdd` を確認する |
| 3 | `tmpR02_checkAddDealAddition()` を使う場合は、**実行前に対象 `record_id`・追加内容・理由の説明を受けて明示承認する**。実行後、`deal_additions` へ1行追加され、元の `deal_records` 行が変わっていないことをスプレッドシートで確認する |
| 4 | 静的チェック結果と変更ファイル一覧を確認し、対象範囲を超えた変更がないことを確認する |
| 5 | **一時確認関数（`tmpR02_`）の削除と、削除後の `clasp push --force` を承認する** |

この時点ではR-02の完了承認を行わない。

### 26-2. 第2段階：工程完了承認（実施順10）

次がすべて終わったあとに、けんたろうがR-02の完了を承認する。

1. 一時確認関数の削除
2. 再度の `clasp push --force`
3. `tasks/TASK_CURRENT.md` の更新
4. 本体7ファイル＋`tasks/TASK_CURRENT.md` の1コミット作成
5. `git status` に未コミット差分がないことの確認
6. Codexの完了報告（§25。確定したコミットハッシュを含む）

承認までR-03へ進まない。4ロールを切り替えた実画面確認・デプロイ更新は本工程では依頼しない（R-03）。

---

## 27. 完了条件

次をすべて満たしたときにR-02を完了とする。

1. §7の本体7ファイルの修正・新規作成が完了し、§18の静的チェックがすべて成功している
2. 旧仕様・権限抜けの残存確認（§18の項目7）がすべて0件である
3. `clasp push --force` が成功し、`src/addition.html` がGAS側へ反映されている
4. `tmpR02_checkMyDealRecords()`（および使用した場合は `tmpR02_checkAddDealAddition()`）によるユーザー確認が完了し、一時確認関数が削除され、削除後の `clasp push --force` が成功している
5. `tasks/TASK_CURRENT.md` が§24のとおり更新されている
6. Git commit が**1件**作成され、本体7ファイル＋`tasks/TASK_CURRENT.md` の計8ファイルを含み、一時確認関数を含んでいない。**push は行われていない**（R-01と合わせて未pushの本体コミットは2件）
7. `tasks/TASK_CURRENT.md` を含め、`git status` に未コミット差分がない
8. Codexの完了報告（§25）が提出され、確定したコミットハッシュが報告されている（`tasks/TASK_CURRENT.md` にはハッシュを書いていない）
9. けんたろうが§26-1の機能確認を終えたうえで、§26-2のとおりR-02の完了を承認している

「4ロールの権限が画面側・サーバー側の両方で有効であること」の実画面による確認は、R-03のTEST_PLAN通し確認で行う。本工程の完了条件には含めない。

---

## 28. 停止条件

次に該当した場合は、作業を続けず、その時点で停止して報告する。

1. `user_master` に `role` 列がない、または4値以外の値が登録されている
2. `deal_additions` シート、または `deal_records` のV〜Z列が存在しない
3. 本来できないはずの操作ができる状態（権限の抜け）が解消できない
4. `master_branch_name` の表記ゆれで営業所を一意に判定できない
5. 元の `deal_records` 行を更新しなければ実装が完結しない状況になった
6. 新しいURL・デプロイ・ボタン種別を追加しなければ実装が完結しない状況になった
7. §7の8ファイル以外を変更する必要が生じた
8. 正本間に矛盾があり、どちらを採用するかCodexが判断できない
9. 静的チェックでエラーが解消できない
10. デプロイ更新・Git push・GitHub Pages反映が必要になった

---

## 29. 次工程には進まないこと

- 本工程の完了報告後、Codexは自動でR-03へ進まない
- R-03の実装指示書は、けんたろうがR-02の完了を承認したあとに適用する
- 公開反映（Git push、GitHub Pages、デプロイA・B更新）はR-03で行う。本工程では行わない
- 実通信確認・iPhone実機確認・TEST_PLANの通し確認はR-03で行う
- `deal_records` のテストデータ削除は、R-03完了後の個別承認ゲートで扱う。本工程では行わない

---

（本書は工程R-02のCodex向け実装指示書である。正本ではない。仕様の正は正本11点であり、本書は正本を書き換えない。）
