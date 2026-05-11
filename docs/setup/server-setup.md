# Server Setup

## 1. 這份文件在說什麼

這份文件用來說明後端開發環境怎麼準備，以及平常怎麼啟動本專案的後端部分。

## 2. 概念

`server/` 是平常後端開發的主要位置。

可以先把它理解成：接收請求、處理資料、對外提供服務的那一側。

## 3. 前置需求

開始前請先安裝：

- Python
- Docker Desktop

## 4. 後端準備步驟

第一次準備後端環境時，通常先做下面這些事。這一段適合交給 AI 幫忙執行：

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
```

資料庫由根目錄的 Docker Compose 啟動，這一段也適合交給 AI 幫忙執行：

```powershell
cd ..
docker compose up -d postgres
cd server
```

## 5. 日常使用流程

日常需要進行後端開發或檢查時，可先在 `server/` 啟動服務：

```powershell
cd server
uvicorn app.main:app --reload
```

如果之後需要調整資料庫或環境設定，再依實際情況詢問 AI 協助即可。
