# Contributing Guide

## 1. 這份文件在說什麼

這份文件用來說明新加入的開發者應該怎麼理解這個專案，以及怎麼用一致的方式提交變更。

## 2. 先怎麼看這個專案

建議先用下面順序理解專案：

1. 先看 `README.md`，了解專案目標與文件入口。
2. 再看 `docs/architecture.md`，掌握整體系統分層與資料流。
3. 需要準備環境時，再看 `docs/setup/` 下面對應的文件。

目前可以先把專案理解成三個部分：

- `mobile-app/`：手機端與前端介面，負責畫面、API 呼叫與本地資料存取。
- `server/`：後端 API，負責資料處理與資料庫存取。
- `docs/`：架構、啟動方式與其他設計文件。

## 3. 協作方式

這個專案的文件與流程有一部分是為了讓 AI 協助執行。

- 環境準備、安裝依賴、建立 `.env` 這類固定命令，通常可以交給 AI 協助。
- 日常啟動、測試確認、實際操作 Android Studio 這類步驟，應由開發者自己執行。
- 如果不確定該看哪份文件，先從 `README.md` 的文件入口開始。

## 4. Commit 規範

請使用清楚、可追蹤的 commit 訊息，建議採用以下格式：

```text
<type>: <summary>
```

常用 `type`：

- `feat`：新增功能
- `fix`：修正問題
- `docs`：文件更新
- `refactor`：重構
- `chore`：例行維護或設定調整

範例：

```text
feat: add local sqlite repository for mobile app
fix: correct postgres port in server env example
docs: update android studio setup guide
```

## 5. Git 使用規範

請遵守以下基本規範：

- 開工前先同步最新主線內容，再開始修改。
- 請在自己的功能分支上開發，不直接在主要分支上累積大型變更。
- 分支名稱應清楚反映目的，例如 `feature/mobile-health-check`、`fix/server-db-config`。
- 提交前先自行檢查變更內容，確認沒有不必要的檔案、暫存輸出或敏感資訊。
- 發出合併請求前，整理 commit，讓歷史可讀。

## 6. 提交前檢查

送出前至少確認以下幾點：

- 變更內容與目的相符。
- 文件有同步更新。
- 環境設定檔沒有提交敏感資訊。
- Commit 訊息與分支名稱可讀且一致。

如果後續專案補上 hook、CI 或更細的開發流程，再一起擴充這份文件。
