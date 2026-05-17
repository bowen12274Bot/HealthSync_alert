import {
  isSchedulerRunning,
  startScheduler,
  stopScheduler,
} from './engine/schedule'
import { resetHealthGenerator, setActivityBaselineProfiles } from './engine/generator'
import {
  setActiveScript,
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
  setActiveScript,
  setActivityLevelProvider,
  setScenarioProvider,
  resetHealthGenerator,
  setActivityBaselineProfiles,
} as const

export const simulationScenarios = {
  all: definedSimulationScenarios,
  defaultScenarioId: DEFAULT_SCENARIO_ID,
  findById: findSimulationScenario,
} as const

export type {
  ActivityBaselineProfile,
  ActivityLevel,
  ActivityLevelProvider,
  GenerationContext,
  RawHealthRecord,
  ScenarioOverride,
  ScenarioProvider,
  ScenarioDelta,
  SimulationScript,
  SimulationSegment,
} from './types'

export type { SimulationScenario, SimulationScenarioId } from './scenarios'
