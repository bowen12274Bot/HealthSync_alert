export type ActivityLevel = 0 | 1 | 2 | 3

export interface RawHealthRecord {
  /** UUID，作為主鍵 */
  id: string
  /** 心率，單位：bpm */
  heartRate: number
  /** 心率變異（RMSSD），單位：ms */
  hrv: number
  /** 血氧濃度，單位：% */
  spO2: number
  /** 活動等級，由劇本或執行中的模擬上下文提供 */
  activityLevel: ActivityLevel
  /** 紀錄時間，ISO 8601 格式 */
  recordedAt: string
}

export interface GenerationContext {
  activityLevel: ActivityLevel
  scenarioOverride: ScenarioOverride | null
}

/**
 * 情境覆蓋介面，用於未來注入異常劇本。
 * 提供的欄位將直接覆蓋時間模式生成的數值。
 */
export interface ScenarioOverride {
  heartRateOverride?: number
  hrvOverride?: number
  spO2Override?: number
}

/**
 * 情境提供者函式型別。
 * 回傳 null 表示使用正常時間模式；回傳 ScenarioOverride 則覆蓋指定欄位。
 */
export type ScenarioProvider = () => ScenarioOverride | null
export type ActivityLevelProvider = () => ActivityLevel
