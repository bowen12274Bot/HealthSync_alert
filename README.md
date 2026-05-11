# HealthSync Alert

本專案為智慧健康監測預警系統的開發工作區，採用前後端分離的雙專案架構：

- `mobile-app/`：手機端應用，預計使用 Vue 3 + Capacitor
- `server/`：雲端後端服務，預計使用 FastAPI

目前階段僅先完成專案目錄骨架，方便後續分別初始化手機端與伺服器端技術框架。

## 專案目錄

```text
HealthSync_Alert/
├─ mobile-app/   # 手機端專案
├─ server/       # 後端專案
├─ docs/         # 架構、資料庫、API、規則文件
└─ scripts/      # 開發與部署輔助腳本
```

## 目前狀態

- 已建立根目錄與子專案目錄結構
- 尚未初始化前端框架
- 尚未初始化後端框架
- 尚未加入功能實作程式碼

## 建議下一步

1. 在 `mobile-app/` 內初始化 Vue 3 專案
2. 在 `mobile-app/` 內加入 Capacitor
3. 在 `server/` 內初始化 FastAPI 專案
4. 後續再建立 PostgreSQL 與 SQLite 的整合設定
