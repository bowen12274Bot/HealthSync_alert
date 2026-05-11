# Setup Guide

## 1. 這份文件在說什麼

這份文件用來說明 `docs/setup/` 下面各份文件的用途，幫助組員快速判斷應該先看哪一份。

## 2. 先怎麼理解這三份文件

這三份文件不是三套完全分開的開發方式。

以專案架構來說，平常主要還是分成兩個部分：

- `mobile-app`：手機端與前端開發
- `server`：後端與資料庫連線

因為 Android 模擬器與手機測試環境相對麻煩，值得獨立整理，所以另外拆出 `android-studio-setup.md`。

## 3. 一般開發怎麼開始

一般開發時，通常會先以網頁模式為主，因為速度比較快，也比較容易快速看到前端畫面與互動結果。

建議先看：

- `docs/setup/mobile-app-setup.md`
- `docs/setup/server-setup.md`

這兩份通常就足夠支撐日常開發。

## 4. 什麼時候需要 Android 模擬器

如果只是一般畫面調整、流程確認或前後端串接，通常先用網頁模式就可以。

但如果要確認下面這些情況，就需要進入 Android 模擬器或手機測試環境：

- 手機端實際執行結果
- Android 環境相關行為
- 和實際資料庫、手機執行環境更接近的測試

這時再看：

- `docs/setup/android-studio-setup.md`

## 5. 建議閱讀順序

建議先用下面順序開始：

1. 先看 `docs/architecture.md`，了解系統整體分工。
2. 進行一般開發時，先看 `docs/setup/mobile-app-setup.md` 與 `docs/setup/server-setup.md`。
3. 需要 Android 模擬器或手機環境測試時，再看 `docs/setup/android-studio-setup.md`。

## 6. 使用方式

這個資料夾下的文件大致分成兩類：

- 準備步驟：通常可以交給 AI 協助執行
- 日常使用流程：通常由開發者自己操作

如果不確定現在該做哪一步，可以先把目前目標描述給 AI，請 AI 引導你使用對應文件。
