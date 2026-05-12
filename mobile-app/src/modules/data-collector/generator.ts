import type { RawHealthRecord, ScenarioProvider } from './types'

// ─── 生理參數常數 ────────────────────────────────────────────────────────────

/** 白天平均心率基準（bpm） */
const HR_MEAN_DAY = 75
/** 夜間平均心率基準（bpm） */
const HR_MEAN_NIGHT = 58
/** 心率隨機雜訊標準差（bpm） */
const HR_NOISE_STD = 4

/** 白天平均 HRV 基準（ms），與心率反相關 */
const HRV_MEAN_DAY = 38
/** 夜間平均 HRV 基準（ms） */
const HRV_MEAN_NIGHT = 62
/** HRV 隨機雜訊標準差（ms） */
const HRV_NOISE_STD = 8

/** 血氧平均值（%） */
const SPO2_MEAN = 98.2
/** 血氧隨機雜訊標準差（%） */
const SPO2_NOISE_STD = 0.5

// ─── 數學工具函式 ────────────────────────────────────────────────────────────

/**
 * Box-Muller 轉換產生高斯雜訊（常態分佈）。
 * 使得生成數值有自然的隨機起伏，而非均勻分佈。
 */
function gaussianNoise(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z0 * stdDev
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 計算日夜節律相位（circadian phase）。
 *
 * 以凌晨 4 點為一天的谷底（trough），下午 4 點為高峰（peak），
 * 相位範圍：0 ~ 2π，供正弦波計算使用。
 */
function getCircadianPhase(date: Date): number {
  const totalMinutes = date.getHours() * 60 + date.getMinutes()
  const troughMinutes = 4 * 60 // 凌晨 4 點為最低點
  const minutesSinceTrough = (totalMinutes - troughMinutes + 1440) % 1440
  return (minutesSinceTrough / 1440) * 2 * Math.PI
}

// ─── 各數值生成函式 ───────────────────────────────────────────────────────────

/**
 * 根據日夜節律相位生成心率。
 * 白天較高、夜間較低，並疊加高斯雜訊使數值自然變動。
 */
function generateHeartRate(phase: number): number {
  const midMean = (HR_MEAN_DAY + HR_MEAN_NIGHT) / 2
  const amplitude = (HR_MEAN_DAY - HR_MEAN_NIGHT) / 2
  // 使用 sin(phase - π/2) 使凌晨 4 點為谷底、下午 4 點為高峰
  const baseline = midMean + amplitude * Math.sin(phase - Math.PI / 2)
  const raw = gaussianNoise(baseline, HR_NOISE_STD)
  return Math.round(clamp(raw, 40, 180))
}

/**
 * 根據當下心率生成 HRV。
 * HRV 與心率呈反相關：心率越高，HRV 越低。
 */
function generateHRV(heartRate: number): number {
  // 將心率正規化到 0~1，對應 HRV 從高到低
  const hrNormalized = (heartRate - 40) / (180 - 40)
  const baseMean = HRV_MEAN_NIGHT + (HRV_MEAN_DAY - HRV_MEAN_NIGHT) * hrNormalized
  const raw = gaussianNoise(baseMean, HRV_NOISE_STD)
  return Math.round(clamp(raw, 5, 120))
}

/**
 * 生成血氧濃度。
 * 正常情況下數值穩定在高點，加入微小雜訊模擬感測器誤差。
 */
function generateSpO2(): number {
  const raw = gaussianNoise(SPO2_MEAN, SPO2_NOISE_STD)
  return parseFloat(clamp(raw, 85, 100).toFixed(1))
}

// ─── 情境提供者（可選，供未來劇本擴充） ──────────────────────────────────────

let scenarioProvider: ScenarioProvider | null = null

/**
 * 設定情境提供者。
 * 傳入 null 可清除，回到正常時間模式生成。
 *
 * @example
 * // 注入低血氧情境
 * setScenarioProvider(() => ({ spO2Override: 82 }))
 *
 * // 清除情境，恢復正常
 * setScenarioProvider(null)
 */
export function setScenarioProvider(provider: ScenarioProvider | null): void {
  scenarioProvider = provider
}

// ─── 主要生成函式 ─────────────────────────────────────────────────────────────

/**
 * 生成一筆即時健康資料。
 * 情境提供者存在時，以其回傳值覆蓋對應欄位。
 */
export function generateHealthRecord(): RawHealthRecord {
  const now = new Date()
  const phase = getCircadianPhase(now)
  const scenario = scenarioProvider?.() ?? null

  const heartRate = scenario?.heartRateOverride ?? generateHeartRate(phase)
  const hrv = scenario?.hrvOverride ?? generateHRV(heartRate)
  const spO2 = scenario?.spO2Override ?? generateSpO2()

  return {
    id: crypto.randomUUID(),
    heartRate,
    hrv,
    spO2,
    recordedAt: now.toISOString(),
    syncStatus: 'unsynced',
  }
}
