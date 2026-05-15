import type { ActivityLevel } from './types'

export type SimulationScenarioId = 'normal-rest' | 'normal-exercise'

export interface SimulationScenario {
  id: SimulationScenarioId
  name: string
  activityLevel: ActivityLevel
}

export const DEFAULT_SCENARIO_ID: SimulationScenarioId = 'normal-rest'

export const simulationScenarios: readonly SimulationScenario[] = [
  { id: 'normal-rest', name: '正常休息', activityLevel: 0 },
  { id: 'normal-exercise', name: '正常運動', activityLevel: 2 },
]

export function findSimulationScenario(id: SimulationScenarioId): SimulationScenario {
  const scenario = simulationScenarios.find((item) => item.id === id)

  if (!scenario) {
    throw new Error(`Unknown simulation scenario: ${id}`)
  }

  return scenario
}
