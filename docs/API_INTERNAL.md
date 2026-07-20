# API_INTERNAL.md

## 0. この文書の位置づけ

本書は、GAS の内部関数（API）を Codex が実装時に参照するための**実装用抜粋**である。

関数のシグネチャ・引数・戻り値・処理フロー・エラーハンドリングの正は、次の正式文書とする。

- API一覧・内部関数一覧（全フェーズ統合版v2・最新版）

本書だけを根拠に実装してはならない。関数の詳細仕様は API一覧を確認する。GAS の物理ファイル分割（どの関数をどのファイルに置くか）は本書では確定せず、対象工程の実装指示書で指定する。

---

## 1. Phase 1 の関数一覧

| API-ID | 関数名 | 種別 | 呼び出し元 | 概要 |
|---|---|---|---|---|
| API-01 | doGet(e) | client→GAS | ブラウザ | エントリポイント。HTML画面（SPA）を返す |
| API-02 | validateUser() | GAS内部 | doGet／submitMemo | ログイン者のメールを担当者マスタと照合し、有効性・氏名・営業所を返す |
| API-03 | submitMemo(payload) | client→GAS | S-02 | 商談テキストを受け取り、AI解析・分割・書き込みの一連を実行する |
| API-04 | callAiApi(inputText) | GAS→外部 | submitMemo | OpenAI API にテキストを送り、構造化JSON文字列を得る |
| API-05 | buildAiRequestPayload(systemPrompt, inputText) | GAS内部 | callAiApi | AIリクエストのペイロード（System Prompt＋入力）を組み立てる |
| API-06 | parseAiResponse(aiResponseText) | GAS内部 | submitMemo | AIレスポンスJSONをパースしレコード配列に変換する |
| API-07 | writeRecordsToSheet(records) | GAS内部 | submitMemo | レコード配列を商談記録シートに書き込む（A〜L＋S〜U列） |
| API-08 | generateRecordId(index) | GAS内部 | writeRecordsToSheet | record_id を「YYYYMMDD-HHMMSS-連番（3桁）」で生成する |
| API-09 | markExtractionFailure(sheet, rowNumber, record) | GAS内部 | writeRecordsToSheet | 必須項目が空欄の行を「要確認」にし、空欄必須セルに赤背景を設定する |
| API-10 | lookupBranch(userKey) | GAS内部 | submitMemo | user_key（メール）から担当者マスタを検索し営業所名を返す |
| API-11 | getAiApiKey() | GAS内部 | callAiApi | スクリプトプロパティから AI APIキーを取得する |
| API-12 | getSystemPrompt() | GAS内部 | buildAiRequestPayload | GASコード内の System Prompt テキストを返す |
| API-13 | logError(...) | GAS内部 | 各関数（例外時） | AI API失敗・実行時エラー等を error_log シートに記録する |
| API-14 | getStoreCandidates(lat, lng) | GAS内部 | S-02 | 座標を店舗マスタと距離照合し、近い順4店舗を返す |
| API-15 | searchStoresByName(name) | GAS内部 | S-02 | 店名の部分一致で店舗マスタを検索し名寄せ候補を返す |

API-20 以降（runMorningBriefing・sendChatMessage 等）は **活用フェーズ（Phase 2）**であり、Phase 1 では実装しない。

---

## 2. 呼び出し関係

```
doGet ── validateUser（Session からメール取得 → 担当者マスタ照合）
   └─（HTMLを返す。以降はクライアントの google.script.run で呼ぶ）

S-02（送信）── submitMemo(payload)
                 ├─ validateUser / lookupBranch（サーバー側で担当者・営業所を特定）
                 ├─ callAiApi ── getAiApiKey ／ buildAiRequestPayload ── getSystemPrompt
                 ├─ parseAiResponse
                 └─ writeRecordsToSheet ── generateRecordId ／ markExtractionFailure
   例外時 ── logError（error_log へ記録）

S-02（送信時の店舗選び）── getStoreCandidates（近い順4件）
                          └─ 該当なし → searchStoresByName（名寄せ）
```

submitMemo は、クライアントから担当者情報を受け取らず、サーバー側で Session からメールを取得して担当者を特定する（改ざん防止）。確定した店舗名は payload.storeName、座標は payload.latitude／payload.longitude として受け取り、そのまま格納する。

---

## 3. 主要関数の入出力（抜粋）

> 詳細な引数・戻り値・処理フロー・エラーハンドリングは API一覧を正とする。

### API-01 doGet(e)
- 入力：GAS標準イベント e（URLパラメータは未使用）
- 出力：HtmlOutput（メインHTMLテンプレートを evaluate したもの）
- 備考：初回アクセス時のみ呼ばれる。ページタイトル設定、モバイル表示許可（XFrameOptions ALLOWALL）

### API-02 validateUser()
- 入力：引数なし（GAS が Session.getActiveUser().getEmail() でメール取得）
- 出力：{ valid, userKey, userName, branchName, errorMessage }
- 備考：メール未取得・マスタ不一致・無効フラグは valid=false とエラーメッセージ

### API-03 submitMemo(payload)
- 入力：payload { inputText, latitude, longitude, storeName }
- 出力：{ success, recordCount, records[] }（成功時）／{ success:false, errorMessage }（失敗時）
- 主なエラー：inputText 空＝書き込まず success=false／AI APIタイムアウト・HTTPエラー＝書き込まず success=false／AIレスポンスがJSON解析不能＝全文を1レコードで「要確認」＋赤背景にして success=true／一部レコードの必須項目空欄＝空欄のまま「要確認」＋赤背景で success=true／シート書き込みエラー＝success=false

### API-07 writeRecordsToSheet(records)
- 入力：レコード配列
- 出力：なし（副作用としてシートに追記）
- 備考：A〜L 列に加え S〜U 列（緯度・経度・店舗名）も書き込む。行ごとに generateRecordId で採番し、markExtractionFailure で赤背景・要確認を判定

### API-09 markExtractionFailure(sheet, rowNumber, record)
- 備考：extract_status が「要確認」の場合、空欄の必須セル（E＝顧客名・G＝案件テーマ・H＝商談内容）のみ背景色 #FF0000 に設定する

### API-14 getStoreCandidates(lat, lng)
- 入力：緯度・経度
- 出力：近い順4店舗の候補（店舗マスタとの距離照合）
- 備考：外部の逆ジオコーディングAPIは使わない

### API-15 searchStoresByName(name)
- 入力：店名（部分一致）
- 出力：名寄せ候補（GPS候補に該当なしの手入力フォールバック）

---

## 4. 設計上の前提（API一覧より）

- 画面は SPA。doGet は1回のみ呼ばれ、画面遷移はクライアントの DOM 操作で行う
- localStorage 操作（unsent_text の保存・復元・削除）はクライアント側で行う。担当者情報は localStorage に保存しない
- 音声認識（Web Speech API）はクライアントで完結し、GAS 関数は関与しない
- AI APIへのリクエストは1送信につき1回。GAS側でリトライしない（再送はユーザー操作に委ねる）
- AIレスポンスの JSON プロパティ名は商談記録シートの物理名（customer_name, customer_type, deal_theme, deal_content, todo_item, todo_deadline）と一致させる前提
- スプレッドシートID はスクリプトプロパティまたはコード内定数で一元管理する
- APIキーはハードコードせず、スクリプトプロパティで管理する（getAiApiKey）

---

## 5. 未確定事項（Codex は推測で確定しない）

- System Prompt の具体的な指示文（AIプロンプト設計書で策定。getSystemPrompt が返す内容）
- record_id の同一秒衝突対策（全拠点展開時）
- GAS の物理ファイル分割（対象工程の実装指示書で指定）

未確定に遭遇した場合は「要確認」として報告し、停止する。

---

## 6. 実装時の参照先

- 関数の詳細仕様：API一覧・内部関数一覧（正）
- データ構造：DB_SCHEMA.md（正は DB設計書）
- 画面と操作：SCREEN_FLOW.md（正は 画面遷移図・画面一覧）
- 業務ルール：SPEC_WEBAPP.md（正は 要件定義書）
- 実装する工程と変更対象：対象工程の実装指示書
