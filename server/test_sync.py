import base64
from datetime import datetime, timedelta
import json
import urllib.request
import msgpack
import zstandard as zstd
from sqlalchemy import create_engine, text

# ─── 1. 產生測試資料 ──────────────────────────────────────────────────────────

print("=== [E2E 測試] 開始產生模擬 10 分鐘健康數據 ===")
now = datetime.now()
window_start = now - timedelta(minutes=10)
window_end = now - timedelta(seconds=1)

# 120 筆 5 秒數據 (二維陣列: [offset_sec, hr, hrv, spo2, act])
records = []
for i in range(120):
    offset_sec = i * 5
    hr = 70 + (i % 10)  # 心率起伏
    hrv = 40 + (i % 5)
    spo2 = 98.0 + (i % 3) * 0.5
    act = i % 4
    records.append([offset_sec, hr, hrv, spo2, act])

print(f"成功生成 {len(records)} 筆即時採樣點。")

# ─── 2. 二進制打包 (MsgPack + ZSTD) ──────────────────────────────────────────

print("\n=== [E2E 測試] 執行 MsgPack 序列化與 ZSTD 壓縮 ===")
# MsgPack 序列化
packed_bytes = msgpack.packb(records)
print(f"MsgPack 序列化後大小: {len(packed_bytes)} bytes")

# ZSTD 壓縮
compressor = zstd.ZstdCompressor(level=3)
compressed_bytes = compressor.compress(packed_bytes)
print(f"ZSTD 壓縮後大小: {len(compressed_bytes)} bytes")

# 轉成 Base64 字串
base64_payload = base64.b64encode(compressed_bytes).decode('utf-8')
print(f"Base64 編碼後大小: {len(base64_payload)} bytes")

# ─── 3. 發送 API 請求到 localhost:8000 ────────────────────────────────────────

print("\n=== [E2E 測試] 發送同步 API 請求 (第一次) ===")
request_body = {
    "user_id": "demo_user_001",
    "device_id": "test_device_docker",
    "sync_started_at": now.isoformat(),
    "periodic_health_records": [
        {
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "avg_hr": 75,
            "min_hr": 70,
            "max_hr": 80,
            "avg_hrv": 42,
            "avg_spo2": 98.5,
            "min_spo2": 97.0,
            "dominant_activity_level": 1,
            "sample_count": 120,
            "raw_data_payload": base64_payload
        }
    ],
    "alerts": [
        {
            "alert_id": "alert_test_20260517_001",
            "alert_type": "spo2_risk",
            "trigger_reason": "SpO2 sustained low in E2E test",
            "initial_risk_score": 5,
            "max_risk_score": 8,
            "max_severity_level": "高度",
            "first_occurred_at": (now - timedelta(minutes=5)).isoformat(),
            "resolved_at": now.isoformat(),
            "status_change_count": 2,
            "status_history": [
                {
                    "status": "注意",
                    "risk_score": 5,
                    "status_time": (now - timedelta(minutes=5)).isoformat(),
                    "status_description": "SpO2 偏低"
                },
                {
                    "status": "已解除",
                    "risk_score": 2,
                    "status_time": now.isoformat(),
                    "status_description": "數值恢復正常"
                }
            ]
        }
    ]
}

req_data = json.dumps(request_body).encode('utf-8')
req = urllib.request.Request(
    "http://localhost:8000/sync/batch",
    data=req_data,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("API 回傳結果:")
        print(json.dumps(res_data, indent=2, ensure_ascii=False))
        assert res_data["success"] is True, "API 同步失敗！"
        print("✅ 第一次 API 同步請求成功發送與回傳！")
except Exception as e:
    print(f"❌ 第一次 API 同步測試失敗: {e}")
    exit(1)

# ─── 4. 測試防重冪等性 (Idempotency Test) ──────────────────────────────────────

print("\n=== [E2E 測試] 測試冪等性防重複寫入 (第二次發送相同 Payload) ===")
try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("API 回傳結果:")
        print(json.dumps(res_data, indent=2, ensure_ascii=False))
        assert res_data["success"] is True, "API 應回傳成功！"
        print("✅ 第二次 API 同步請求成功發送與回傳！")
except Exception as e:
    print(f"❌ 第二次 API 冪等測試失敗: {e}")
    exit(1)

# ─── 5. 驗證資料庫二進制內容是否與 PostgreSQL 一致 ────────────────────────────────

print("\n=== [E2E 測試] 連線 PostgreSQL 驗證原始資料與冪等性去重結果 ===")
DATABASE_URL = "postgresql+psycopg://healthsync_user:healthsync_password@postgres:5432/healthsync_alert"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # 1. 驗證資料表內此 Window 只有唯一一筆紀錄 (證明第二次發送被 ON CONFLICT DO NOTHING 濾除，沒有重複插入)
    count_query = text("""
        SELECT COUNT(*) 
        FROM periodic_health_records 
        WHERE user_id = 'demo_user_001' AND window_start = :w_start
    """)
    db_count = conn.execute(count_query, {"w_start": window_start}).scalar()
    print(f"該時間窗在資料庫中的紀錄筆數: {db_count} (預期為 1)")
    assert db_count == 1, "❌ 冪等性驗證失敗！資料庫中出現重複紀錄！"
    print("✅ 冪等性去重驗證成功！重複上傳未產生重複紀錄。")

    # 2. 驗證原始二進制資料解密還原
    query = text("""
        SELECT raw_data_payload, sample_count, avg_hr
        FROM periodic_health_records 
        WHERE user_id = 'demo_user_001' AND window_start = :w_start
    """)
    result = conn.execute(query, {"w_start": window_start}).fetchone()
    
    if not result:
        print("❌ 驗證失敗：資料庫找不到該筆紀錄！")
        exit(1)
        
    db_raw_bytes = result[0]
    db_sample_count = result[1]
    db_avg_hr = result[2]
    
    print(f"資料庫讀出樣本次數: {db_sample_count} (預期 120)")
    print(f"資料庫讀出二進制長度: {len(db_raw_bytes)} bytes")
    
    # 執行反向解密解壓
    decompressor = zstd.ZstdDecompressor()
    decompressed_bytes = decompressor.decompress(db_raw_bytes)
    restored_records = msgpack.unpackb(decompressed_bytes)
    
    print(f"ZSTD 解壓 & MsgPack 還原後筆數: {len(restored_records)}")
    assert len(restored_records) == 120, "還原筆數不符合預期！"
    assert restored_records[0] == [0, 70, 40, 98.0, 0], "還原首筆數據不符合預期！"
    
    print("\n✅ 還原驗證成功！資料庫中的二進制 Byte 流與原始感測器數據 100% 吻合！")

    # 3. 驗證預警歷史表 (AlertHistory)
    alert_query = text("""
        SELECT max_risk_score, duration, is_worsened, status 
        FROM alert_histories 
        WHERE alert_id = 'alert_test_20260517_001'
    """)
    alert_result = conn.execute(alert_query).fetchone()
    
    if not alert_result:
        print("❌ 驗證失敗：資料庫找不到該筆預警歷史！")
        exit(1)
        
    print(f"資料庫讀出預警最高風險分數: {alert_result[0]} (預期 8)")
    print(f"資料庫讀出預警持續時間: {alert_result[1]} (預期 300 左右)")
    print(f"資料庫讀出預警是否曾惡化: {alert_result[2]} (預期 True)")
    print(f"資料庫讀出預警狀態: {alert_result[3]} (預期 resolved)")
    
    assert alert_result[0] == 8, "預警風險分數不符合預期！"
    assert alert_result[2] is True, "預警惡化判定不符合預期！"
    
    print("✅ 預警寫入驗證成功！")
    
    # 4. 驗證 UserProfile 和 UserActivityBaseline seeding
    baseline_query = text("SELECT COUNT(*) FROM user_activity_baselines")
    baseline_count = conn.execute(baseline_query).scalar()
    print(f"資料庫中活動基準筆數: {baseline_count} (預期 4)")
    assert baseline_count >= 4, "❌ Seeding 活動基準筆數不足！"
    
    profile_query = text("SELECT name FROM user_profiles LIMIT 1")
    profile_name = conn.execute(profile_query).scalar()
    print(f"資料庫中使用者 Profile 名稱: {profile_name}")
    assert profile_name is not None, "❌ Seeding 使用者 Profile 未成功寫入！"

    print("================== [E2E 測試成功] ==================")
