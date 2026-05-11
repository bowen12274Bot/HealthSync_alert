# Mobile App Setup

## 1. 這份文件在說什麼

這份文件用來說明手機端開發環境怎麼準備，以及平常怎麼啟動本專案的手機端部分。

如果之後需要 Android 模擬器、原生設定或 Android 測試，再接著看 `docs/setup/android-studio-setup.md`。

## 2. 概念

`mobile-app/` 是平常手機端開發的主要位置。

可以先把它理解成：使用者會看到、會操作的那一側，大多數手機端日常開發都從這裡開始。

## 3. 前置需求

開始前請先安裝：

- Node.js
- npm

## 4. 手機端準備步驟

第一次準備手機端環境時，通常先做下面這些事。這一段適合交給 AI 幫忙執行：

```powershell
cd mobile-app
npm install
Copy-Item .env.example .env
```

如果需要調整 API 連線位置，再修改 `.env` 內的設定即可。

## 5. 日常使用流程

日常需要進行手機端開發或檢查時，可先在 `mobile-app/` 啟動專案：

```powershell
cd mobile-app
npm run dev
```

如果之後需要進一步做 Android 測試，再接著進入 Android Studio 流程即可。
