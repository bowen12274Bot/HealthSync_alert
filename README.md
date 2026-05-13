# HealthSync Alert

本專案為智慧健康監測預警系統的開發工作區，採用前後端分離的雙專案架構：

- `mobile-app/`：手機端應用，預計使用 Vue 3 + Capacitor
- `server/`：雲端後端服務，預計使用 FastAPI

目前專案已包含可啟動的 FastAPI 後端，以及用 Docker Compose 管理的 PostgreSQL 與後端容器。

## 專案目錄

```text
HealthSync_Alert/
├─ mobile-app/   # 手機端專案
├─ server/       # 後端專案
├─ docs/         # 架構、資料庫、API、規則文件
└─ scripts/      # 開發與部署輔助腳本
```

## 文件入口

- 文件總覽：`docs/README.md`
- 系統架構：`docs/architecture.md`
- 專案範圍與後續方向：`docs/project-scope.md`
- 手機端初始化與啟動：`docs/setup/mobile-app-setup.md`
- 後端初始化與啟動：`docs/setup/server-setup.md`
- Android Studio 環境設定：`docs/setup/android-studio-setup.md`
- 協作規範：`CONTRIBUTING.md`

## 快速啟動

### 後端與資料庫

若要一次啟動後端與資料庫，可在專案根目錄執行：

```powershell
docker compose up --build
```

啟動後：

- PostgreSQL 對外埠號為 `5433`
- FastAPI 對外埠號為 `8000`

### 前端開發站

若要啟動手機端前端開發站，可執行：

```powershell
cd mobile-app
npm install
npm run dev
```

### Android 模擬器流程

若要進行 Android 模擬器或實機測試，可先同步前端輸出到 Android 專案：

```powershell
cd mobile-app
npm run build
npx cap sync android
```

接著由開發者自行在 Android Studio：

1. 開啟 `mobile-app/android`
2. 啟動模擬器或接上實機
3. 執行 Android 測試
