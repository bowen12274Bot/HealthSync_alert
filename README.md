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

## 文件入口

- 文件總覽：`docs/README.md`
- 系統架構：`docs/architecture.md`
- 專案範圍與後續方向：`docs/project-scope.md`
- 手機端初始化與啟動：`docs/setup/mobile-app-setup.md`
- 後端初始化與啟動：`docs/setup/server-setup.md`
- Android Studio 環境設定：`docs/setup/android-studio-setup.md`
- 協作規範：`CONTRIBUTING.md`
