# DB_SCHEMA.md

## 0. この文書の位置づけ

本書は、スプレッドシート構成を Codex が DBシート作成・読み書き実装時に参照するための**実装用抜粋**である。

**列定義・参照関係・更新ルールの正は、DB設計書（全フェーズ統合版v2・最新版）とする。** 本書は DB設計書を Codex 実装用に要約したものであり、原本の代替ではない。列の型・必須区分・採番ルール等で疑義が生じた場合は、必ず DB設計書を確認する。本書だけを根拠に実装してはならない。

CSV等の外部出力は Phase 1 には存在しない（データはスプレッドシートに蓄積する）。

---

## 1. Phase 1 で作るシート一覧

| シート名（物理） | 論理名 | 用途 | 書込方式 |
|---|---|---|---|
| deal_records | 商談記録シート | AIが構造化した商談記録を「顧客 × 案件テーマ」単位で蓄積する | 追記専用（新規行のみ。上書き・更新しない） |
| user_master | 担当者マスタシート | 担当者の照合・営業所名の引き当て | 管理者が編集 |
| branch_master | 営業所マスタシート | 営業所名のプルダウン元。表記ゆれ防止 | 初期データ |
| store_master | 店舗マスタシート | GPS位置から店舗（顧客）を確定するための店舗一覧 | 追加（管理者運用） |
| error_log | エラーログシート | AI API失敗・実行時エラー等を記録し障害調査に使う | GASが追記 |

Phase 2（活用フェーズ）のシート（見積依頼シート quote_requests・配信ログシート push_log）は **Phase 1 では作らない**。

---

## 2. 主要シートの列定義（抜粋）

> 完全な列定義・型・必須区分は DB設計書を正とする。以下は実装着手に要る範囲の抜粋。

### 2.1 deal_records（商談記録シート）

主キー：record_id。書込方式：常に新規行として追加。上書き・更新はしない。

Phase 1 の書き込み対象は A〜L 列と S〜U 列。

| 列 | 物理名 | 論理名 | 型 | 必須 | 取得元 |
|---|---|---|---|---|---|
| A | record_id | レコードID | 文字列 | 必須 | GAS自動採番 |
| B | created_at | 登録日時 | 日時 | 必須 | GAS自動日時 |
| C | branch_name | 営業所 | 文字列 | 必須 | 担当者マスタから引き当て |
| D | user_name | 担当者名 | 文字列 | 必須 | Googleログインのメールで担当者マスタを検索し fullname を格納 |
| E | customer_name | 顧客名 | 文字列 | 必須 | AIが抽出（失敗時は空欄＋赤背景） |
| F | customer_type | 顧客業態 | 文字列 | 任意 | AIが推定 |
| G | deal_theme | 案件テーマ | 文字列 | 必須 | AIが抽出（話題単位。失敗時は空欄＋赤背景） |
| H | deal_content | 商談内容 | 文字列 | 必須 | AIが整理（失敗時は空欄＋赤背景） |
| I | todo_item | 宿題・ToDo | 文字列 | 任意 | AIが抽出（無ければ空欄＝正常） |
| J | todo_deadline | 宿題期限 | 文字列 | 任意 | AIが抽出。原文表現のまま（日付変換しない） |
| K | original_text | 元テキスト（全文） | 文字列 | 必須 | 分割前の原文。分割時は各行に同一テキストを重複格納 |
| L | extract_status | 抽出ステータス | 文字列 | 必須 | GASが「OK」または「要確認」を設定 |
| S | latitude | 緯度 | 数値 | 任意 | Geolocation API。失敗時は空欄 |
| T | longitude | 経度 | 数値 | 任意 | Geolocation API。失敗時は空欄 |
| U | store_name_gps | 店舗名（GPS） | 文字列 | 任意 | 店舗マスタ照合で確定。失敗時は空欄 |

M〜R 列（温度感・案件ステータス・次回予定日・正規化期限・期限フラグ・見積依頼ID）は **活用フェーズ用**であり、Phase 1 では書き込まない。S〜U 列は既存列（活用フェーズ列を含む）の後方に置くため S 列以降とする。

補足：
- record_id 形式は「YYYYMMDD-HHMMSS-NNN」（NNN は同一送信内の連番・3桁ゼロ埋め）。例「20260401-143025-001」。
- extract_status は「OK」「要確認」の2値。必須抽出項目（customer_name・deal_theme・deal_content）のいずれかが空欄、または分割不能の場合に「要確認」。
- 赤背景（#FF0000）は「要確認」行の空欄必須セル（E・G・H）に設定する。

### 2.2 user_master（担当者マスタシート）

主キー：user_key（＝メールアドレス）。

主な列：user_key（メールアドレス・照合キー）／user_fullname（表示用フルネーム）／master_branch_name（営業所名）／active_flag（有効／無効。無効はマスタ不一致と同じエラー扱い）。

Googleログインで取得したメールアドレスを user_key と照合し、有効な担当者であれば user_fullname・master_branch_name を引き当てる。

### 2.3 branch_master（営業所マスタシート）

営業所名のプルダウン元。主な列：branch_name（営業所名）。表記ゆれ防止のためのマスタ。詳細な列は DB設計書を正とする。

### 2.4 store_master（店舗マスタシート）

主キー：store_id。

主な列：store_id／store_name（店舗名＝顧客名）／latitude（緯度）／longitude（経度）／active_flag（有効フラグ）。

送信時の座標と本マスタを距離照合し、近い順4候補を出す。店名の部分一致検索の対象でもある。該当なしの場合の手入力値はそのまま格納し、マスタ追加は管理者運用。

### 2.5 error_log（エラーログシート）

AI API失敗・GAS実行時エラー等を記録する。記録内容（発生日時・エラー種別・メッセージ・関連する user_key 等）と正確な列構成は **DB設計書を正とする**（本書で列を推測して確定しない）。

---

## 3. 参照関係（Phase 1 分）

| # | 内容 | 結合元 → 結合先 | タイミング |
|---|---|---|---|
| R-01 | 担当者名の引き当て | user_master.user_fullname → deal_records.user_name | GAS書き込み時 |
| R-02 | 営業所名の引き当て | user_master.master_branch_name → deal_records.branch_name | GAS書き込み時 |
| R-03 | 営業所名のプルダウン参照 | branch_master.branch_name → user_master.master_branch_name | 管理者の手入力時 |
| R-04 | エラーログの担当者参照 | error_log.user_key → user_master.user_key | GAS書き込み時（担当者特定前は空欄可） |
| R-08 | 店舗名のGPS確定 | store_master.store_name → deal_records.store_name_gps | GAS書き込み時（距離照合・名寄せ選択） |

R-05〜R-07（見積依頼・配信ログ関連）は Phase 2 であり、Phase 1 では扱わない。

---

## 4. 全シート共通ルール

- ID採番：GAS が採番する。record_id は「YYYYMMDD-HHMMSS-連番（3桁ゼロ埋め）」。
- deal_records は追記専用。過去レコードを更新・上書きしない。修正は管理者がシートを直接編集する。
- 参照整合性はスプレッドシートに制約が無いため、GASコード内のバリデーションで担保する。deal_records には引き当て後の「値」を直接格納する（非正規化）。
- キャンセル・削除の概念は Phase 1 にはない（追記のみ）。
- 位置情報は S〜U 列にのみ格納し、localStorage には保管しない。
- user_key はメールアドレス。

---

## 5. 未確定事項（Codex は推測で確定しない）

- record_id の同一秒衝突対策（全拠点展開時の方式見直し）
- branch_master・error_log の詳細列構成（DB設計書を正とする）
- スプレッドシートID の管理方法（スクリプトプロパティまたはコード内定数。実装指示書で指定）

未確定に遭遇した場合は「要確認」として報告し、停止する。
