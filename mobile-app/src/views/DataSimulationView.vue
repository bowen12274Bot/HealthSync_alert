<script setup lang="ts">
import { computed } from 'vue'

import AppShell from '@/components/AppShell.vue'
import {
  pauseSimulation,
  startSimulationScenario,
  useSimulationControl,
  type SimulationScenarioId,
} from '@/composables/useSimulationControl'

const { currentScenarioId, isRunning, scenarios } = useSimulationControl()

const scenarioItems = computed(() =>
  scenarios.map((scenario) => ({
    ...scenario,
    isActive: isRunning.value && currentScenarioId.value === scenario.id,
  })),
)

function toggleScenario(id: SimulationScenarioId): void {
  if (isRunning.value && currentScenarioId.value === id) {
    pauseSimulation()
    return
  }

  startSimulationScenario(id)
}
</script>

<template>
  <AppShell title="資料模擬" :show-profile-shortcut="true">
    <section class="simulation-layout">
      <article v-for="scenario in scenarioItems" :key="scenario.id" class="simulation-card">
        <strong>{{ scenario.name }}</strong>
        <button class="scenario-action" type="button" @click="toggleScenario(scenario.id)">
          {{ scenario.isActive ? '暫停' : '啟動' }}
        </button>
      </article>
    </section>
  </AppShell>
</template>

<style scoped>
.simulation-layout {
  display: grid;
  gap: 18px;
}

.simulation-card {
  border-radius: 24px;
  padding: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background:
    radial-gradient(circle at top right, rgba(55, 116, 216, 0.16), transparent 32%),
    rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 40px rgba(35, 63, 103, 0.1);
}

.simulation-card strong {
  color: #163250;
  font-size: 1rem;
}

.scenario-action {
  border: 0;
  border-radius: 999px;
  padding: 10px 18px;
  min-width: 88px;
  background: linear-gradient(180deg, #3374d8 0%, #2356ac 100%);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;
}

.scenario-action:hover,
.scenario-action:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(35, 86, 172, 0.24);
}

.scenario-action:focus-visible {
  outline: 2px solid #8ab0ef;
  outline-offset: 2px;
}
</style>
