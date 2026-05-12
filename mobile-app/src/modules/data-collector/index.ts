/**
 * data-collector 模組
 *
 * 負責模擬智慧穿戴裝置，在本地端持續生成即時健康資料（HR / HRV / SpO2），
 * 並每 5 秒寫入本地 SQLite 資料庫。
 *
 * 基本用法：
 * ```ts
 * import { startDataGeneration, stopDataGeneration } from '@/modules/data-collector'
 *
 * // App 啟動時開始生成
 * startDataGeneration()
 *
 * // App 關閉或背景時停止
 * stopDataGeneration()
 * ```
 *
 * 未來注入異常劇本：
 * ```ts
 * import { setScenarioProvider } from '@/modules/data-collector'
 *
 * // 模擬低血氧情境
 * setScenarioProvider(() => ({ spO2Override: 82 }))
 *
 * // 清除，恢復正常模式
 * setScenarioProvider(null)
 * ```
 */

export {
  startScheduler as startDataGeneration,
  stopScheduler as stopDataGeneration,
  isSchedulerRunning as isDataGenerationRunning,
} from './schedule'

export { setScenarioProvider } from './generator'

export type { RawHealthRecord, ScenarioOverride, ScenarioProvider, SyncStatus } from './types'
