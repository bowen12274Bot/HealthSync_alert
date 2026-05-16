import type { ActivityLevelProvider, GenerationContext, ScenarioProvider } from '../types'

let scenarioProvider: ScenarioProvider | null = null
let activityLevelProvider: ActivityLevelProvider = () => 0

export function setScenarioProvider(provider: ScenarioProvider | null): void {
  scenarioProvider = provider
}

export function setActivityLevelProvider(provider: ActivityLevelProvider | null): void {
  activityLevelProvider = provider ?? (() => 0)
}

export function getGenerationContext(): GenerationContext {
  return {
    activityLevel: activityLevelProvider(),
    scenarioOverride: scenarioProvider?.() ?? null,
  }
}
