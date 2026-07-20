# 【営業AIメモ】実装指示書 EX-08：doPostのアクション振り分けと店舗検索の接続

作成日：2026-07-15
作成：Claude（設計主幹）
工程：EX-08
前提工程：EX-07（会社ケータイ実機通し確認）完了／IS-06R設計（案イ確定版）承認済み

---

## 1. 工程名・目的

**工程名：** doPostのアクション振り分けと店舗検索の接続（GAS側＋疎通）

**目的：** 既存の送信API用doPost（doPostMemo／API-16）にアクション種別を追加し、次の3要求を1つのdoPostで振り分けられるようにする。全アクションで最初にトークンを検証する。新しい公開エンドポイントは作らない。

| アクション | 送るもの | GAS側の処理 | 返すもの |
|---|---|---|---|
| `storeCandidates` | token, latitude, longitude | verifyToken → getStoreCandidates（API-14） | 近い順4店舗 |
| `storeSearch` | token, keyword | verifyToken → searchStoresByName（API-15） | 名寄せ候補 |
| `submit`（既存） | token, inputText, latitude, longitude, storeName | verifyToken → submitMemo（API-03） | 保存結果 |

**なぜ1つのdoPostに集約するか：** doPost（デプロイB）は匿名公開である。公開エンドポイントを増やすほど守るべき入口が増える。1つのdoPostにアクションで振り分ける方が、トークン検証を1箇所に集約でき、安全で保守しやすい。

---

## 2. 前提工程

- EX-07完了（TOP→トークン→外部ページ→送信→AI解析→書き込み→結果表示の一連が動作）。
- IS-06R設計（案イ確定版）承認済み。
- store_masterに、EX-08の疎通確認用のテストデータ数件が整備済みであること（第8章で必要件数を指定）。約5,000店舗の座標整備は本工程に含めない。

### 全工程共通で必ず読むもの
1. `tasks/TASK_CURRENT.md`
2. `docs/ルールブック.md`
3. `AGENTS.md`

### 本工程で追加で読むもの
- 【営業AIメモ】IS-06R_位置情報・店舗選び_設計と工程分解.md（第2章・第3章）
- 改訂後のAPI一覧（API-14 getStoreCandidates／API-15 searchStoresByName／API-16 doPostMemo／API-18 verifyToken）

---

## 3. 着手前の必須確認（Codexが最初に行う）

実装前に、次を実際にファイルを開いて確認し、完了報告に記載する。**推測で進めない。**

1. 現在のdoPostのファイル名と関数名（想定：`src/` 内の `doPostMemo(e)`。実ファイル名を確認する）。
2. 現在の `submit` 処理の実装（トークン検証→submitMemo呼び出しの流れ、リクエストボディの取り出し方）。
3. API-14 `getStoreCandidates` の実装有無・関数名・引数・戻り値の形。
4. API-15 `searchStoresByName` の実装有無・関数名・引数・戻り値の形。
5. `store_master` の列構成。既定義列は `store_id`／`store_name`／`latitude`／`longitude`／`active_flag`。実際の列名・列順がこの定義と一致することを確認する。
6. 検証用ページ `external/voice-poc/index.html` の現状（EX-05Rで追加したトークン入力欄・inputText欄・応答表示の有無）。
7. `issueShortLivedTokenForTest`（EX-05Rで追加した検証専用の短命トークン発行関数）が存在するか。期限切れ確認に流用する。

**API-14またはAPI-15が、未実装／関数名・引数・戻り値が正本と一致しない／検索ロジックの変更が必要、と判明した場合：** 本工程は着手条件を満たさない。次のとおり停止する。

- 実装を開始しない。
- ファイルを変更しない。
- `clasp push --force`・Git操作・TASK_CURRENT.md更新をしない。
- 判明した状況（どのAPIが、どう一致しないか）を報告して停止する。
- ChatGPTが指示書を再設計する。

本工程は、**既存のAPI-14／API-15が存在し、その検索ロジックを変更せず、呼び出し元だけを追加できる場合に限り**進める。

---

## 4. 対象ファイル

- `src/` の doPost を含むファイル（第3章で確認した実ファイル。想定：`04_submit.gs` 付近）
- `external/voice-poc/index.html`（検証用ページ。アクション指定の送信欄を追加）
- `external/voice-poc/README.md`

---

## 5. 対象関数

- `doPostMemo(e)`（API-16）：アクション振り分けを追加する。
- `getStoreCandidates`（API-14）：**呼び出せるようにするが、関数ロジックは変更しない。**
- `searchStoresByName`（API-15）：**呼び出せるようにするが、関数ロジックは変更しない。**
- `verifyToken(token)`（API-18）：**変更しない。** 全アクションの先頭で呼ぶ。

---

## 6. 変更内容

### 6-1. doPostMemo(e) にアクション振り分けを追加

1. リクエストボディ（JSON）から `action` を取り出す。`action` が無い場合は、後方互換のため `submit` とみなす（既存の外部ページが `action` なしで送ってきても壊さない）。
2. **アクションの種別にかかわらず、最初に `verifyToken` でトークンを検証する。** 無効・改ざん・期限切れ・該当担当者なし・無効担当者は、ここで拒否して終了する（店舗検索にも進まない）。store_masterの内容が無検証で外部に晒されるのを防ぐ。
3. トークンが有効なら、`action` で分岐する。
   - `storeCandidates`：ボディから `latitude`・`longitude` を取り出し、`getStoreCandidates` に渡す。戻り値（近い順4店舗）をJSONで返す。緯度経度が無い場合は空配列を返す（エラーにしない）。
   - `storeSearch`：ボディから `keyword` を取り出し、`searchStoresByName` に渡す。戻り値（名寄せ候補）をJSONで返す。
   - `submit`：**既存の商談メモ送信処理をそのまま呼ぶ。現在の動作を一切変えない。**
   - 未知の `action`：エラーJSONを返す。
4. 例外は try-catch で捕捉し、`logError`（API-13）に記録した上でエラーJSONを返す。

### 6-2. Phase 2 doPost（API-26）との整合

doPost(e) の最上位で「Google Chatのイベント形式か／案B改の入力系リクエスト（token を持つ）か」を先に判定し、後者の中でアクション種別を見る。IS-06Rのアクション振り分けは、API-16（doPostMemo）の内部で枝分かれする形とし、Phase 2のAPI-26のルーティングと二重にしない。

### 6-3. 検証用ページ（external/voice-poc/index.html）にアクション指定を追加

- アクション選択（`storeCandidates`／`storeSearch`／`submit`）のUIを追加する（ラジオボタンまたはセレクト）。
- `storeCandidates` 用に、latitude・longitude の入力欄を追加する。
- `storeSearch` 用に、keyword の入力欄を追加する。
- 送信時、選択したアクションに応じてボディを組み立ててPOSTする。
- 応答（HTTPステータス・JSON本文）をそのまま表示する（EX-05Rの応答表示を流用）。
- トークン入力欄・`#token=` 自動反映・手動編集・全削除は、EX-05Rで追加済みのものを維持する。

### 6-4. Content-Type

`text/plain;charset=UTF-8` を維持する。**変更しない**（EX-02で成立したCORS回避の形式）。

---

## 7. 変更禁止ファイル／変更してよいもの／消してよいもの／消してはいけないもの

### 変更禁止ファイル
- **本番の外部入力ページ `external/input-page/`（EX-09で扱う。本工程では一切触らない）**
- 正本文書（要件定義書・API一覧・画面遷移図・画面一覧・DB設計書）
- `src/` の `submitMemo`（API-03）本体・`callAiApi`・`parseAiResponse`・`writeRecordsToSheet`・`logError`・AIプロンプト

### 変更してよいもの
- doPostMemo（アクション振り分けの追加のみ）
- 検証用ページ `external/voice-poc/`（アクション指定UIの追加）

### 消してよいもの
- 検証用ページの、EX-02時点の `EX02_DUMMY_TOKEN` 固定送信の名残があれば削除してよい（EX-05Rで撤去済みのはずだが、残っていれば消す）。

### 消してはいけないもの
- `getStoreCandidates`・`searchStoresByName` の検索ロジック（呼び出し元を追加するだけ。中身は消さない・変えない）
- `verifyToken` の検証ロジック
- 既存の `submit` 処理
- `issueShortLivedTokenForTest`（EX-09完了後まで残す。期限切れ確認に使う）

---

## 8. 実行前提（テスト店舗データ）

EX-08の疎通確認には、store_masterにテストデータが必要。**けんたろうがEX-08の実装着手前にstore_masterへ入力する。**

- **必要件数：** 5件（近い順4候補が成立するよう、最低5件）。
- **必要列（store_masterの既定義列）：** `store_id`／`store_name`／`latitude`／`longitude`／`active_flag`。
- **店舗名（store_name）：** 実在店舗の本番データを勝手に追加しない。「EX08テスト店舗01」〜「EX08テスト店舗05」のように、テスト用と明確に分かる名称を使う。
- **active_flag：** 5件とも有効値にする。
- **緯度経度（latitude／longitude）：** けんたろうが実機確認する場所（本社等）の近辺に散らばる座標。Googleマップで調べて手入力する。近い順が意味を持つよう、距離に差をつける。
- **store_id：** 既定義の採番規則に従う（テスト用に一意であればよい）。
- **入力担当・入力時点：** けんたろうがEX-08の実装着手前にstore_masterへ入力する。
- 約5,000店舗の本番整備（abr-geocoder）は本工程に含めない。

## 9. 静的チェック

1. 変更した `.gs` を一時 `.js` に抽出し、`node --check`。一時ファイルは削除する。
2. `external/voice-poc/index.html` の `<script>` を抽出して `node --check`。一時ファイルは削除する。
3. `getStoreCandidates`・`searchStoresByName` の関数本体に差分が入っていないことを `git diff` で確認する。
4. `external/input-page/` に変更が入っていないことを `git status` で確認する。

---

## 10. clasp push --force

**実行する。** `src/` で `clasp push --force` を実行する（doPostMemoの変更分）。

---

## 11. デプロイ反映の要否

- デプロイB（送信API用）：doPostを変更したため、**デプロイの更新が必要。** けんたろうが実施する（第14章）。URLが変わった場合は検証用ページの送信先を更新する。
- デプロイA（TOP用）：変更なし。更新不要。

---

## 12. Git操作

**あり。** `src/` と `external/voice-poc/` の変更をコミットし、pushする。`external/voice-poc/` はGitHub Pagesへ反映する。

---

## 13. TASK_CURRENT.md 更新

- EX-08の実施内容：doPostMemoにアクション振り分け（`storeCandidates`／`storeSearch`／`submit`）を追加。全アクションでトークン検証を先に実行。検証用ページにアクション指定UIを追加
- 着手前確認の結果（doPostの実ファイル名・関数名、API-14/15の実装状況・引数・戻り値、store_masterの列構成）
- 実機確認結果（店舗候補・名寄せ・トークン拒否3種・既存submitの動作）
- 本番ページ（`external/input-page/`）は未変更であること
- 次に進む先：EX-09（本番ページのGPS・店舗選択UI）※実機確認がすべて通った場合のみ

---

## 14. けんたろうの実機確認手順

Codexの作業完了後、順に実施する。**3つのアクション（storeCandidates／storeSearch／submit）それぞれで、正常＋拒否3種（なし・改ざん・期限切れ）を確認する。**

**手順1：** デプロイB（送信API用）を更新する。URLが変わった場合はCodexに連絡する。

**手順2：** store_masterにテストデータ5件が入っていることを確認する（第8章）。

**手順3：** TOP画面（デプロイA）を開き、「入力画面へ」のリンクからトークンを取得する。検証用ページのトークン入力欄に貼る。GAS送信先URL欄にデプロイBのURLを入れる。これを「有効トークン」とする。

### 14-1. storeCandidates（近い順候補）

**手順4-1（正常）：** アクション `storeCandidates`、有効トークン、緯度・経度にテストデータ近くの座標を入れて送信。→ **期待：HTTP 200。近い順に最大4店舗が返る。**

**手順4-2（トークンなし）：** トークン欄を空にして送信。→ **期待：拒否。候補が返らない。**

**手順4-3（改ざん）：** 有効トークンを1文字書き換えて送信。→ **期待：拒否。**

**手順4-4（期限切れ）：** GASエディタで `issueShortLivedTokenForTest` を実行して60秒有効の短命トークンを取得。直後に送信（→通る）、2分待って同じトークンで送信（→拒否）。

### 14-2. storeSearch（名寄せ）

**手順5-1（正常）：** アクション `storeSearch`、有効トークン、keyword にテスト店舗名の一部（例：「EX08テスト」）を入れて送信。→ **期待：HTTP 200。部分一致した店舗が返る。**

**手順5-2（トークンなし）：** トークン欄を空にして送信。→ **期待：拒否。候補が返らない。**

**手順5-3（改ざん）：** 有効トークンを1文字書き換えて送信。→ **期待：拒否。**

**手順5-4（期限切れ）：** 短命トークンを取得し、直後に送信（→通る）、2分待って送信（→拒否）。

### 14-3. submit（既存の商談送信）

**手順6-1（正常）：** アクション `submit`、有効トークン、inputText（例：`EX-08 submit test`）を入れて送信。→ **期待：HTTP 200。従来どおり保存結果が返り、deal_recordsに記録される。**

**手順6-2（トークンなし）：** トークン欄を空にして送信。→ **期待：拒否。記録されない。**

**手順6-3（改ざん）：** 有効トークンを1文字書き換えて送信。→ **期待：拒否。**

**手順6-4（期限切れ）：** 短命トークンを取得し、直後に送信（→通る）、2分待って送信（→拒否）。

### 14-4. 結果記録表

| アクション | 送ったトークン | HTTPステータス | 応答内容 | 期待どおりか |
|---|---|---|---|---|
| storeCandidates | 有効 | | | 200・4候補 |
| storeCandidates | なし | | | 拒否 |
| storeCandidates | 改ざん | | | 拒否 |
| storeCandidates | 期限切れ（直後） | | | 200 |
| storeCandidates | 期限切れ（2分後） | | | 拒否 |
| storeSearch | 有効 | | | 200・部分一致 |
| storeSearch | なし | | | 拒否 |
| storeSearch | 改ざん | | | 拒否 |
| storeSearch | 期限切れ（直後） | | | 200 |
| storeSearch | 期限切れ（2分後） | | | 拒否 |
| submit | 有効 | | | 200・記録 |
| submit | なし | | | 拒否 |
| submit | 改ざん | | | 拒否 |
| submit | 期限切れ（直後） | | | 200 |
| submit | 期限切れ（2分後） | | | 拒否 |

**手順7：** 上表を埋めて報告する。**3アクションすべてで、なし・改ざん・期限切れが拒否されること**を確認する。

## 15. 完了条件

1. `storeCandidates`（正しいトークン＋緯度経度）で近い順4店舗が返る。
2. `storeSearch`（正しいトークン＋キーワード）で部分一致候補が返る。
3. トークンなし・改ざん・期限切れが、**3アクション（storeCandidates／storeSearch／submit）すべてで拒否される。**
4. 既存の `submit` が従来どおり動作し、deal_recordsに記録される。
5. 本番入力ページ（`external/input-page/`）に変更がない。

---

## 16. 停止条件

- 店舗候補・名寄せが返らない。
- トークン拒否が、いずれかのアクションで効かない。
- 既存の `submit` が壊れる。

---

## 17. 戻り先

- doPostのアクション分岐・トークン検証の順序を切り分けて修正する。
- トークン拒否が効かない場合、それは検証ロジックの欠陥ではなく振り分け順序の問題である可能性が高い（`verifyToken` を分岐の後に置いていないか確認する）。`verifyToken` 本体は変更しない。
- 既存submitが壊れた場合、`action` なしのフォールバックが正しく `submit` に落ちているか確認する。
- いずれもEX-09へ進まない。

---

## 18. 次工程へ進んではいけない条件

第15章の完了条件5つをすべて満たし、けんたろうの実機確認（第14章のstoreCandidates／storeSearch／submitの正常確認および拒否確認がすべて期待どおり）が済むまで、EX-09へ進まない。特に**トークン拒否3種（なし・改ざん・期限切れ）が全アクションで効くこと**を確認しないままEX-09へ進んではならない。

---

## 19. Codexの完了報告形式

- 着手前確認の結果（第3章の1〜7）
- 変更したファイル一覧
- `node --check` の結果
- `getStoreCandidates`・`searchStoresByName` に差分がないことの確認結果（`git diff`）
- `external/input-page/` に変更がないことの確認結果（`git status`）
- `clasp push --force` の実行結果
- Gitのコミットハッシュ・push結果・GitHub Pages反映
- けんたろうへの依頼事項（第14章の実機確認一式）
- 停止条件該当の有無

---

## 20. 工程管理（ChatGPT）への指示の出し方

- 本指示書の内容を省略せずCodexに伝える。「よしなに」「適宜」に置き換えない。
- 第3章の着手前確認を必ず先に行わせる。推測でdoPostやAPI-14/15の仕様を決めさせない。
- **「API-14/15の検索ロジックを変更しない」「本番ページ `external/input-page/` を触らない」を明示的に伝える。**
- 第14章のけんたろうの作業は1ステップずつ伝える。3アクションすべての正常確認と、トークンなし・改ざん・期限切れの拒否確認を省略しない。
