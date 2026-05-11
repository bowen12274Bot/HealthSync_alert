# Server

本目錄為 FastAPI 後端專案。

目前已完成：

- 建立 `venv` 虛擬環境
- 安裝 `FastAPI` 與 `Uvicorn`
- 建立最小可執行入口 `app/main.py`

主要目錄用途：

- `app/api/`：API 路由層
- `app/core/`：設定與共用基礎設施
- `app/models/`：資料表模型
- `app/schemas/`：請求與回應格式
- `app/services/`：商業邏輯
- `app/repositories/`：資料存取層

本地啟動方式：

```powershell
.venv\Scripts\activate
uvicorn app.main:app --reload
```
