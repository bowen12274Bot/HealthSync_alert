import type {
  ActivityLevelProvider,
  GenerationContext,
  ScenarioDelta,
  ScenarioProvider,
  SimulationScript,
  SimulationSegment,
} from '../types'

let scenarioProvider: ScenarioProvider | null = null
let activityLevelProvider: ActivityLevelProvider = () => 0
let activeScript: SimulationScript | null = null
let scriptStartedAtMs = 0
let consumedPointOverrideKey: string | null = null

const ZERO_DELTA: ScenarioDelta = {
  hrDelta: 0,
  hrvDelta: 0,
  spO2Delta: 0,
}

export function setScenarioProvider(provider: ScenarioProvider | null): void {
  scenarioProvider = provider
}

export function setActivityLevelProvider(provider: ActivityLevelProvider | null): void {
  activityLevelProvider = provider ?? (() => 0)
}

export function setActiveScript(script: SimulationScript | null): void {
  activeScript = script
  scriptStartedAtMs = Date.now()
  consumedPointOverrideKey = null

  if (script) {
    activityLevelProvider = () => script.initialActivityLevel
    scenarioProvider = null
  }
}

function getSegmentAtElapsed(
  script: SimulationScript,
  elapsedSec: number,
): {
  segment: SimulationSegment
  segmentIndex: number
  loopIndex: number
} {
  const totalDuration = script.segments.reduce((sum, segment) => sum + segment.durationSec, 0)
  const loopedElapsed = totalDuration > 0 ? elapsedSec % totalDuration : 0
  const loopIndex = totalDuration > 0 ? Math.floor(elapsedSec / totalDuration) : 0
  let cursor = 0

  for (const [segmentIndex, segment] of script.segments.entries()) {
    cursor += segment.durationSec

    if (loopedElapsed < cursor) {
      return { segment, segmentIndex, loopIndex }
    }
  }

  const segmentIndex = script.segments.length - 1
  return {
    segment: script.segments[segmentIndex] ?? script.segments[0],
    segmentIndex,
    loopIndex,
  }
}

export function getGenerationContext(): GenerationContext {
  if (activeScript) {
    const elapsedSec = (Date.now() - scriptStartedAtMs) / 1000
    const { segment, segmentIndex, loopIndex } = getSegmentAtElapsed(activeScript, elapsedSec)
    const pointOverrideKey = `${activeScript.id}:${loopIndex}:${segmentIndex}`
    const pointOverride =
      segment.pointOverride && consumedPointOverrideKey !== pointOverrideKey
        ? segment.pointOverride
        : null

    if (pointOverride) {
      consumedPointOverrideKey = pointOverrideKey
    }

    return {
      activityLevel: segment.activityLevel,
      scenarioDelta: {
        hrDelta: segment.hrDelta,
        hrvDelta: segment.hrvDelta,
        spO2Delta: segment.spO2Delta,
      },
      pointOverride,
    }
  }

  return {
    activityLevel: activityLevelProvider(),
    scenarioDelta: ZERO_DELTA,
    pointOverride: scenarioProvider?.() ?? null,
  }
}
