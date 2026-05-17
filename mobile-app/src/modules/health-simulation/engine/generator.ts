import type { ActivityLevel, GenerationContext, RawHealthRecord } from '../types'

// ─── 生理參數常數 ────────────────────────────────────────────────────────────

const ACTIVITY_BASELINE_PROFILE: Record<
  ActivityLevel,
  {
    targetHeartRate: number
    targetHrv: number
    targetSpO2: number
  }
> = {
  0: { targetHeartRate: 72, targetHrv: 55, targetSpO2: 97 },
  1: { targetHeartRate: 90, targetHrv: 45, targetSpO2: 97 },
  2: { targetHeartRate: 115, targetHrv: 35, targetSpO2: 96 },
  3: { targetHeartRate: 145, targetHrv: 25, targetSpO2: 96 },
}

const HR_ADAPT_RATE = 0.28
const HRV_ADAPT_RATE = 0.24
const SPO2_ADAPT_RATE = 0.18
const HR_NOISE_STD = 1.2
const HRV_NOISE_STD = 1.6
const SPO2_NOISE_STD = 0.18

interface GeneratorState {
  heartRate: number
  hrv: number
  spO2: number
  activityLevel: ActivityLevel
}

let currentState: GeneratorState | null = null

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

function roundToOneDecimal(value: number): number {
  return parseFloat(value.toFixed(1))
}

// ─── 各數值生成函式 ───────────────────────────────────────────────────────────

function getInitialState(activityLevel: ActivityLevel): GeneratorState {
  const target = ACTIVITY_BASELINE_PROFILE[activityLevel]

  return {
    heartRate: target.targetHeartRate,
    hrv: target.targetHrv,
    spO2: target.targetSpO2,
    activityLevel,
  }
}

function getWave(timestampMs: number, periodMs: number, amplitude: number): number {
  return Math.sin((timestampMs / periodMs) * 2 * Math.PI) * amplitude
}

function advanceState(context: GenerationContext, now: Date): GeneratorState {
  if (currentState === null) {
    currentState = getInitialState(context.activityLevel)
  }

  const target = ACTIVITY_BASELINE_PROFILE[context.activityLevel]
  const nowMs = now.getTime()

  const nextHeartRate = clamp(
    currentState.heartRate
      + (target.targetHeartRate - currentState.heartRate) * HR_ADAPT_RATE
      + context.scenarioDelta.hrDelta
      + getWave(nowMs, 30_000, 0.8)
      + gaussianNoise(0, HR_NOISE_STD),
    40,
    180,
  )
  const nextHrv = clamp(
    currentState.hrv
      + (target.targetHrv - currentState.hrv) * HRV_ADAPT_RATE
      + context.scenarioDelta.hrvDelta
      + getWave(nowMs, 35_000, 0.8)
      + gaussianNoise(0, HRV_NOISE_STD),
    5,
    120,
  )
  const nextSpO2 = clamp(
    currentState.spO2
      + (target.targetSpO2 - currentState.spO2) * SPO2_ADAPT_RATE
      + context.scenarioDelta.spO2Delta
      + getWave(nowMs, 45_000, 0.08)
      + gaussianNoise(0, SPO2_NOISE_STD),
    85,
    100,
  )

  currentState = {
    heartRate: context.pointOverride?.heartRateOverride ?? Math.round(nextHeartRate),
    hrv: context.pointOverride?.hrvOverride ?? Math.round(nextHrv),
    spO2: context.pointOverride?.spO2Override ?? roundToOneDecimal(nextSpO2),
    activityLevel: context.activityLevel,
  }

  return currentState
}

export function resetHealthGenerator(activityLevel: ActivityLevel): void {
  currentState = getInitialState(activityLevel)
}

/**
 * 生成一筆即時健康資料。
 * 生成器會保留 current_state，使劇本能逐筆推動資料趨勢。
 */
export function generateHealthRecord(context: GenerationContext): RawHealthRecord {
  const now = new Date()
  const state = advanceState(context, now)

  return {
    id: crypto.randomUUID(),
    heartRate: state.heartRate,
    hrv: state.hrv,
    spO2: state.spO2,
    activityLevel: state.activityLevel,
    recordedAt: now.toISOString(),
  }
}
