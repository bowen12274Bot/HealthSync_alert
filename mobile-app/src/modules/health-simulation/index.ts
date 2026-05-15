import {
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
} from './engine/schedule'
import {
  setActivityLevelProvider,
  setScenarioProvider,
} from './engine/runtime'
import {
  DEFAULT_SCENARIO_ID,
  findSimulationScenario,
  simulationScenarios as definedSimulationScenarios,
} from './scenarios'

/**
 * health-simulation 模組
 *
 * 對外 API 依責任分成三組：
 * - simulationScheduler: 控制資料生成排程
 * - simulationRuntime: 控制執行時上下文
 * - simulationScenarios: 讀取靜態劇本定義
 */
export const simulationScheduler = {
  startDataGeneration: startScheduler,
  stopDataGeneration: stopScheduler,
  isDataGenerationRunning: isSchedulerRunning,
} as const

export const simulationRuntime = {
  setActivityLevelProvider,
  setScenarioProvider,
} as const

export const simulationScenarios = {
  all: definedSimulationScenarios,
  defaultScenarioId: DEFAULT_SCENARIO_ID,
  findById: findSimulationScenario,
} as const

export type {
  ActivityLevel,
  ActivityLevelProvider,
  GenerationContext,
  RawHealthRecord,
  ScenarioOverride,
  ScenarioProvider,
  SyncStatus,
} from './types'

export type { SimulationScenario, SimulationScenarioId } from './scenarios'
