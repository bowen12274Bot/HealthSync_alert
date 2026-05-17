import type { SimulationScript } from './types'

export type SimulationScenarioId =
  | 'normal-rest'
  | 'normal-exercise'
  | 'low-activity-stress'
  | 'spo2-risk'
  | 'single-spike-noise'

export type SimulationScenario = SimulationScript & { id: SimulationScenarioId }

export const DEFAULT_SCENARIO_ID: SimulationScenarioId = 'normal-rest'

export const simulationScenarios: readonly SimulationScenario[] = [
  {
    id: 'normal-rest',
    name: '正常休息',
    initialActivityLevel: 0,
    segments: [
      { name: '穩定休息', durationSec: 120, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
    ],
  },
  {
    id: 'normal-exercise',
    name: '正常運動',
    initialActivityLevel: 0,
    segments: [
      { name: '休息暖身', durationSec: 30, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
      { name: '活動上升', durationSec: 70, activityLevel: 2, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
      { name: '緩和恢復', durationSec: 50, activityLevel: 1, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
    ],
  },
  {
    id: 'low-activity-stress',
    name: '低活動生理壓力',
    initialActivityLevel: 0,
    segments: [
      { name: '穩定休息', durationSec: 30, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
      { name: '壓力累積', durationSec: 60, activityLevel: 0, hrDelta: 4.2, hrvDelta: -3.0, spO2Delta: 0 },
      { name: '壓力維持', durationSec: 40, activityLevel: 0, hrDelta: 2.8, hrvDelta: -2.0, spO2Delta: 0 },
      { name: '恢復', durationSec: 50, activityLevel: 0, hrDelta: -2.0, hrvDelta: 2.2, spO2Delta: 0 },
    ],
  },
  {
    id: 'spo2-risk',
    name: '血氧下降風險',
    initialActivityLevel: 0,
    segments: [
      { name: '穩定休息', durationSec: 30, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
      { name: '輕度惡化', durationSec: 40, activityLevel: 0, hrDelta: 3.0, hrvDelta: -2.4, spO2Delta: -0.45 },
      { name: '血氧持續下降', durationSec: 50, activityLevel: 0, hrDelta: 4.2, hrvDelta: -3.2, spO2Delta: -1.2 },
      { name: '恢復', durationSec: 50, activityLevel: 0, hrDelta: -2.0, hrvDelta: 2.4, spO2Delta: 0.9 },
    ],
  },
  {
    id: 'single-spike-noise',
    name: '單點雜訊',
    initialActivityLevel: 0,
    segments: [
      { name: '穩定休息', durationSec: 30, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
      {
        name: '單筆血氧雜訊',
        durationSec: 10,
        activityLevel: 0,
        hrDelta: 0,
        hrvDelta: 0,
        spO2Delta: 0,
        pointOverride: { spO2Override: 86 },
      },
      { name: '立即恢復', durationSec: 60, activityLevel: 0, hrDelta: 0, hrvDelta: 0, spO2Delta: 0 },
    ],
  },
]

export function findSimulationScenario(id: SimulationScenarioId): SimulationScenario {
  const scenario = simulationScenarios.find((item) => item.id === id)

  if (!scenario) {
    throw new Error(`Unknown simulation scenario: ${id}`)
  }

  return scenario
}
