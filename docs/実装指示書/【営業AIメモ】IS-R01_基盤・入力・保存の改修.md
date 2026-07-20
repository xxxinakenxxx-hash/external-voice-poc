# 【営業AIメモ】IS-R01_基盤・入力・保存の改修

作成日：2026-07-19
作成：Claude（設計主幹）
文書種別：Codex向け実装指示書（1工程＝1本）
対応工程：開発工程表 第3版「工程R-01 基盤・入力・保存の改修」
版数：第1版

---

## 1. 工程番号・工程名

- 工程番号：R-01
- 工程名：基盤・入力・保存の改修
- 本工程の実装指示書は本書1本のみである。R-02・R-03の作業を本工程で行わない。

---

## 2. 目的

商談入力からAI解析、顧客店舗の確定、保存、保存結果表示までを、2026-07-19改訂の正本に合わせて一括で改修する。

具体的には次の状態にする。

- `deal_records` がA〜L列＋S・T列＋V〜Z列で記録される（U列へは書き込まない）
- AI出力から `customer_name` が消え、顧客名はGASが画面指定の店舗から確定する
- 訪問／電話を営業担当が画面で選択し、店舗指定が必須になる
- 位置情報は「現在地から店舗を探す」を押したときだけ取得する
- 抽出失敗の判定と赤背景がG列・H列だけになる

---

## 3. 現在地

| 項目 | 状態 |
|---|---|
| 正本11点の改訂 | 完了（2026-07-19） |
| 正本のクロスレビュー | 完了 |
| 開発工程表 第3版（R-01〜R-03の3工程） | 確定 |
| R-01の実装 | **未着手** |
| R-02・R-03 | 未着手 |
| GAS公開デプロイの更新 | 未実施 |
| Git push | 未実施 |
| GitHub Pages反映 | 未実施 |
| 実通信確認・実機確認 | 未実施 |
| `deal_records` のテストデータ削除 | 未実施（R-03完了後の個別承認ゲート） |

文書が改訂済みであることを、実装済み・GAS反映済み・公開済みとして扱わない。

---

## 4. 着手条件

次がすべて満たされている場合にのみ着手する。ひとつでも満たされない場合は着手せず、その旨を報告して停止する。

1. 本指示書がけんたろうの承認を得ている
2. 正本11点が2026-07-19改訂版である（版数はいずれも本書§5の記載と一致する）
3. ローカルの作業ツリーに未コミットの変更が残っていない
4. `tasks/TASK_CURRENT.md` の現在地が本書§3と矛盾しない

---

## 5. 実装前に読むファイル

| # | ファイル | 読む理由 |
|---|---|---|
| 1 | `tasks/TASK_CURRENT.md` | 現在地・確定事項（AGENTS.md §1） |
| 2 | `docs/ルールブック.md` | 三者共通の運用規約（最上位） |
| 3 | `AGENTS.md` | Codexの不変ルール |
| 4 | `営業AIメモ_追加改修_変更設計_確定版.md` 第2版（2026-07-19） | 本改修の設計根拠。C-1〜C-24、E-1〜E-20 |
| 5 | `_営業AI音声メモ_DB設計書_全フェーズ統合版v2.docx` v2.1 | 2-1（V〜Z列・U列・赤背景の設定基準）、2-7（F列address）、3-2（R-08廃止・R-09/R-10/R-13） |
| 6 | `_営業AI音声メモ_API一覧_内部関数一覧_全フェーズ統合版v2.docx` v2.1 | API-03／04／05／06／07／09／14／15／16／38、3 外部API呼び出し仕様 |
| 7 | `_営業AI音声メモ_要件定義書.docx` v3 | FR-04〜FR-09、FR-10、FR-11 |
| 8 | `_営業AI音声メモ_画面一覧_項目定義_権限表.xlsx` v1.2 | 画面一覧S-02・S-03、項目定義（DB商談記録シート、S-02のUI要素、クライアント保持） |
| 9 | `AIプロンプト設計書.md` 第3版 | §2 出力フォーマット、§8 System Prompt本文、§9 few-shot例 |
| 10 | `TEST_PLAN.md` v1.2 | §1条件2・3・4・8・9・10・11・14、§2.4〜2.7、§4 |
| 11 | `営業AIメモ_URL_構成_名称再定義.md` v1.2 | §2・§3・§6。URL・デプロイ構成を変更しないことの確認 |
| 12 | `開発工程表.md` 第3版 | 工程R-01の範囲・変更禁止範囲・完了条件 |

正本間に矛盾を見つけた場合は、独断で解消せず、矛盾点を報告して停止する（AGENTS.md §7）。

---

## 6. 現行実装で確認すべきファイル・関数・画面

着手前に、次の現行実装を実際に開いて確認する。

| ファイル | 確認する関数・箇所 | 確認内容 |
|---|---|---|
| `src/00_setup.gs` | `SETUP_SHEET_DEFINITIONS_`／`setupSheets_`／`ensureHeaderRow_` | `deal_records` の見出しがA〜U列相当の21要素であること。`user_master` の見出しに `role` がないこと。`deal_additions` の定義がないこと。`ensureHeaderRow_` は1行目に既存値があるとき何も書かないこと |
| `src/02_ai.gs` | `OPENAI_MODEL_`／`getSystemPrompt`／`buildAiRequestPayload`／`callAiApi`／`parseAiResponse` | System Promptが6キー（`customer_name` を含む）であること。few-shot例が4件あり例1が複数顧客混在・例4が顧客名不明であること。`buildAiRequestPayload` に `response_format` がないこと。`callAiApi` がHTTP 200以外で一律に例外を投げること。`parseAiResponse` が `customerName` を返し、`customerName && dealTheme && dealContent` で `extractStatus` を判定していること |
| `src/03_write.gs` | `writeRecordsToSheet`／`markExtractionFailure`／`logError`／`generateRecordId` | `rowValues` が12要素（A〜L列）であること。19列目から3列（S・T・U列）へ `latitude/longitude/storeNameGps` を書いていること。`markExtractionFailure` の `fieldSpecs` が5・7・8列（E・G・H列）であること |
| `src/04_submit.gs` | `submitMemo`／`normalizeSubmitMemoPayload_`／`normalizeSubmitMemoRecord_` | payloadが `userKey／inputText／latitude／longitude／storeName` の5項目であること。戻り値が `success／recordCount／records` であること。AI失敗が1種類にまとめられていること |
| `src/05_token.gs` | `doPost`／`getStoreCandidates`／`searchStoresByName`／`getStoreMasterRows_` | `doPost` が `action` で `storeCandidates／storeSearch／submit` を振り分け、submit時に `storeName` を渡していること。`getStoreMasterRows_` が見出し名検索であること |
| `external/input-page/index.html` | `initialize`／`startGpsFlow`／`resolveStoreSelection`／`getSelectedStoreName`／`handleSend`／`renderSuccess` | `initialize()` の末尾で `startGpsFlow()` を呼び、ページを開いた直後に位置情報を取得していること。送信payloadが `action／token／inputText／latitude／longitude／storeName` であり、店舗IDを送っていないこと |
| `src/index.html` | 全体 | `doGet` から参照されていない旧画面であること（現行 `doGet` は `top`／`daily`／`summary` のみを返す）。**本工程では変更しない** |

---

## 7. 変更対象ファイル

| # | ファイル | 変更区分 |
|---|---|---|
| 1 | `src/00_setup.gs` | 修正 |
| 2 | `src/02_ai.gs` | 修正 |
| 3 | `src/03_write.gs` | 修正 |
| 4 | `src/04_submit.gs` | 修正（新規関数を追加） |
| 5 | `src/05_token.gs` | 修正 |
| 6 | `external/input-page/index.html` | 修正 |
| 7 | `tasks/TASK_CURRENT.md` | 追記（§24。工程の最後に更新する） |

上記7ファイル以外は変更しない。`src/01_auth.gs`・`src/06_output.gs`・`src/index.html`・`src/top.html`・`src/daily.html`・`src/summary.html`・`appsscript.json`・`.clasp.json` は本工程の対象外である。

---

## 8. 変更対象関数・HTML・シート

### 8-1. 関数

| 関数 | ファイル | 区分 |
|---|---|---|
| `getSystemPrompt` | `src/02_ai.gs` | 修正（本文全面差し替え） |
| `buildAiRequestPayload` | `src/02_ai.gs` | 確認のみ（`response_format` を追加しないことの確認）＋コメント整備 |
| `callAiApi` | `src/02_ai.gs` | 修正（HTTPステータスを識別できる例外に変更） |
| `parseAiResponse` | `src/02_ai.gs` | 修正（5キー対応） |
| `parseAiResponseDetailed_` | `src/02_ai.gs` | **新規** |
| `resolveCustomerStore` | `src/04_submit.gs` | **新規**（API-38） |
| `doPost` | `src/05_token.gs` | 修正（新パラメータの受け渡し） |
| `submitMemo` | `src/04_submit.gs` | 修正 |
| `normalizeSubmitMemoPayload_` | `src/04_submit.gs` | 修正 |
| `normalizeSubmitMemoRecord_` | `src/04_submit.gs` | 修正 |
| `classifyAiError_` | `src/04_submit.gs` | **新規** |
| `writeRecordsToSheet` | `src/03_write.gs` | 修正 |
| `markExtractionFailure` | `src/03_write.gs` | 修正 |
| `logError` | `src/03_write.gs` | 変更しない（呼び出し箇所のみ増える） |
| `getStoreCandidates` | `src/05_token.gs` | 変更しない（呼び出し条件が画面側で変わるだけ） |
| `searchStoresByName` | `src/05_token.gs` | 変更しない |
| `getStoreMasterRows_` | `src/05_token.gs` | 修正（`address` 列を任意で読む。既存動作は変えない） |

### 8-2. HTML（`external/input-page/index.html`）

| 対象 | 区分 |
|---|---|
| 商談区分スイッチ（`sw_input_method`。要素ID：`inputMethodVisit`／`inputMethodPhone`） | **新規** |
| 「現在地から店舗を探す」ボタン（`btn_find_by_gps`。要素ID：`findByGpsButton`） | **新規** |
| 区分切替時の案内表示（要素ID：`storeResetNotice`） | **新規** |
| `state.inputMethod`／`state.selectedStoreId` | **新規**（クライアント保持） |
| `initialize()` | 修正（`startGpsFlow()` の自動呼び出しを撤去） |
| `startGpsFlow()` | 修正（ボタン押下時のみ実行） |
| `resolveStoreSelection()`／`getSelectedStoreName()`／`getSelectedStoreSource()` | 修正（店舗IDを返す） |
| `handleSend()` | 修正（新payload） |
| `renderSuccess()` | 修正（確定顧客名・商談区分・マスタ未登録の表示） |
| `bindEvents()` | 修正（新規要素のイベント登録） |

### 8-3. シート・列

| シート | 変更内容 |
|---|---|
| `deal_records` | **最初に見出しの存在を確認する**。V〜Z列（V `customer_store_id`／W `customer_name_raw`／X `visit_store_id`／Y `input_method`／Z `user_key`）のうち、存在しない見出しだけを末尾へ追加する。既に存在する見出しを重複追加しない。既存A〜U列の位置は動かさない。U列は書込対象から除外 |
| `deal_additions` | **新設**（A `addition_id`／B `record_id`／C `additional_record`／D `added_at`／E `added_by`）。本工程では**器のみ**を作り、書込処理は実装しない（書込はR-02） |
| `user_master` | 見出し定義へ `role` を追加する。**実シートの `role` 列はすでに存在する（現行環境で manager・sales の権限確認に使用されている）。最初に存在を確認し、存在する場合は列の追加・挿入・移動・名前変更をしない。** 存在しない場合に限り `active_flag` の右隣へ追加する。重複した `role` 列を作らない |
| `store_master` | 見出し定義へF列 `address` を追加（DB設計書2-7）。**最初に見出しの存在を確認し、存在する場合は追加しない。** コードは読み書きしない |
| `error_log` | 変更しない |

---

## 9. 今回実装する内容

処理順に記載する。この順序で実装する。

### 9-1. シート定義（`src/00_setup.gs`）

1. `SETUP_SHEET_DEFINITIONS_` の `deal_records` の `headers` 末尾へ、次の5要素をこの順で追加する。
   `'customer_store_id', 'customer_name_raw', 'visit_store_id', 'input_method', 'user_key'`
   既存要素の順序・値は一切変更しない。
2. `user_master` の `headers` 末尾へ `'role'` を追加する。これは `src/00_setup.gs` の**定義上の追加**であり、実シートの列操作を意味しない（実シートの `role` 列はすでに存在する。§15）。
3. `store_master` の `headers` 末尾へ `'address'` を追加する。
4. `SETUP_SHEET_DEFINITIONS_` へ `deal_additions` の定義を追加する。
   `headers: ['addition_id', 'record_id', 'additional_record', 'added_at', 'added_by']`
5. `setupSheets_`／`getOrCreateSheet_`／`ensureHeaderRow_` のロジックは変更しない。既存シートの1行目に値がある場合に何も書かない現行動作を維持する。

**重要**：`setupSheets()` の実行は、けんたろうの明示承認を得るまで行わない（§15の停止点1）。

また、`setupSheets()` を実行しても、既存シート（`deal_records`／`user_master`／`store_master`）の見出しは追加・更新されない。`ensureHeaderRow_` が1行目に既存値を検出して何も書かないためである。既存3シートの見出しは、**最初に存在を確認したうえで、存在しないものだけを手作業で追加する**（§15）。既に存在する見出しを重複追加しない。

### 9-2. AI解析（`src/02_ai.gs`）

1. `getSystemPrompt()` の返す文字列を、`AIプロンプト設計書.md` 第3版 §8「System Prompt 本文」＋§9「few-shot 例」に**完全に一致させる**。
   - キーは `customer_type, deal_theme, deal_content, todo_item, todo_deadline` の5つ
   - `customer_name` を出力しない旨を【出力形式】と【禁止】の両方に含める
   - 【分割ルール】は「顧客店舗は1つに確定している。顧客ごとに分けることはしない」から始まる4項目にする
   - few-shot例は3件（例1＝同一店舗内で部門・相手が異なる／例2＝同一店舗で複数テーマ／例3＝同一話題内の複数品種）。現行の例4（顧客名不明でも分割する）は削除する
   - 各例の出力JSONから `customer_name` キーを削除する
2. `buildAiRequestPayload(systemPrompt, inputText)` は `response_format` を**追加しない**。既存の `model`／`temperature`／`messages` の構造を維持する。`OPENAI_MODEL_` は正本で固定しない設定値であるため、値を変更しない。
3. `callAiApi(inputText)` を修正し、HTTPステータスを呼び出し元が識別できるようにする。
   - HTTP 200以外のとき、`throw new Error('AI_HTTP_' + statusCode + ': OpenAI API request failed.')` とする
   - それ以外の処理・引数・戻り値は変更しない
4. `parseAiResponseDetailed_(aiResponseText)` を新規追加する。
   - 戻り値：`{ parseSucceeded: Boolean, records: Array }`
   - JSON抽出・パースのロジックは現行 `parseAiResponse` の実装をそのまま流用する
   - パースに成功し1件以上のレコードを取り出せた場合のみ `parseSucceeded: true`
   - 各レコードは `{customerType, dealTheme, dealContent, todoItem, todoDeadline, extractStatus}` の6プロパティとし、**`customerName` を含めない**
   - `extractStatus` は `dealTheme && dealContent ? 'OK' : '要確認'` とする（`customerName` を判定に使わない）
   - パース不能・0件の場合は `parseSucceeded: false` とし、`records` は空配列を返す
5. `parseAiResponse(aiResponseText)` は、`parseAiResponseDetailed_` を呼び、`records` を返す薄いラッパーにする。`parseSucceeded: false` のときは、従来どおり `extractStatus: '要確認'` の1件のフォールバック配列を返す（API-06の戻り値仕様を維持するため）。

### 9-3. 顧客店舗の確定（`src/04_submit.gs`・新規 `resolveCustomerStore`）

API-38に従い、次を新規実装する。**`callAiApi` より前に実行する。**

```
resolveCustomerStore(payload)
  引数：payload（customerStoreId／customerNameRaw を含むオブジェクト）
  戻り値：{ customerName, customerStoreId, customerNameRaw, isUnregisteredStore }
```

処理順：

1. `customerStoreId` を前後の空白を除去して取得する。
2. `customerStoreId` がある場合
   - `getStoreMasterRows_()` から `storeId` が一致する行を検索する
   - 見つからない場合は `throw new Error('STORE_NOT_FOUND')`
   - `activeFlag !== '有効'` の場合は `throw new Error('STORE_INACTIVE')`
   - `customerName` に `store_master` の `storeName` を設定する（クライアントから送られた店舗名文字列は**一切使用しない**）
   - `customerNameRaw` は空文字、`isUnregisteredStore` は `false`
3. `customerStoreId` がなく `customerNameRaw`（空白除去後）がある場合
   - `customerName` に `customerNameRaw` と同じ値を設定する
   - `customerStoreId` は空文字、`isUnregisteredStore` は `true`
4. 両方とも空の場合は `throw new Error('STORE_NOT_SPECIFIED')`

### 9-4. 送信受付（`src/05_token.gs`・`doPost`）

1. `action === 'submit'` の分岐で、`submitMemo` へ渡すオブジェクトを次に変更する。
   ```
   {
     userKey: verification.userKey,
     inputText: String(requestPayload.inputText || ''),
     inputMethod: requestPayload.inputMethod,
     customerStoreId: requestPayload.customerStoreId,
     customerNameRaw: requestPayload.customerNameRaw,
     latitude: requestPayload.latitude,
     longitude: requestPayload.longitude,
   }
   ```
2. `storeName` の受け渡しを削除する。
3. `storeCandidates`／`storeSearch` の分岐は変更しない。
4. トークン検証の位置・順序は変更しない。roleによる拒否は本工程では実装しない（R-02）。

### 9-5. 保存処理（`src/04_submit.gs`・`submitMemo`）

`submitMemo(payload)` を次の順序で実装する。

1. `normalizeSubmitMemoPayload_` を修正し、`userKey／inputText／inputMethod／customerStoreId／customerNameRaw／latitude／longitude` を取り出す（`storeName` は廃止）。
2. `inputText` が空 → `{success:false, errorMessage:'入力テキストがありません'}`
3. `userKey` が空、または `user_master` に該当なし → 現行のメッセージを維持する
4. **商談区分の検証**：`inputMethod` が `'訪問'` `'電話'` のいずれでもない → `{success:false, errorMessage:'訪問か電話かを選んでください。'}`。AI APIを呼ばない
5. **店舗の確定**：`resolveCustomerStore(payload)` を呼ぶ。例外を次のとおり変換して返す。いずれもAI APIを呼ばず、書き込みも行わない
   | 例外 | errorMessage |
   |---|---|
   | `STORE_NOT_SPECIFIED` | 商談先の店舗を指定してください。「現在地から店舗を探す」を押すか、店舗名で検索してください。 |
   | `STORE_NOT_FOUND` | 選んだ店舗が見つかりませんでした。もう一度、店舗を選び直してください。 |
   | `STORE_INACTIVE` | この店舗は現在使用できません。管理者に連絡してください。 |
6. **緯度・経度の破棄**：`inputMethod === '電話'` の場合、`latitude`／`longitude` を空文字にする（エラーにしない）
7. `lookupBranch(userKey)` で営業所名を取得する（見つからない場合も空欄のまま継続する。現行動作を維持）
8. `callAiApi(inputText)` を呼ぶ。例外時は `classifyAiError_(error)` で分類し、次を返す。**いずれも保存しない**
   | 分類 | errorMessage | logError |
   |---|---|---|
   | `TIMEOUT` | 現在利用できません。しばらく経ってから、もう一度送信してください。 | 記録する（`AI_API_ERROR`） |
   | `HTTP_4XX` | 現在利用できません。管理者に連絡してください。入力内容は保持しています。 | 記録する（`AI_API_ERROR`） |
   | `HTTP_5XX` | 現在利用できません。しばらく経ってから、もう一度送信してください。 | 記録する（`AI_API_ERROR`） |
9. `parseAiResponseDetailed_(aiResponseText)` を呼ぶ。
   - `parseSucceeded === true` → 返された配列を使う
   - `parseSucceeded === false` → **入力テキスト全体を1レコードとする**。`dealTheme: ''`、`dealContent: inputText`、`todoItem: ''`、`todoDeadline: ''`、`customerType: ''`、`extractStatus: '要確認'` とする。`success: true` で返す（店舗情報は正常に保存する）
10. **店舗情報の一括付与**：`normalizeSubmitMemoRecord_` を修正し、全レコードへ同一の値を設定する。
    | プロパティ | 値 |
    |---|---|
    | `customerName` | `resolveCustomerStore` の `customerName` |
    | `customerStoreId` | 同 `customerStoreId` |
    | `customerNameRaw` | 同 `customerNameRaw` |
    | `visitStoreId` | `inputMethod === '訪問'` かつ `customerStoreId` がある場合のみ `customerStoreId` と同じ値。それ以外（訪問でマスタ未登録／電話）は空文字 |
    | `inputMethod` | 画面で選択された値 |
    | `latitude`／`longitude` | 訪問かつ取得できていた場合のみ。電話は空文字 |
    | `userKey` | `payload.userKey` |
    レコード件数にかかわらず店舗情報を分岐させない。
11. `writeRecordsToSheet(records)` を呼ぶ。例外時は `{success:false, errorMessage:'保存に失敗しました。しばらく経ってから、もう一度送信してください。'}` を返し、`logError('SHEET_WRITE_ERROR', ...)` を記録する。
12. 戻り値を次に変更する。
    ```
    {
      success: true,
      recordCount: N,
      records: [{customerName, dealTheme, todoItem}, ...],
      customerName: 確定した顧客名,
      inputMethod: '訪問' | '電話',
      isUnregisteredStore: Boolean
    }
    ```

`classifyAiError_(error)` は新規追加する。エラーメッセージから `AI_HTTP_(\d{3})` を抽出し、400〜499は `HTTP_4XX`、500〜599は `HTTP_5XX`、抽出できない場合は `TIMEOUT` を返す。

### 9-6. シート書込（`src/03_write.gs`）

1. `writeRecordsToSheet(records)` の各レコード処理で、次のプロパティを追加で取り出す。
   `customerStoreId`／`customerNameRaw`／`visitStoreId`／`inputMethod`／`userKey`
2. `rowValues`（A〜L列の12要素）は現行のまま維持する。
3. 行追加後の列書込を次に変更する。
   - **S・T列**：`sheet.getRange(rowNumber, 19, 1, 2).setValues([[latitude, longitude]])`
     現行の「19列目から3列」を「19列目から2列」に変更する。**U列（21列目）へは書き込まない**
   - 書込条件は、`latitude` または `longitude` のいずれかに値がある場合とする（現行の `storeNameGps` を条件から外す）
   - **V〜Z列**：`sheet.getRange(rowNumber, 22, 1, 5).setValues([[customerStoreId, customerNameRaw, visitStoreId, inputMethod, userKey]])`
     こちらは値の有無にかかわらず**常に書き込む**（`input_method` と `user_key` は必須項目のため）
4. `storeNameGps`／`store_name_gps`／`storeName`／`store_name` を参照している箇所をすべて削除する。
5. `markExtractionFailure(sheet, rowNumber, record)` の `fieldSpecs` から**E列（column: 5）の要素を削除**し、G列（7）・H列（8）の2要素だけにする。判定条件（`extractStatus !== '要確認'` なら何もしない）は変更しない。
6. `logError`／`generateRecordId` は変更しない。

### 9-7. 外部入力画面（`external/input-page/index.html`）

1. **商談区分スイッチ**を、入力欄より上（`input-title` のセクションより前）へ常時表示で追加する。
   - 要素：`<button id="inputMethodVisit">訪問</button>` / `<button id="inputMethodPhone">電話</button>`（2択。選択中を `aria-pressed="true"` で表す）
   - `state.inputMethod` の初期値は `'訪問'`
   - スイッチの選択そのものでは位置情報を取得しない
2. **位置情報の取得タイミング**を変更する。
   - `initialize()` の末尾にある `startGpsFlow()` の呼び出しを**削除**する（トークンがない場合の `resetStoreUiForNoToken()` は維持する）
   - 「現在地から店舗を探す」ボタン（`id="findByGpsButton"`）を店舗指定エリアへ追加し、**押下時にだけ** `startGpsFlow()` を呼ぶ
   - このボタンは `state.inputMethod === '訪問'` のときだけ表示する。`'電話'` のときは非表示にする
   - 画面表示時・区分切替時・音声入力開始時・送信ボタン押下時には位置情報を取得しない
3. **区分切替時の破棄処理**を追加する。訪問→電話、電話→訪問のいずれでも次を行う。
   - `state.nearby.items`／`state.nearby.selectedId`／`state.search.items`／`state.search.selectedId`／`elements.storeManualInput.value` を初期化する
   - `state.gps` を `setGpsIdle()` 相当で初期化し、緯度・経度を破棄する
   - `storeResetNotice` に「商談区分を変更したため、店舗を選び直してください」を表示する
   - 電話へ切り替えたときは店舗候補リストを閉じ、店舗名検索欄のみを表示する
4. **店舗IDの保持と送信**。
   - `resolveStoreSelection()` の戻り値へ `storeId` を追加する（`nearby`／`search` から選択した場合は当該 `storeId`、手入力の場合は空文字）
   - `handleSend()` の送信payloadを次に変更する
     ```
     {
       action: 'submit',
       token: state.token,
       inputText,
       inputMethod: state.inputMethod,
       customerStoreId: 選択店舗のstoreId（手入力時は空文字）,
       customerNameRaw: 手入力店舗名（マスタ選択時は空文字）,
       latitude: 訪問かつGPS取得成功時のみ,
       longitude: 同上
     }
     ```
   - `storeName` の送信を廃止する
5. **送信前のクライアント側検証**を追加する（GAS側の検証と二重に行う。GAS側の検証は省略しない）。
   - `customerStoreId` と `customerNameRaw` が両方とも空（空白除去後） → 送信せず「商談先の店舗を指定してください。「現在地から店舗を探す」を押すか、店舗名で検索してください。」を表示する
   - `state.inputMethod` が2値以外 → 送信せず「訪問か電話かを選んでください。」を表示する
6. **位置情報の失敗時**は送信を止めない。`handleGpsError` の表示文を「現在地を取得できませんでした。店舗名で検索してください」に統一し、店舗名検索欄へ誘導する。
7. **保存結果表示（S-03相当）** を `renderSuccess(payload)` で次に変更する。
   - 件数（現行維持）
   - 確定した顧客名：`payload.customerName`。`payload.isUnregisteredStore === true` のときは「（マスタ未登録）」を併記する
   - 商談区分：`payload.inputMethod`
   - 各レコードの案件テーマ・宿題の有無（現行の `formatRecordLine` を流用。顧客名は全件同一のため、レコード行ではテーマと宿題のみを出す）
   - 記録者キー（`user_key`）は表示しない
8. 「続けて入力する」（`continueButton`）押下時は、入力欄・店舗選択・位置情報をクリアし、**商談区分を既定の「訪問」へ戻す**（未選択にしない）。
9. `GAS_SUBMIT_URL`／`TOP_PAGE_URL`／`TOKEN_STORAGE_KEY`／`STORAGE_KEY` の各定数は変更しない。

---

## 10. 既存処理から変更する内容

| # | 既存処理 | 変更後 |
|---|---|---|
| 1 | System Promptが6キー（`customer_name` を含む） | 5キー。`customer_name` を出力しない |
| 2 | few-shot例4件（例1＝複数顧客混在、例4＝顧客名不明） | 3件。例1を同一店舗内の部門・相手違いへ差し替え、例4を削除 |
| 3 | `parseAiResponse` が `customerName` を返す | 返さない。`extractStatus` は `dealTheme`・`dealContent` のみで判定 |
| 4 | `callAiApi` がHTTP 200以外で一律の例外 | ステータスを含む例外にし、呼び出し元が4xx／5xx／タイムアウトを区別する |
| 5 | AI失敗が1種類（`AI_API_ERROR` で一律に保存中止） | 5区分（タイムアウト／4xx／5xx／JSON解析不能／書込失敗） |
| 6 | 顧客名がAI出力の値 | `resolveCustomerStore` が `store_master` から再取得した値（未登録時は入力店舗名） |
| 7 | `submitMemo` payloadに `storeName` | `inputMethod`／`customerStoreId`／`customerNameRaw` |
| 8 | S・T・U列へ3列書込 | S・T列へ2列書込。U列へは書き込まない |
| 9 | 赤背景の対象がE・G・H列 | G・H列のみ |
| 10 | 位置情報をページ表示直後に取得 | 「現在地から店舗を探す」押下時のみ取得 |
| 11 | 商談区分の概念がない | 訪問／電話を画面で明示選択（既定＝訪問） |
| 12 | 店舗指定が任意 | 必須。クライアントとGASの両方で検証 |
| 13 | 保存結果に顧客名が「（未入力）」になり得た | 確定顧客名・商談区分・マスタ未登録表示 |

---

## 11. 新規追加する内容

| 種別 | 名称 | 配置 |
|---|---|---|
| 関数 | `resolveCustomerStore(payload)`（API-38） | `src/04_submit.gs` |
| 関数 | `classifyAiError_(error)` | `src/04_submit.gs` |
| 関数 | `parseAiResponseDetailed_(aiResponseText)` | `src/02_ai.gs` |
| 列 | `deal_records` V〜Z列 | シート＋`src/00_setup.gs` の定義 |
| 列 | `user_master` の `role`、`store_master` のF列 `address` | シート＋`src/00_setup.gs` の定義 |
| シート | `deal_additions`（器のみ） | シート＋`src/00_setup.gs` の定義 |
| HTML要素 | 商談区分スイッチ、「現在地から店舗を探す」ボタン、区分切替時の案内表示 | `external/input-page/index.html` |
| クライアント保持 | `state.inputMethod`、`state.selectedStoreId` | `external/input-page/index.html` |

---

## 12. 変更してはいけない範囲

- 既存A〜U列の物理位置。既存列の途中への挿入
- U列 `store_name_gps` の列そのもの（削除しない。書込のみ停止する）
- `record_id` の採番方式（`YYYYMMDD-HHMMSS-NNN`・3桁ゼロ埋め）
- 署名付きトークン方式（`issueToken`／`verifyToken`／`getTokenSecret`）とその有効期限
- 1プロジェクト・2デプロイ構成、デプロイURL、GitHub Pagesの公開先、利用者向け入口URL（1本）
- `appsscript.json`、`.clasp.json`
- `src/01_auth.gs`、`src/06_output.gs`、`src/index.html`、`src/top.html`、`src/daily.html`、`src/summary.html`
- 未送信テキスト保全（`unsent_text`）の仕組み
- 外部入力画面に過去の商談記録・追記を表示しないこと
- `customer_type` の維持（削除しない）
- `OPENAI_MODEL_` の値（モデル名は正本で固定しない設定値。本工程で変更しない）
- 権限・ロール判定・日報・追記の実装（R-02の範囲）
- `customer_relation`／`store_match_status`／`submission_id` の追加
- 代理商談・代理電話コメント・代理追記
- 既存の `deal_records`・`user_master`・`store_master` の**データ行**

---

## 13. 削除・撤去対象

| # | 対象 | 場所 |
|---|---|---|
| 1 | System Prompt内の `customer_name` の定義・記載・禁止例外 | `src/02_ai.gs`／`getSystemPrompt` |
| 2 | few-shot例4（顧客名不明でも分割する） | `src/02_ai.gs`／`getSystemPrompt` |
| 3 | few-shot例1の複数顧客混在の入力・出力 | `src/02_ai.gs`／`getSystemPrompt` |
| 4 | `parseAiResponse` の `customerName` マッピングと、`extractStatus` 判定への `customerName` の使用 | `src/02_ai.gs` |
| 5 | `writeRecordsToSheet` の `storeNameGps`／`store_name_gps`／`storeName`／`store_name` の参照と、U列（21列目）への書込 | `src/03_write.gs` |
| 6 | `markExtractionFailure` の `fieldSpecs` のE列（column: 5）要素 | `src/03_write.gs` |
| 7 | `submitMemo` payloadの `storeName` と、`normalizeSubmitMemoRecord_` の `storeName` 設定 | `src/04_submit.gs` |
| 8 | `doPost` の submit分岐での `storeName` の受け渡し | `src/05_token.gs` |
| 9 | `initialize()` からの `startGpsFlow()` の自動呼び出し | `external/input-page/index.html` |
| 10 | 送信payloadの `storeName` | `external/input-page/index.html` |

`src/index.html`（GAS内の旧入力画面）は**削除しない**。参照有無の確認はR-03で行う。

---

## 14. 一時確認処理を作る場合の名称と撤去条件

本工程で一時的な確認関数を作る場合は、次に従う。

本工程のユーザー確認は、引数なしの一時確認関数で行う。Apps Scriptエディタは引数付きの関数を画面から直接実行できないため、`resolveCustomerStore(payload)` などの本体関数を「GASエディタから直接実行する」方式は採らない。

**必ず作成する一時確認関数**

```
tmpR01_checkResolveCustomerStore()
  引数：なし
  戻り値：3パターンの確認結果（成功可否とメッセージのみ）
```

- 関数内部で、次の3パターンを順に確認する
  1. `store_master` の有効な店舗ID（`active_flag`＝有効）を1件取得し、`resolveCustomerStore` へ渡して `customerName` が `store_master` の `store_name` と一致すること
  2. 手入力店舗名（固定文字列。例：`'tmpR01テスト店舗'`）を渡して `isUnregisteredStore: true` と `customerName` が同じ値になること
  3. 店舗ID・入力店舗名の両方を空で渡して `STORE_NOT_SPECIFIED` の例外になること
- **実データを一切書き換えない**（`deal_records`・`store_master`・`user_master` への書込を行わない）
- トークン、メールアドレス、`user_key`、認証情報、APIキーを、ログ・戻り値・画面のいずれにも出さない
- 本番の関数から呼び出さない

**共通ルール**

- 一時確認関数の名称は `tmpR01_` で始める。それ以外の名前で一時関数を作らない
- **一時確認関数はGit commitへ含めない**。R-01本体のコミット（§21）には一時関数を含めず、一時関数を追加・削除したことだけを理由に追加コミットを作らない
- 一時確認関数は `clasp push --force` でGASへ反映してよい（けんたろうが実行するため）
- **けんたろうの確認が完了した時点で削除する**。削除後、再度 `clasp push --force` を実行し、GAS側から一時関数が消えていることを確認する
- 削除後、作業ツリーに一時確認関数の差分が残っていないことを確認する（この時点では `tasks/TASK_CURRENT.md` が未更新のため、その差分は残ってよい）
- R-02へ持ち越さない
- 削除したこと、および作業ツリーの状態を完了報告に明記する

---

## 15. データ構造への影響

| 対象 | 影響 | 既存データへの影響 |
|---|---|---|
| `deal_records` | V〜Z列が末尾へ増える（22〜26列目） | 既存行のA〜U列は変化しない。既存行のV〜Z列は空欄のまま残る |
| `deal_records` U列 | 新規行では空欄になる | 既存行の値は保持される |
| `deal_additions` | 新規シート（見出し行のみ） | なし |
| `user_master` | 見出しへ `role` が増える | 既存行の値は変化しない。`role` の値の登録はけんたろうの作業 |
| `store_master` | 見出しへ `address` が増える | 既存行の値は変化しない |
| `error_log` | なし | なし |

**既存シートの実操作について（停止点1）**

シート反映は、次の2種類に分かれる。混同しない。

| 対象 | 反映方法 |
|---|---|
| `deal_additions`（新規シート） | けんたろうの承認後に `setupSheets()` を実行して作成できる |
| `deal_records` のV1〜Z1（見出し） | **最初に見出しの存在を確認し、存在しないものだけを手作業で追加する**。`setupSheets()` では追加されない |
| `user_master` の `role`（見出し） | **すでに存在する**（現行環境で manager・sales の権限確認に使用されている）。**存在を確認し、存在する場合は追加・挿入・移動・名前変更をしない**。存在しない場合に限り `active_flag` の右隣へ追加する |
| `store_master` の `address`（見出し） | **最初に見出しの存在を確認し、存在しない場合のみ手作業で追加する**。`setupSheets()` では追加されない |

**重複列を作らない。** いずれのシートでも、まず1行目の見出しを読んで存在を確認し、既に存在する見出しを二重に追加しない。既存の `role` 列がある場合は、その列へ4値（`sales`／`manager`／`sales_support`／`sysadmin`）を設定する。既存データ行と既存の `role` の値を、けんたろうの承認なしに変更しない。

既存3シートの見出しが `setupSheets()` で追加されない理由は、`ensureHeaderRow_` が1行目に既存値を検出したときに何も書かない現行動作にあるためである。この動作は変更しない。

したがって、次の順で行う。

1. Codexはコードの修正までを行い、`setupSheets()` を**実行しない**
2. Codexは、けんたろうへ次を提示して停止する
   - 事前確認：`deal_records`・`user_master`・`store_master` の1行目の見出しを読み、V〜Z・`role`・`address` のうち**すでに存在するもの**と**存在しないもの**を一覧にして示す
   - 手作業の対象：**存在しない見出しだけ**。`deal_records` のV1〜Z1（`customer_store_id`／`customer_name_raw`／`visit_store_id`／`input_method`／`user_key`）、`store_master` の `active_flag` の右隣へ `address`。`user_master` の `role` はすでに存在するため追加しない（存在しない場合に限り `active_flag` の右隣へ追加する）
   - `setupSheets()` の対象：`deal_additions` の新規作成のみ
   - 変更内容：いずれも**見出し行の追加のみ**。既存データ行・既存の `role` の値は編集しない。重複列を作らない
   - 既存データへの影響：既存行のA〜U列は変化しない。V〜Z列は空欄のまま
   - 実行理由：V〜Z列の見出しがないと、`writeRecordsToSheet` の書込が見出しなしの列に入るため
3. けんたろうの明示承認を得たあとに、けんたろうが手作業（既存3シート）と `setupSheets()` の実行（`deal_additions`）を行う

承認なしにシート操作を行わない（AGENTS.md §5）。

---

## 16. 権限への影響

本工程では権限制御を実装しない。

- `user_master.role` は**見出し定義の追加のみ**。値の読み取り・判定・画面分岐・API拒否はR-02で実装する
- `validateUser`／`verifyToken`／`issueToken`／`doGet` は変更しない
- `sales_support` の送信API拒否はR-02で実装する。本工程の時点では、トークンを持つ全roleが従来どおり送信できる
- `deal_additions` は器のみ。追記の保存・表示・権限判定はR-02

---

## 17. エラー処理

`TEST_PLAN.md` §4 および API一覧 API-03 のエラーハンドリング表に一致させる。

| # | 条件 | 保存 | 画面に表示する文章 | `error_log` |
|---|---|---|---|---|
| 1 | 入力テキストが空 | しない | 入力テキストがありません | 記録しない |
| 2 | 商談区分が不正または未指定 | しない | 訪問か電話かを選んでください。 | 記録しない |
| 3 | 店舗ID・入力店舗名がともに空（空白のみを含む） | しない | 商談先の店舗を指定してください。「現在地から店舗を探す」を押すか、店舗名で検索してください。 | 記録しない |
| 4 | 存在しない店舗ID | しない | 選んだ店舗が見つかりませんでした。もう一度、店舗を選び直してください。 | 記録しない |
| 5 | 無効店舗（`active_flag` ＝無効） | しない | この店舗は現在使用できません。管理者に連絡してください。 | 記録しない |
| 6 | 電話商談で緯度・経度が届いた | する | 表示しない（エラーにしない。緯度・経度のみ破棄） | 記録しない |
| 7 | 位置情報の拒否・取得失敗 | 送信自体は継続 | 現在地を取得できませんでした。店舗名で検索してください | 記録しない |
| 8 | AI APIのタイムアウト | しない | 現在利用できません。しばらく経ってから、もう一度送信してください。 | `AI_API_ERROR` |
| 9 | AI APIのHTTP 4xx | しない | 現在利用できません。管理者に連絡してください。入力内容は保持しています。 | `AI_API_ERROR` |
| 10 | AI APIのHTTP 5xx | しない | 現在利用できません。しばらく経ってから、もう一度送信してください。 | `AI_API_ERROR` |
| 11 | AIから応答は得たがJSON解析不能 | **する**（全文1レコード・`extract_status`＝要確認・G/H列赤背景・店舗情報とZ列は正常保存） | 保存しました。内容の整理がうまくいかなかったため、後で管理者が確認します。 | 記録しない |
| 12 | スプレッドシート書込失敗 | しない | 保存に失敗しました。しばらく経ってから、もう一度送信してください。 | `SHEET_WRITE_ERROR` |

2〜5はAI APIを呼ぶ前に判定する（無効な送信でAPI料金を発生させないため）。
8〜10・12では、クライアント側は `unsent_text` を削除しない。11では削除する。

---

## 18. 静的チェック

作業後に必ず次を実行し、結果を報告する。

1. `node --check src/00_setup.gs`
2. `node --check src/02_ai.gs`
3. `node --check src/03_write.gs`
4. `node --check src/04_submit.gs`
5. `node --check src/05_token.gs`
6. `external/input-page/index.html` の `<script>` 内JavaScriptの構文確認（一時ファイルへ切り出して `node --check` するか、同等の方法で確認する。一時ファイルは確認後に削除する）
7. `git diff --check`
8. `git status` で、変更ファイルが§7の本体6ファイルだけであることを確認する（この時点では `tasks/TASK_CURRENT.md` は未更新でよい）
9. 旧仕様の残存確認（該当が0件であること）
   - `grep -rn "customer_name" src/02_ai.gs` → System Prompt本文とfew-shot例に残っていないこと（禁止文としての「customer_name を出力しない」の記述は残ってよい）
   - `grep -rn "store_name_gps\|storeNameGps" src/03_write.gs src/04_submit.gs src/05_token.gs` → 0件
   - `grep -rn "storeName" external/input-page/index.html` → 送信payloadに残っていないこと
   - `grep -rn "response_format" src/` → 0件
   - `grep -n "column: 5" src/03_write.gs` → 0件

いずれかが失敗した場合は、`clasp push --force` を実行せず停止して報告する。

---

## 19. モック確認

実データ・実通信を使わない範囲で、次を確認する。実施した場合は方法と結果を報告する。実施できない場合は「未実施」と明記する。

1. `parseAiResponseDetailed_` に、5キーのJSON配列文字列を渡すと `parseSucceeded: true` と正しい件数の配列が返ること
2. 同じ関数に、JSONでない文字列を渡すと `parseSucceeded: false` と空配列が返ること
3. `classifyAiError_` に `AI_HTTP_401`／`AI_HTTP_503`／メッセージ不明の例外を渡すと、`HTTP_4XX`／`HTTP_5XX`／`TIMEOUT` を返すこと
   （1〜3は、ローカルのNode環境で確認するか、§14の `tmpR01_checkResolveCustomerStore()` と同じ方針の引数なし一時関数で確認する。引数付きの本体関数をGASエディタから直接実行しない）
4. 外部入力画面のJavaScriptについて、NodeモックDOMで次を確認すること
   - 画面初期化時に `navigator.geolocation.getCurrentPosition` が呼ばれないこと
   - 「現在地から店舗を探す」押下時にだけ呼ばれること
   - 電話を選択すると当該ボタンが非表示になり、区分切替で店舗選択と緯度・経度が破棄されること
   - 店舗未指定のとき送信されないこと
   - 送信payloadに `inputMethod`／`customerStoreId`／`customerNameRaw` が含まれ、`storeName` が含まれないこと

実シートへの書込、実AI API呼び出し、実機確認は本工程で行わない。

---

## 20. 条件付き `clasp push --force`

- 実行対象：**あり**（本工程では**必ず実行する**。一時確認関数をGASへ反映しなければ、けんたろうが§26-1の機能確認を行えないため）
- 実行回数：**2回**。①静的チェック成功後（本体＋一時確認関数の反映）、②一時確認関数の削除後（削除の反映）
- 実行条件（ルールブック §8）：§18の静的チェックがすべて成功し、変更ファイルが§7の本体6ファイルだけであり、R-02・R-03の作業を前倒ししていないこと
- 実行コマンド：`clasp push --force`
- 実行前に `clasp status` で tracked files を確認し、`src/` 配下の対象ファイルが含まれることを確認する
- 外部入力画面（`external/input-page/index.html`）は `clasp push --force` の対象外である（GitHub Pages側であり、`.clasp.json` の `rootDir` は `src`）。この変更のGAS反映は行われない
- 次のいずれかに該当する場合は実行しない：構文確認でエラーが出た／対象外ファイルを変更した可能性がある／前倒し実装の可能性がある／既存機能を壊した可能性がある
- 上記により実行しない場合、または実行して失敗した場合は、**R-01を未完了として停止し報告する**（§28）。「未実行だが理由を報告した」ことをもって完了としない
- 2回目の実行後、GAS側から `tmpR01_` で始まる関数が消えていることを確認する

---

## 21. Git操作の要否

| 操作 | 要否 |
|---|---|
| `git add`（本体6ファイル＋`tasks/TASK_CURRENT.md` の計7ファイル） | **行う** |
| `git commit` | **行う**。コミットメッセージ：`Implement R-01 data structure, AI output, store resolution and save` |
| `git push` | **行わない**（R-03で行う） |
| 新しいブランチの作成 | 行わない |
| 新しいリポジトリの作成 | 行わない |
| タグ付け・リベース・履歴の書き換え | 行わない |
| 一時確認関数（`tmpR01_`）のコミット | **行わない**。追加・削除のいずれもコミットしない |

R-01の本体コミットは**1件**とし、本体6ファイルと `tasks/TASK_CURRENT.md` の計7ファイルを含める。一時確認関数の追加・削除を理由に追加コミットを作らない。コミットは未pushのままローカルに残す。R-03で既存リモートの既存ブランチへpushする。

**実施順（この順序を守る）**

1. 本体実装（§9）
2. 静的確認（§18）
3. 一時確認関数の追加と `clasp push --force` によるGAS反映（§14・§20）
4. **けんたろうによる機能確認**（§26 第1段階）
5. 一時確認関数の削除と再度の `clasp push --force`。GAS側から `tmpR01_` が消えたことを確認する（§14・§20）
6. `tasks/TASK_CURRENT.md` の更新（§24）
7. 本体6ファイル＋`tasks/TASK_CURRENT.md` を**1コミット**にまとめる
8. `git status` に未コミット差分がないことを確認する
9. Codexの完了報告（§25）
10. **けんたろうによるR-01完了承認**（§26 第2段階）

第1段階の機能確認は工程完了の承認ではない。完了承認は、9まで終わったあとに行う。

---

## 22. 外部入力画面側の反映方法

- `external/input-page/index.html` の修正は**ローカルのコミットまで**とする
- GitHub Pagesへの反映は**行わない**（R-03で行う）
- したがって、本工程の完了時点では、公開中の商談入力画面は旧仕様のままである
- 公開中の画面と改修後のGASが一時的に食い違うが、デプロイA・Bも更新しないため、利用者への影響は発生しない
- この状態を「未反映」として完了報告に明記する

---

## 23. デプロイ更新の扱い

- デプロイA（営業AIメモ｜利用開始・本人確認）：**更新しない**
- デプロイB（営業AIメモ｜商談送信・保存API）：**更新しない**
- 新規デプロイの作成：行わない
- デプロイURLの変更：行わない

公開反映はR-03でまとめて行う。

---

## 24. `TASK_CURRENT.md` へ記録する内容

§21の実施順6の時点で、`tasks/TASK_CURRENT.md` へ次を追記する（既存の記載は削除しない）。追記後、本体6ファイルと合わせて1コミットにする。

- 見出し：`## 41. 2026-07-19 R-01 基盤・入力・保存の改修 実装`
- 変更したファイル（6点）と、各ファイルで変更した関数名
- 新規追加した関数（`resolveCustomerStore`／`classifyAiError_`／`parseAiResponseDetailed_`）
- 削除・撤去した旧処理（U列書込、E列赤背景、AI出力の `customer_name`、ページ表示時のGPS取得、送信payloadの `storeName`）
- 静的チェックの結果
- `clasp push --force` の結果（または未実行の理由）
- コミット予定のメッセージ：`Implement R-01 data structure, AI output, store resolution and save`
- 本体6ファイルと `tasks/TASK_CURRENT.md` を**1コミット**にまとめる予定であること
- **Git push は未実施であること**
- 見出しの存在確認の結果（`deal_records` V〜Z／`user_master` の `role`／`store_master` の `address` について、すでに存在したもの・追加したもの）。`user_master` の `role` は既存列であり追加していないこと。重複列を作っていないこと
- `deal_additions` の新規作成（`setupSheets()`）について、承認を得た範囲と実施状況（未実施なら「未実施・承認待ち」）
- `tmpR01_checkResolveCustomerStore()` の確認結果、削除の実施、削除後の `clasp push --force` の結果
- 未実施・未確認の項目：GitHub Pages反映、デプロイA・B更新、実通信確認、実機確認、R-02・R-03
- 次の状態：完了承認待ち。R-02未着手

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
`src/01_auth.gs`／`src/06_output.gs`／`src/index.html`／`src/top.html`／`src/daily.html`／`src/summary.html`／`appsscript.json`／`.clasp.json`／正本11点／`deal_records` などの実データ行／Git push／GitHub Pages／デプロイA・B。

デプロイ更新と実画面確認を完了判定に含めない（ルールブック §18）。

---

## 26. ユーザー（けんたろう）が行う確認

確認は2段階に分ける。第1段階は機能確認であり、工程完了の承認ではない。

### 26-1. 第1段階：機能確認（実施順4）

| # | 依頼内容 |
|---|---|
| 1 | **見出しの存在確認結果の確認と、追加・シート新設の承認・実施**（§15の停止点1）。手作業＝存在しない見出しだけ（`deal_records` V1〜Z1、`store_master` の `address`）。`user_master` の `role` は既存列のため追加しない。`setupSheets()` の実行＝`deal_additions` の新規作成のみ。既存データ行・既存の `role` 値は編集しない。重複列を作らない |
| 2 | **既存の** `user_master` の `role` 列へ、パイロット6名分の値（`sales`／`manager`／`sales_support`／`sysadmin`）を設定する。新しい `role` 列を作らない。`admin_staff` は使用しない |
| 3 | GASエディタから **`tmpR01_checkResolveCustomerStore()`**（引数なし）を実行し、有効店舗ID・手入力店舗名・店舗未指定の3パターンの結果を確認する |
| 4 | 静的チェック結果と変更ファイル一覧を確認し、対象範囲を超えた変更がないことを確認する |
| 5 | **一時確認関数の削除と、削除後の `clasp push --force` を承認する** |

この時点ではR-01の完了承認を行わない。

### 26-2. 第2段階：工程完了承認（実施順10）

次がすべて終わったあとに、けんたろうがR-01の完了を承認する。

1. 一時確認関数の削除
2. 再度の `clasp push --force`
3. `tasks/TASK_CURRENT.md` の更新
4. 本体6ファイル＋`tasks/TASK_CURRENT.md` の1コミット作成
5. `git status` に未コミット差分がないことの確認
6. Codexの完了報告（§25。確定したコミットハッシュを含む）

承認までR-02へ進まない。デプロイ更新・実機確認は本工程では依頼しない（R-03）。

---

## 27. 完了条件

次をすべて満たしたときにR-01を完了とする。

1. §7の本体6ファイルの修正が完了し、§18の静的チェックがすべて成功している
2. 旧仕様の残存確認（§18の項目9）がすべて0件である
3. `clasp push --force` が**2回とも成功している**（①静的チェック成功後の反映、②一時確認関数の削除後の反映）。未実行のままR-01を完了としない
4. `tmpR01_checkResolveCustomerStore()` による機能確認が完了し、一時確認関数が削除され、GAS側から `tmpR01_` で始まる関数が消えたことを確認している
5. `tasks/TASK_CURRENT.md` が§24のとおり更新されている
6. Git commit が**1件**作成され、本体6ファイル＋`tasks/TASK_CURRENT.md` の計7ファイルを含み、一時確認関数を含んでいない。**push は行われていない**
7. `tasks/TASK_CURRENT.md` を含め、`git status` に未コミット差分がない
8. 見出しの存在確認の結果と、追加した見出し・シート新設について、承認を得た範囲と実施状況が報告されている。`user_master` の `role` の重複列が作られていない
9. Codexの完了報告（§25）が提出され、確定したコミットハッシュが報告されている（`tasks/TASK_CURRENT.md` にはハッシュを書いていない）
10. けんたろうが§26-1の機能確認を終えたうえで、§26-2のとおりR-01の完了を承認している

「新形式で商談を保存できること」「顧客名がGASで確定すること」「不正店舗が拒否されること」の実データによる確認は、R-03の実通信確認で行う。本工程の完了条件には含めない。

---

## 28. 停止条件

次に該当した場合は、作業を続けず、その時点で停止して報告する。

1. 既存A〜U列の位置を動かす必要が生じた
2. 正本間に矛盾があり、どちらを採用するかCodexが判断できない
3. `deal_records` の既存データ行を変更する必要が生じた
4. §7の7ファイル以外を変更する必要が生じた
5. 静的チェックでエラーが解消できない
6. スプレッドシートの見出し追加・シート新設について、けんたろうの承認が得られていない
7. 既存の見出し（`user_master` の `role` など）と同名の列を追加しなければ実装が完結しない状況になった、または既存データ行・既存の `role` 値の変更が必要になった
8. **`clasp push --force` を実行できない、または失敗した**（一時確認関数をGASへ反映できず、ユーザー確認が行えないため、R-01は未完了とする）
9. 一時確認関数の削除後に `clasp push --force` を実行できない、またはGAS側から一時確認関数が消えたことを確認できない
10. R-02・R-03の作業（権限判定・追記・日報・公開反映）に手を付けなければ実装が完結しない状況になった
11. `appsscript.json`・`.clasp.json` の変更が必要になった
12. デプロイ更新・Git push・GitHub Pages反映が必要になった

---

## 29. 次工程には進まないこと

- 本工程の完了報告後、Codexは自動でR-02へ進まない
- R-02の実装指示書は、けんたろうがR-01の完了を承認したあとにClaudeが提示する
- 権限制御・追記機能・日報画面の改修に、本工程で先行して手を付けない
- 公開反映（Git push、GitHub Pages、デプロイA・B更新）はR-03で行う。本工程では行わない
- `deal_records` のテストデータ削除は、R-03完了後の個別承認ゲートで扱う。本工程では行わない

---

（本書は工程R-01のCodex向け実装指示書である。正本ではない。仕様の正は正本11点であり、本書は正本を書き換えない。）
