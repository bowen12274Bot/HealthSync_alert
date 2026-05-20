import type { ActivityBaselineProfile, ActivityLevel } from './types'

const activityBaselineProfiles: readonly ActivityBaselineProfile[] = [
  { activityLevel: 0, targetHr: 72, targetHrv: 55, targetSpO2: 97 },
  { activityLevel: 1, targetHr: 90, targetHrv: 45, targetSpO2: 97 },
  { activityLevel: 2, targetHr: 115, targetHrv: 35, targetSpO2: 96 },
  { activityLevel: 3, targetHr: 145, targetHrv: 25, targetSpO2: 96 },
]

export function getActivityBaselineProfile(
  activityLevel: ActivityLevel,
): ActivityBaselineProfile | null {
  return activityBaselineProfiles.find((profile) => profile.activityLevel === activityLevel) ?? null
}

export function listActivityBaselineProfiles(): readonly ActivityBaselineProfile[] {
  return activityBaselineProfiles
}
