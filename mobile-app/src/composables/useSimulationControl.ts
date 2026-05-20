import { computed, readonly, ref } from 'vue'

import {
  simulationRuntime,
  simulationScenarios,
  simulationScheduler,
  type SimulationScenarioId,
} from '@/modules/health-simulation'

export type { SimulationScenarioId } from '@/modules/health-simulation'

const currentScenarioId = ref<SimulationScenarioId | null>(null)
const isRunning = ref(false)

function applyScenario(id: SimulationScenarioId): void {
  const scenario = simulationScenarios.findById(id)
  currentScenarioId.value = scenario.id
  simulationRuntime.setActiveScript(scenario)
  simulationRuntime.resetHealthGenerator(scenario.initialActivityLevel)
}

export function startSimulationScenario(id: SimulationScenarioId): void {
  applyScenario(id)
  simulationScheduler.startDataGeneration()
  isRunning.value = simulationScheduler.isDataGenerationRunning()
}

export function pauseSimulation(): void {
  simulationScheduler.stopDataGeneration()
  isRunning.value = false
  simulationRuntime.setActiveScript(null)
}

export function ensureDefaultSimulationScenario(): void {
  if (currentScenarioId.value !== null) {
    return
  }

  startSimulationScenario(simulationScenarios.defaultScenarioId)
}

export function useSimulationControl() {
  const currentScenario = computed(() =>
    currentScenarioId.value === null ? null : simulationScenarios.findById(currentScenarioId.value),
  )
  const currentScenarioName = computed(() =>
    isRunning.value && currentScenario.value ? currentScenario.value.name : '無',
  )
  const simulationStatusText = computed(() => (isRunning.value ? '劇本執行中' : '無執行劇本'))

  return {
    scenarios: readonly(simulationScenarios.all),
    currentScenarioId: readonly(currentScenarioId),
    currentScenarioName,
    isRunning: readonly(isRunning),
    simulationStatusText,
    startSimulationScenario,
    pauseSimulation,
  }
}
