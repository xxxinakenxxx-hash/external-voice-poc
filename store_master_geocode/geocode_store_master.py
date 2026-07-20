#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
store_master 住所 → 緯度経度 変換スクリプト（国土地理院API・無料）

使い方:
    python3 geocode_store_master.py

前提:
    - 入力CSV（store_master_熊本_整形済み.csv）が同じフォルダにあること
    - Python 3.8以上（標準ライブラリのみ。追加インストール不要）
    - インターネット接続（国土地理院APIに到達できること）

動作:
    - 入力CSVの address 列を、国土地理院ジオコーディングAPIに1件ずつ問い合わせる
    - 取得できたら latitude / longitude 列を埋める
    - 1件ごとに一定間隔を空けてサーバー負荷を避ける
    - 途中で止めても、出力CSVに保存済みの続きから再開できる
    - 変換できなかった行は、失敗リストCSVに別途書き出す

出力:
    - store_master_熊本_緯度経度あり.csv … 緯度経度を埋めたCSV（スプレッドシートへコピペ用）
    - store_master_熊本_変換失敗.csv     … 変換できなかった店舗のみ（手当て用）

注意:
    - 本スクリプトは本番スプレッドシートに一切書き込まない。ローカルCSVを保存するだけ。
    - スプレッドシートへの反映は、けんたろうが出力CSVを確認してから手動でコピペする。
"""

import csv
import io
import os
import sys
import time
import json
import urllib.request
import urllib.parse

# ===== 設定 =====
INPUT_CSV  = "store_master_熊本_整形済み.csv"
OUTPUT_CSV = "store_master_熊本_緯度経度あり.csv"
FAIL_CSV   = "store_master_熊本_変換失敗.csv"

GSI_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"
REQUEST_INTERVAL_SEC = 0.7   # 1件ごとの待機（サーバー負荷への配慮。短くしすぎない）
TIMEOUT_SEC = 15
USER_AGENT = "store-master-geocoder/1.0"

# CSVの列名（整形済みCSVのヘッダに合わせる）
COL_ID    = "store_id"
COL_NAME  = "store_name"
COL_ADDR  = "address"
COL_LAT   = "latitude"
COL_LON   = "longitude"
COL_FLAG  = "active_flag"


def geocode(address):
    """住所を緯度経度に変換する。成功なら (lat, lon)、失敗なら None を返す。"""
    url = GSI_URL + "?q=" + urllib.parse.quote(address)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as res:
            data = json.loads(res.read().decode("utf-8"))
    except Exception as e:
        print(f"    [通信エラー] {type(e).__name__}: {str(e)[:80]}")
        return None
    if not data:
        return None
    # 国土地理院APIは coordinates を [経度, 緯度] の順で返す
    try:
        lon, lat = data[0]["geometry"]["coordinates"]
        return (lat, lon)
    except (KeyError, IndexError, ValueError):
        return None


def load_rows(path):
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_done_ids(path):
    """出力CSVが既にあれば、緯度経度が埋まっている store_id を集める（再開用）。"""
    done = set()
    if not os.path.exists(path):
        return done
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row.get(COL_LAT) and row.get(COL_LON):
                done.add(row[COL_ID])
    return done


def main():
    if not os.path.exists(INPUT_CSV):
        print(f"入力CSVが見つかりません: {INPUT_CSV}")
        sys.exit(1)

    rows = load_rows(INPUT_CSV)
    fieldnames = [COL_ID, COL_NAME, COL_ADDR, COL_LAT, COL_LON, COL_FLAG]

    # 再開：出力CSVに既に緯度経度が入っている行はスキップ
    done_ids = load_done_ids(OUTPUT_CSV)
    prev_rows = {}
    if os.path.exists(OUTPUT_CSV):
        for r in load_rows(OUTPUT_CSV):
            prev_rows[r[COL_ID]] = r

    total = len(rows)
    ok = 0
    fail = 0
    fail_rows = []
    out_rows = []

    print(f"変換開始： {total} 件（済み {len(done_ids)} 件はスキップ）")

    for i, row in enumerate(rows, start=1):
        sid = row.get(COL_ID, "")
        name = row.get(COL_NAME, "")
        addr = (row.get(COL_ADDR, "") or "").strip()

        # 既に変換済みなら、その値を引き継ぐ
        if sid in done_ids and sid in prev_rows:
            out_rows.append(prev_rows[sid])
            ok += 1
            continue

        if not addr:
            row[COL_LAT] = ""
            row[COL_LON] = ""
            out_rows.append(row)
            fail += 1
            fail_rows.append(row)
            print(f"[{i}/{total}] 住所空欄: {name}")
            continue

        result = geocode(addr)
        if result:
            lat, lon = result
            row[COL_LAT] = lat
            row[COL_LON] = lon
            ok += 1
            print(f"[{i}/{total}] OK  {name} → {lat}, {lon}")
        else:
            row[COL_LAT] = ""
            row[COL_LON] = ""
            fail += 1
            fail_rows.append(row)
            print(f"[{i}/{total}] 失敗 {name} / {addr}")

        out_rows.append(row)

        # 一定件数ごとに途中保存（止まっても続きから再開できる）
        if i % 50 == 0:
            _save(OUTPUT_CSV, fieldnames, out_rows)
            print(f"    --- 途中保存（{i} 件目まで） ---")

        time.sleep(REQUEST_INTERVAL_SEC)

    # 最終保存
    _save(OUTPUT_CSV, fieldnames, out_rows)
    if fail_rows:
        _save(FAIL_CSV, fieldnames, fail_rows)

    print("\n===== 変換完了 =====")
    print(f"成功: {ok} 件")
    print(f"失敗: {fail} 件")
    print(f"出力: {OUTPUT_CSV}（スプレッドシートへコピペ用）")
    if fail_rows:
        print(f"失敗リスト: {FAIL_CSV}（Googleマップ等で手当て）")


def _save(path, fieldnames, rows):
    with io.open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})


if __name__ == "__main__":
    main()
