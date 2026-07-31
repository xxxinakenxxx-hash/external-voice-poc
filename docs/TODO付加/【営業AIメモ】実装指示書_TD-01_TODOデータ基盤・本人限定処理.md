# 【営業AIメモ】実装指示書 TD-01：TODOデータ基盤・本人限定処理

版数：第1.1版  
作成日：2026年7月28日  
改訂日：2026年7月28日  
工程：TD-01  
前提工程：TODO機能・個人日報表示改善の設計・正本文書改訂完了  
基となる文書：`【営業AIメモ】TODO機能・個人日報表示改善_改善計画書.md`

---

## 1. 工程名・目的

**工程名：** TODOデータ基盤・本人限定処理

**目的：**  
本人が現在対応中のTODOだけを保存する`todo_tasks`シート定義と、本人限定の取得・登録・編集・完了削除処理を実装する。

この工程では、TODO画面、TOP画面、個人日報画面を変更しない。

---

## 2. 着手前の必須条件

次のすべてを確認してから着手する。1つでも満たさない場合、ファイルを変更せず停止する。

1. `tasks/TASK_CURRENT.md`で、現在工程が「TODO付加 TD-01 着手前整備」またはTD-01着手待ち相当に整理されている。
2. 日報検索機能のSRCH工程が実装中ではない。
3. R-03以前の未完了作業が、TD-01と並行して残っていない。
4. `【営業AIメモ】TODO機能・個人日報表示改善_改善計画書.md`が、本改善の上位文書として整理済みである。
5. `営業AIメモ_URL・構成・名称再定義.md`は既存入口を増やさない方針と矛盾しない範囲で参照できること。全面改訂完了を着手条件にしない。
6. `src/07_todo.gs`が存在しない。
7. `todo_tasks`シートが未作成である。既に存在する場合は列を推測して使用せず停止する。

---

## 3. 着手前に読むもの

### 全工程共通

1. `tasks/TASK_CURRENT.md`
2. `docs/ルールブック.md`
3. `AGENTS.md`

### 本工程で追加して読むもの

1. `【営業AIメモ】TODO機能・個人日報表示改善_改善計画書.md`
2. `営業AIメモ_URL・構成・名称再定義.md`
3. 最新のDB設計書
4. 最新のAPI一覧・内部関数一覧
5. `docs/DB_SCHEMA.md`
6. `docs/API_INTERNAL.md`
7. `src/00_setup.gs`
8. `src/03_write.gs`
9. `src/06_output.gs`

文書間に矛盾がある場合は、採用する仕様をCodexが決めず停止する。

---

## 4. 変更してよいファイル

- `src/00_setup.gs`
- `src/07_todo.gs`（新規）
- `docs/DB_SCHEMA.md`
- `docs/API_INTERNAL.md`
- `tasks/TASK_CURRENT.md`

一時確認ファイルを作る場合は、ファイル名の先頭を`tmp_td01_`とし、完了報告前に削除する。

---

## 5. 今回の作業

### 5-1. `todo_tasks`シート定義

`src/00_setup.gs`の`SETUP_SHEET_DEFINITIONS_`へ、既存定義を変更せず次を追加する。

| 列 | 物理名 | 内容 |
|---|---|---|
| A | `todo_id` | TODO識別子 |
| B | `user_key` | 所有者 |
| C | `customer_name` | お客様名。社内TODOは空欄可 |
| D | `todo_content` | TODO内容 |
| E | `due_date` | 期限。`yyyy-MM-dd`または空欄 |
| F | `priority` | 高・中・低 |
| G | `source_record_id` | 元商談ID。直接登録は空欄 |
| H | `created_at` | 登録日時 |

この工程では`setupSheets()`を実行しない。実シートの作成はユーザー承認後に行う。

### 5-2. TODO処理ファイル

`src/07_todo.gs`を新規作成する。

#### 公開関数

次の関数名を使用する。

```text
getMyTodoTasks()
createTodoTask(payload)
createTodoFromDeal(recordId)
updateTodoTask(payload)
completeTodoTask(todoId)
```

#### 戻り値

成功時：

```javascript
{ success: true, task: {...}, errorMessage: '' }
```

一覧取得時：

```javascript
{ success: true, tasks: [...], errorMessage: '' }
```

失敗時：

```javascript
{ success: false, errorMessage: '利用者向けメッセージ' }
```

内部例外、メールアドレス、`user_key`、スタックトレースをクライアントへ返さない。

### 5-3. 共通認証

すべての公開関数で、処理開始時に`validateUser()`を実行する。

TODO機能を利用できるロールは次だけとする。

- `sales`
- `sysadmin`

`manager`と`sales_support`は、直接関数を呼び出しても拒否する。

クライアントから`user_key`を受け取らない。所有者は`validateUser()`の結果だけから決定する。

### 5-4. 一覧取得

`getMyTodoTasks()`は、ログイン中の本人の行だけを返す。

返却する項目：

```text
todoId
customerName
customerDisplayName
todoContent
dueDate
priority
sourceRecordId
createdAt
dueState
```

- `customer_name`が空欄なら`customerDisplayName`を「その他」とする。
- `dueState`は`overdue`、`today`、`future`、`none`のいずれか。
- `user_key`は返さない。
- シートに他人の行があっても返さない。

### 5-5. 直接登録

`createTodoTask(payload)`の入力項目：

```text
customerName
todoContent
dueDate
priority
```

規則：

- `todoContent`は必須。
- `customerName`は空欄可。
- `dueDate`は空欄または実在する`yyyy-MM-dd`だけを許可する。
- `priority`は「高」「中」「低」だけを許可する。
- `priority`が空欄の場合は「中」とする。
- `source_record_id`は空欄で保存する。
- `created_at`はGAS側で作る。
- `user_key`は認証結果から作る。

### 5-6. 日報由来登録

`createTodoFromDeal(recordId)`は、`deal_records`をサーバー側で再取得する。

クライアントからTODO内容、期限、顧客名、`user_key`を受け取らない。

次を確認する。

1. `recordId`が存在する。
2. 元商談の`user_key`がログイン本人と一致する。
3. 同一`user_key`・同一`source_record_id`の有効TODOが存在しない。

初期値：

- お客様名：元商談の`customer_name`
- TODO内容：`todo_item`があればそれ。空欄なら既存の商談要点生成結果
- 期限：有効な`deadline_normalized`があればその日付。無効・空欄なら空欄
- 重要度：中
- `source_record_id`：元商談の`record_id`

元商談取得用の列は、ヘッダー名で特定する。固定列番号を直書きしない。

### 5-7. 編集

`updateTodoTask(payload)`の入力項目：

```text
todoId
customerName
todoContent
dueDate
priority
```

- `todo_id`と認証済み`user_key`の両方が一致する行だけを更新する。
- `todo_id`、`user_key`、`source_record_id`、`created_at`は変更しない。
- TODO内容、期限、重要度の検証は登録時と同じ。
- 他人の`todoId`を指定した場合は更新しない。

### 5-8. 完了削除

`completeTodoTask(todoId)`は、`todo_id`と認証済み`user_key`が一致する行を1行だけ削除する。

- `status`列を追加しない。
- `completed_at`列を追加しない。
- 完了履歴シートを作らない。
- `deal_records`を変更しない。
- `deal_additions`を変更しない。
- 他のTODO行を変更しない。

### 5-9. TODO ID

TODO IDは、利用者入力ではなくGASで生成する。

形式：

```text
TODO-yyyyMMddHHmmss-XXXXXXXX
```

- `XXXXXXXX`はUUIDから得た8文字。
- タイムゾーンは既存の`WRITE_RECORD_TIMEZONE_`を再利用する。
- 同時登録でも重複しにくい方式とする。

### 5-10. 内部ヘルパー

少なくとも次の責務をprivate関数へ分ける。

- TODOシート取得
- ヘッダー検証と列位置取得
- 認証・ロール判定
- 期限正規化
- 重要度正規化
- TODO行の表示オブジェクト化
- 所有者付きTODO行検索
- 元商談のTODO初期値取得
- 同一商談の有効TODO判定
- TODO ID生成

既存関数名を変更しない。

### 5-11. 実装用Markdown

`docs/DB_SCHEMA.md`と`docs/API_INTERNAL.md`は、改訂済みの正本文書に合わせて更新する。

正式API-IDは後続の正本文書整理時に採番する。TD-01では、本改善内の管理番号として次を扱う。

- TD-API-01 `getMyTodoTasks`
- TD-API-02 `createTodoTask`
- TD-API-03 `createTodoFromDeal`
- TD-API-04 `updateTodoTask`
- TD-API-05 `completeTodoTask`

実装では、管理番号よりも実装指示書に明記された関数名・入力・戻り値・権限・副作用を正とする。

---

## 6. やってよいこと

- 指定ファイルだけを最小差分で変更する。
- 新規`src/07_todo.gs`を作る。
- 入力検証と本人限定のサーバー側判定を追加する。
- 隔離モック用の一時ファイルを作成し、終了後に削除する。
- 条件を満たした場合に限り`clasp push --force`を実行する。

---

## 7. やってはいけないこと

- `setupSheets()`を実行しない。
- `todo_tasks`を実データ上に作らない。
- 実TODOを登録・編集・削除しない。
- `src/01_auth.gs`、`src/top.html`、`src/daily.html`を変更しない。
- TODO画面を作らない。
- TOP導線を作らない。
- 日報検索機能を前倒ししない。
- `deal_records`、`deal_additions`の列・データを変更しない。
- manager・sales_supportへTODO権限を追加しない。
- 完了履歴を作らない。
- Google Chat・メール・デスクトップ通知を追加しない。
- `appsscript.json`、`.clasp.json`、認証情報を変更・閲覧しない。
- デプロイ、Git commit、Git pushを行わない。
- TD-02以降へ進まない。

---

## 8. 作業後に必ず実行すること

1. 変更ファイルが指定範囲内か確認する。
2. `.gs`を一時`.js`へコピーして`node --check`を実行し、一時ファイルを削除する。
3. `git diff --check`を実行する。
4. 隔離モックで次を確認する。
   - 本人の行だけ取得
   - 他人の取得・更新・削除拒否
   - 直接登録
   - 日報由来登録
   - 同一商談の重複拒否
   - 期限なし
   - 不正日付拒否
   - 不正重要度拒否
   - 対象1行だけ削除
   - `deal_records`と`deal_additions`への書込みなし
5. `tmp_td01_`で始まる一時ファイルが0件であることを確認する。
6. `tasks/TASK_CURRENT.md`を更新する。

---

## 9. `clasp push --force`

**条件付きで実行する。**

この指示書をCodexへ渡す時点で、ユーザーがTD-01のファイル変更と`clasp push --force`を明示承認している場合だけ実行する。

実行前条件：

- 静的チェック成功
- 隔離モック成功
- 指定外ファイル変更なし
- 実シート操作なし
- TD-02以降の前倒しなし

実行場所は現行`.clasp.json`の`rootDir`に従う。`clasp login`、`clasp logout`、`clasp run`は実行しない。

---

## 10. `TASK_CURRENT.md`更新内容

次を記録する。

- TD-01を実装したこと
- 変更したファイル
- 新規関数名
- `todo_tasks`列定義
- 本人限定・重複防止・完了削除の実装内容
- 静的チェック結果
- 隔離モック結果
- `clasp push --force`結果または未実行理由
- `setupSheets()`未実行
- 実シート未作成
- 実データ未操作
- Git操作未実施
- 次の状態：ユーザーによる`todo_tasks`作成確認待ち
- TD-02未着手
- TD-01完了判定は未実施

過去の履歴を削除・書き換えない。

---

## 11. ユーザー確認依頼

Codexの報告には次の5行だけを記載する。

```text
【ユーザー確認依頼】
確認場所：GASファイル「00_setup.gs」、関数「setupSheets」。
確認内容：実行後、営業AIメモ｜商談記録データに「todo_tasks」が作られ、A～Hが計画書の見出しと一致するか確認してください。
確認不要：既存シートの中身や既存画面は今回は確認不要です。
結果を「OK / NG / 違和感あり」で返してください。TD-02には進みません。
```

Codexは`setupSheets()`を実行しない。

---

## 12. 完了条件

- 指定ファイルだけが変更されている。
- TODOの取得・登録・編集・完了削除が本人限定で実装されている。
- 同一商談の有効TODO重複が拒否される。
- 完了時に対象行だけを削除する。
- 完了履歴を作っていない。
- 静的チェックと隔離モックが成功している。
- 条件付き`clasp push --force`の結果が記録されている。
- ユーザーが`todo_tasks`の作成とA～Hの見出しを確認している。
- `TASK_CURRENT.md`が更新されている。
- TD-02には未着手である。

---

## 13. 停止条件

- 前提文書が未改訂または矛盾している。
- `TASK_CURRENT.md`がTD-01開始状態ではない。
- SRCH工程が実装中である。
- `src/07_todo.gs`が既に存在する。
- `todo_tasks`が既に存在する。
- 本改善内の管理番号、関数名、入力、戻り値、権限、副作用の定義と実装指示が矛盾する。
- 指定外ファイル変更が必要になる。
- 既存シート・既存データの変更が必要になる。
- 実TODOデータを使わないと確認できない。
- 静的チェックまたは隔離モックが失敗する。
- `clasp push --force`の承認がない。

停止時は代替手段を試さず、対象・理由・未実施内容を報告する。

---

## 14. Codex完了報告形式

完了報告は必ずコードブロックで返す。

```text
- 判定：
- 読んだファイル：
- 変更したファイル：
- 追加した関数：
- 変更した内容：
- 変更していない内容：
- 静的チェック結果：
- 隔離モック結果：
- git diff --check結果：
- clasp push --force結果：
- setupSheets実行有無：
- 実データ操作有無：
- TASK_CURRENT.md更新内容：
- 停止条件該当の有無：
- 次の状態：
- ユーザーへの依頼：
```

---

## 15. 工程管理への注意

- TD-01のCodex報告とユーザーのシート確認が終わるまで、TD-02の指示を出さない。
- ユーザーの「はい」を、シート確認OKや次工程承認へ読み替えない。
- `todo_tasks`確認がNGの場合は、TD-01内の修正として扱う。
