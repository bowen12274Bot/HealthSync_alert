import type {
  ActivityBaselineProfile,
  AnalysisStage,
  RealtimeHealthRecord,
  RiskScoreResult,
  WindowMetrics,
} from './types'

function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sum = values.reduce((total, value) => total + value, 0)
  return sum / values.length
}

function calculateStd(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const mean = calculateMean(values)
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length

  return Math.sqrt(variance)
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) {
    return 0
  }

  const firstValue = values[0]
  const lastValue = values.at(-1)

  if (firstValue === undefined || lastValue === undefined) {
    return 0
  }

  return lastValue - firstValue
}

export function calculateWindowMetrics(records: RealtimeHealthRecord[]): WindowMetrics | null {
  if (records.length === 0) {
    return null
  }

  const heartRateValues = records.map((record) => record.heartRate)
  const hrvValues = records.map((record) => record.hrv)
  const spO2Values = records.map((record) => record.spO2)

  return {
    sampleCount: records.length,

    hrMean: calculateMean(heartRateValues),
    hrStd: calculateStd(heartRateValues),
    hrTrend: calculateTrend(heartRateValues),

    hrvMean: calculateMean(hrvValues),
    hrvStd: calculateStd(hrvValues),
    hrvTrend: calculateTrend(hrvValues),

    spO2Mean: calculateMean(spO2Values),
    spO2Std: calculateStd(spO2Values),
    spO2Trend: calculateTrend(spO2Values),
  }
}

function getSpO2LowScore(metrics: WindowMetrics): RiskScoreResult {
  if (metrics.spO2Mean < 92) {
    return {
      riskScore: 3,
      triggerReasons: ['SpO2 最近視窗平均低於安全範圍'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getSpO2DropScore(metrics: WindowMetrics): RiskScoreResult {
  if (metrics.spO2Trend <= -3) {
    return {
      riskScore: 2,
      triggerReasons: ['SpO2 最近視窗明顯下降'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getHrTrendScore(metrics: WindowMetrics): RiskScoreResult {
  if (metrics.hrTrend >= 15) {
    return {
      riskScore: 1,
      triggerReasons: ['HR 最近視窗明顯上升'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getHrvTrendScore(metrics: WindowMetrics): RiskScoreResult {
  if (metrics.hrvTrend <= -20) {
    return {
      riskScore: 1,
      triggerReasons: ['HRV 最近視窗明顯下降'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getHrDeviationScore(
  metrics: WindowMetrics,
  baseline: ActivityBaselineProfile,
): RiskScoreResult {
  if (metrics.hrMean > baseline.targetHr) {
    return {
      riskScore: 1,
      triggerReasons: ['HR 平均值高於活動基準'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getHrvDeviationScore(
  metrics: WindowMetrics,
  baseline: ActivityBaselineProfile,
): RiskScoreResult {
  if (metrics.hrvMean < baseline.targetHrv) {
    return {
      riskScore: 1,
      triggerReasons: ['HRV 平均值低於活動基準'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function getCombinedDeteriorationScore(metrics: WindowMetrics): RiskScoreResult {
  const hasHrIncrease = metrics.hrTrend >= 15
  const hasHrvDecrease = metrics.hrvTrend <= -20
  const hasSpO2Drop = metrics.spO2Trend <= -3

  if (hasHrIncrease && hasHrvDecrease && hasSpO2Drop) {
    return {
      riskScore: 3,
      triggerReasons: ['HR、HRV、SpO2 同時惡化'],
    }
  }

  return {
    riskScore: 0,
    triggerReasons: [],
  }
}

function mergeRiskScoreResults(results: RiskScoreResult[]): RiskScoreResult {
  return results.reduce<RiskScoreResult>(
    (accumulator, result) => ({
      riskScore: accumulator.riskScore + result.riskScore,
      triggerReasons: [...accumulator.triggerReasons, ...result.triggerReasons],
    }),
    {
      riskScore: 0,
      triggerReasons: [],
    },
  )
}

function calculatePartialRiskScore(metrics: WindowMetrics): RiskScoreResult {
  return mergeRiskScoreResults([
    getSpO2LowScore(metrics),
    getSpO2DropScore(metrics),
  ])
}

function calculateFullRiskScore(
  metrics: WindowMetrics,
  baseline: ActivityBaselineProfile,
): RiskScoreResult {
  return mergeRiskScoreResults([
    getSpO2LowScore(metrics),
    getSpO2DropScore(metrics),
    getHrTrendScore(metrics),
    getHrvTrendScore(metrics),
    getHrDeviationScore(metrics, baseline),
    getHrvDeviationScore(metrics, baseline),
    getCombinedDeteriorationScore(metrics),
  ])
}

export function calculateRiskScore(
  analysisStage: AnalysisStage,
  metrics: WindowMetrics | null,
  baseline: ActivityBaselineProfile | null,
): RiskScoreResult {
  if (analysisStage === 'warming_up' || metrics === null) {
    return {
      riskScore: 0,
      triggerReasons: [],
    }
  }

  if (analysisStage === 'partial_analysis') {
    return calculatePartialRiskScore(metrics)
  }

  if (baseline === null) {
    return {
      riskScore: 0,
      triggerReasons: [],
    }
  }

  return calculateFullRiskScore(metrics, baseline)
}

export {
  calculateMean,
  calculateStd,
  calculateTrend,
}
