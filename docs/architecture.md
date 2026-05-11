# System Architecture

## 1. 這份文件在說什麼

HealthSync Alert 目前採用前後端分離架構，分成手機端、伺服器後端服務與資料儲存三個主要部分。

## 2. 主要組成

- `mobile-app/`：Vue 3 + Capacitor 手機端，負責畫面、與後端 API 溝通，以及本地資料存取。
- `SQLite / localStorage`：手機端本地資料層。原生環境預計使用 SQLite，Web 開發時以 localStorage 模擬。
- `server/`：FastAPI 伺服器後端，提供健康檢查與資料庫測試 API。
- `PostgreSQL`：伺服器後端主要資料庫，供 API 服務讀寫。

## 3. 基本流程

目前系統以驗證連線與資料層為主，主要流程如下：

1. 手機端畫面發出 API 請求到 FastAPI。
2. FastAPI 處理請求，必要時連線 PostgreSQL。
3. 手機端也可直接操作本地資料層，做離線或暫存用途。
