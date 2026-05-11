# Android Studio Setup

## 1. 這份文件在說什麼

這份文件用來說明 Android Studio 環境怎麼準備，以及之後要怎麼打開本專案的 Android 部分。

如果只是一般前端畫面或 API 開發，平常多半先看 `docs/setup/mobile-app-setup.md` 即可；需要 Android 模擬器、原生設定或 Android 測試時，再看這份文件。

## 2. 概念

`mobile-app/` 是平常手機端開發的主要位置，Android Studio 則是在需要進入 Android 執行環境時才會用到。

可以先把它理解成：前端開發主要在 `mobile-app/`，Android Studio 則是用來打開 Android 那一側的專案。

## 3. 前置需求

開始前請先安裝：

- Node.js
- npm
- Android Studio

## 4. Android Studio 安裝步驟

### 4.1 下載 Android Studio

到 Android Studio 官方網站下載安裝程式，安裝時以預設選項為主即可。

### 4.2 第一次啟動 Android Studio

第一次開啟時，先跟著初始化流程完成設定，並安裝建議元件。

如果安裝過程中出現 SDK 或模擬器相關選項，建議一併安裝。

### 4.3 打開專案

完成第一次啟動後，就可以直接打開本專案的 Android 資料夾：

```text
mobile-app/android
```

後續在 Android Studio 內的操作，都會以這個資料夾作為基礎。

### 4.4 安裝 Android SDK

進入 Android Studio 後，可在 SDK Manager 確認 Android SDK 是否已安裝。

至少準備一個可用的 Android 版本，讓專案可以正常同步與執行。

### 4.5 建立 Android Emulator

進入右側的 Device Manager，建立至少一台 Android Emulator。建議先使用 `Pixel 7 API 35`，通常會比較穩定。

建立完成後先啟動 Emulator，再到 Running Devices 確認模擬器是否可以正常運作。

## 5. 日常使用流程

日常需要進行 Android 測試或檢查時，可先在 `mobile-app/` 執行標準指令，把前端輸出與 Android 專案同步好：

```powershell
cd mobile-app
npm run build
npx cap sync android
```

完成後，再由開發者自己進入 Android Studio 操作，不交給 AI 代操：

1. 開啟 Android Studio
2. 打開 `mobile-app/android`
3. 啟動模擬器或接上實機
4. 進行 Android 端測試

如果 Android Studio 有自動進行同步或跳出相關提示等問題，再依畫面詢問 AI 處理即可。
