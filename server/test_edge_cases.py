import base64
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000"

def run_test_case(name, path, data=None, headers=None, expected_status=200):
    print(f"\n▶ 執行測試案例: {name}")
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
        
    req_data = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(
        url,
        data=req_data,
        headers=req_headers,
        method="POST" if data is not None else "GET"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            print(f"  [成功] 狀態碼: {response.status}")
            if expected_status != response.status:
                print(f"  ❌ 狀態碼不符合預期：得到 {response.status}，預期 {expected_status}")
                exit(1)
            print("  ✅ 測試通過！")
            return res_body
    except urllib.error.HTTPError as e:
        print(f"  [錯誤] 狀態碼: {e.code}")
        err_content = e.read().decode('utf-8')
        print(f"  錯誤訊息: {err_content}")
        if expected_status != e.code:
            print(f"  ❌ 狀態碼不符合預期：得到 {e.code}，預期 {expected_status}")
            exit(1)
        print("  ✅ 測試通過！")
        try:
            return json.loads(err_content)
        except Exception:
            return err_content
    except Exception as e:
        print(f"  ❌ 發生異常: {e}")
        exit(1)


# ─── 步驟 0. 獲取登入 Token ───────────────────────────────────────────────────

print("=== [邊緣測試] 正在登入以取得合法憑證 ===")
login_payload = {
    "email": "demo@healthsync.local",
    "password": "healthsync-demo"
}
login_res = run_test_case("登入 demo 帳戶", "/auth/login", data=login_payload, expected_status=200)
valid_token = login_res["access_token"]
auth_header = {"Authorization": f"Bearer {valid_token}"}


# ─── 邊緣測試案例 1. 無 Token 同步上傳 ──────────────────────────────────────────

sync_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [],
    "alerts": []
}

run_test_case(
    name="未攜帶 Token 上傳同步數據 (預期 401)",
    path="/sync/batch",
    data=sync_payload,
    headers={},
    expected_status=401
)


# ─── 邊緣測試案例 2. 攜帶無效 Token 同步上傳 ────────────────────────────────────

run_test_case(
    name="攜帶無效 Token 上傳同步數據 (預期 401)",
    path="/sync/batch",
    data=sync_payload,
    headers={"Authorization": "Bearer invalid_jwt_token_signature_here"},
    expected_status=401
)


# ─── 邊緣測試案例 3. 空的同步數據載荷 ───────────────────────────────────────────

empty_res = run_test_case(
    name="上傳空數據載荷 (預期 200 成功)",
    path="/sync/batch",
    data=sync_payload,
    headers=auth_header,
    expected_status=200
)
assert empty_res["success"] is True
assert empty_res["accepted_health_record_count"] == 0
assert empty_res["accepted_alert_count"] == 0


# ─── 邊緣測試案例 4. 健康紀錄缺少 steps 欄位 (向下相容測試) ─────────────────────────

compatible_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [
        {
            "window_start": (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat(),
            "window_end": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
            "avg_hr": 75,
            "min_hr": 68,
            "max_hr": 85,
            "avg_hrv": 45,
            "avg_spo2": 98.0,
            "min_spo2": 96.5,
            "dominant_activity_level": 1,
            "sample_count": 120
            # 注意：這裡故意漏掉新加入的 steps 欄位，以測試預設值相容性
        }
    ],
    "alerts": []
}

compat_res = run_test_case(
    name="上傳無 steps 欄位的健康紀錄 (預期 200 成功且預設為 0)",
    path="/sync/batch",
    data=compatible_payload,
    headers=auth_header,
    expected_status=200
)
assert compat_res["success"] is True
assert compat_res["accepted_health_record_count"] == 1


# ─── 邊緣測試案例 5. 異常的 Base64 數據壓縮載荷 ────────────────────────────────────

broken_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [
        {
            "window_start": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat(),
            "window_end": (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat(),
            "avg_hr": 75,
            "min_hr": 68,
            "max_hr": 85,
            "avg_hrv": 45,
            "avg_spo2": 98.0,
            "min_spo2": 96.5,
            "dominant_activity_level": 1,
            "sample_count": 120,
            "raw_data_payload": "This is definitely NOT valid base64 compression payload!!!"
        }
    ],
    "alerts": []
}

run_test_case(
    name="上傳無效 Base64/壓縮載荷 (預期 400 錯誤/交易回滾)",
    path="/sync/batch",
    data=broken_payload,
    headers=auth_header,
    expected_status=400
)


# ─── 邊緣測試案例 6. 沒有時區的時間欄位被拒絕 (預期 400) ─────────────────────────

naive_time_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [
        {
            "window_start": "2026-05-23T12:00:00",  # naive
            "window_end": "2026-05-23T12:10:00Z",
            "avg_hr": 75,
            "min_hr": 68,
            "max_hr": 85,
            "avg_hrv": 45,
            "avg_spo2": 98.0,
            "min_spo2": 96.5,
            "dominant_activity_level": 1,
            "sample_count": 120
        }
    ],
    "alerts": []
}

run_test_case(
    name="上傳無時區資訊的時間欄位 (預期 400 錯誤)",
    path="/sync/batch",
    data=naive_time_payload,
    headers=auth_header,
    expected_status=400
)


# ─── 邊緣測試案例 7. window_start >= window_end 被拒絕 (預期 400) ─────────────────

invalid_window_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [
        {
            "window_start": datetime.now(timezone.utc).isoformat(),
            "window_end": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),  # end before start
            "avg_hr": 75,
            "min_hr": 68,
            "max_hr": 85,
            "avg_hrv": 45,
            "avg_spo2": 98.0,
            "min_spo2": 96.5,
            "dominant_activity_level": 1,
            "sample_count": 120
        }
    ],
    "alerts": []
}

run_test_case(
    name="上傳 window_start >= window_end 的健康紀錄 (預期 400 錯誤)",
    path="/sync/batch",
    data=invalid_window_payload,
    headers=auth_header,
    expected_status=400
)


# ─── 邊緣測試案例 8. sample_count < 0 被拒絕 (預期 400) ───────────────────────────

invalid_sample_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [
        {
            "window_start": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(),
            "window_end": datetime.now(timezone.utc).isoformat(),
            "avg_hr": 75,
            "min_hr": 68,
            "max_hr": 85,
            "avg_hrv": 45,
            "avg_spo2": 98.0,
            "min_spo2": 96.5,
            "dominant_activity_level": 1,
            "sample_count": -5  # invalid
        }
    ],
    "alerts": []
}

run_test_case(
    name="上傳 sample_count < 0 的健康紀錄 (預期 400 錯誤)",
    path="/sync/batch",
    data=invalid_sample_payload,
    headers=auth_header,
    expected_status=400
)


# ─── 邊緣測試案例 9. status_history 空陣列被拒絕 (預期 400) ────────────────────────

empty_status_hist_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [],
    "alerts": [
        {
            "alert_id": "alert_test_empty_hist_001",
            "alert_type": "spo2_risk",
            "trigger_reason": "Test",
            "initial_risk_score": 5,
            "max_risk_score": 5,
            "max_severity_level": "中度",
            "first_occurred_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None,
            "status_change_count": 0,
            "status_history": []  # empty
        }
    ]
}

run_test_case(
    name="上傳 status_history 空陣列的預警紀錄 (預期 400 錯誤)",
    path="/sync/batch",
    data=empty_status_hist_payload,
    headers=auth_header,
    expected_status=400
)


# ─── 邊緣測試案例 10. status_change_count 不一致被拒絕 (預期 400) ─────────────────

mismatch_count_payload = {
    "device_id": "edge_device_001",
    "sync_started_at": datetime.now(timezone.utc).isoformat(),
    "periodic_health_records": [],
    "alerts": [
        {
            "alert_id": "alert_test_mismatch_count_001",
            "alert_type": "spo2_risk",
            "trigger_reason": "Test",
            "initial_risk_score": 5,
            "max_risk_score": 5,
            "max_severity_level": "中度",
            "first_occurred_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None,
            "status_change_count": 2,  # mismatch with 1 history item
            "status_history": [
                {
                    "status": "注意",
                    "risk_score": 5,
                    "status_time": datetime.now(timezone.utc).isoformat(),
                    "status_description": "SpO2 偏低"
                }
            ]
        }
    ]
}

run_test_case(
    name="上傳 status_change_count 與 status_history 長度不符的預警紀錄 (預期 400 錯誤)",
    path="/sync/batch",
    data=mismatch_count_payload,
    headers=auth_header,
    expected_status=400
)


print("\n================== 所有邊緣測試案例成功通過！ ==================")
