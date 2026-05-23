<script setup lang="ts">
import { computed } from 'vue'

type TrendTone = 'heart' | 'spo2' | 'hrv'

type TrendPoint = {
  timestamp: string
  value: number | null
}

const props = defineProps<{
  points: TrendPoint[]
  tone: TrendTone
}>()

const WIDTH = 320
const HEIGHT = 132
const PAD_TOP = 16
const PAD_RIGHT = 12
const PAD_BOTTOM = 28
const PAD_LEFT = 30
const GRID_COUNT = 3

const tonePalette: Record<TrendTone, { line: string; fill: string; point: string }> = {
  heart: {
    line: '#f06c63',
    fill: 'rgba(240, 108, 99, 0.12)',
    point: '#f37b72',
  },
  spo2: {
    line: '#4a84ea',
    fill: 'rgba(74, 132, 234, 0.12)',
    point: '#5a91f0',
  },
  hrv: {
    line: '#49b26a',
    fill: 'rgba(73, 178, 106, 0.12)',
    point: '#58bc76',
  },
}

const validPoints = computed(
  () => props.points.filter((point): point is { timestamp: string; value: number } => point.value !== null),
)

const axis = computed(() => {
  if (!validPoints.value.length) {
    return { min: 0, max: 100, step: 50 }
  }

  const values = validPoints.value.map((point) => point.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  if (rawMin === rawMax) {
    const base = rawMin === 0 ? 10 : Math.max(1, Math.abs(rawMin) * 0.1)
    return {
      min: rawMin - base,
      max: rawMax + base,
      step: ((rawMax + base) - (rawMin - base)) / (GRID_COUNT - 1),
    }
  }

  const padding = Math.max((rawMax - rawMin) * 0.28, 2)
  const min = Math.max(0, rawMin - padding)
  const max = rawMax + padding
  return {
    min,
    max,
    step: (max - min) / (GRID_COUNT - 1),
  }
})

const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT
const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM

function xForIndex(index: number): number {
  const count = Math.max(props.points.length - 1, 1)
  return PAD_LEFT + (index / count) * innerWidth
}

function yForValue(value: number): number {
  const range = Math.max(axis.value.max - axis.value.min, 1)
  return PAD_TOP + ((axis.value.max - value) / range) * innerHeight
}

const plottedPoints = computed(() =>
  props.points
    .map((point, index) => {
      if (point.value === null) return null
      return {
        index,
        timestamp: point.timestamp,
        value: point.value,
        x: xForIndex(index),
        y: yForValue(point.value),
      }
    })
    .filter(
      (
        point,
      ): point is { index: number; timestamp: string; value: number; x: number; y: number } => point !== null,
    ),
)

type PlotPoint = (typeof plottedPoints.value)[number]

function buildSmoothPath(points: PlotPoint[]): string {
  if (!points.length) return ''
  const firstPoint = points[0]
  if (!firstPoint) return ''
  if (points.length === 1) return `M ${firstPoint.x} ${firstPoint.y}`

  let path = `M ${firstPoint.x} ${firstPoint.y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    if (!current || !next) continue
    const controlX = (current.x + next.x) / 2
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
  }

  return path
}

const linePath = computed(() => buildSmoothPath(plottedPoints.value))

const areaPath = computed(() => {
  if (!plottedPoints.value.length) return ''
  const baselineY = PAD_TOP + innerHeight
  const first = plottedPoints.value[0]
  const last = plottedPoints.value[plottedPoints.value.length - 1]
  if (!first || !last) return ''
  return `${linePath.value} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`
})

const yLabels = computed(() =>
  Array.from({ length: GRID_COUNT }, (_, index) => {
    const value = axis.value.max - axis.value.step * index
    const y = PAD_TOP + (innerHeight / (GRID_COUNT - 1)) * index
    return {
      value: Math.round(value),
      y,
    }
  }),
)

const xLabels = computed(() => {
  if (!props.points.length) return []
  const candidateIndexes = [0, Math.floor((props.points.length - 1) / 2), props.points.length - 1]
  const uniqueIndexes = candidateIndexes.filter((index, position) => candidateIndexes.indexOf(index) === position)
  return uniqueIndexes.map((index) => ({
    x: xForIndex(index),
    label: formatAxisDate(props.points[index]?.timestamp ?? ''),
    anchor: index === 0 ? 'start' : index === props.points.length - 1 ? 'end' : 'middle',
  }))
})

const palette = computed(() => tonePalette[props.tone])

function formatAxisDate(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getMonth() + 1}/${date.getDate()}`
}
</script>

<template>
  <div class="trend-chart">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="chart-svg" aria-hidden="true">
      <g class="grid">
        <line
          v-for="label in yLabels"
          :key="`grid-${label.y}`"
          :x1="PAD_LEFT"
          :x2="WIDTH - PAD_RIGHT"
          :y1="label.y"
          :y2="label.y"
        />
      </g>

      <g class="y-axis">
        <text
          v-for="label in yLabels"
          :key="`y-${label.y}`"
          :x="PAD_LEFT - 8"
          :y="label.y + 4"
          text-anchor="end"
        >
          {{ label.value }}
        </text>
      </g>

      <path v-if="areaPath" :d="areaPath" class="area" :style="{ fill: palette.fill }" />
      <path v-if="linePath" :d="linePath" class="trend-line" :style="{ stroke: palette.line }" />

      <circle
        v-for="point in plottedPoints"
        :key="`${point.index}-${point.timestamp}`"
        :cx="point.x"
        :cy="point.y"
        r="2.25"
        class="point"
        :style="{ fill: palette.point }"
      />

      <g class="x-axis">
        <text
          v-for="label in xLabels"
          :key="`x-${label.x}`"
          :x="label.x"
          :y="HEIGHT - 6"
          :text-anchor="label.anchor"
        >
          {{ label.label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.trend-chart {
  width: 100%;
  min-height: 148px;
  padding: 8px 8px 0;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(247, 250, 255, 0.92), rgba(252, 253, 255, 0.98));
  border: 1px solid rgba(231, 237, 247, 0.92);
}

.chart-svg {
  display: block;
  width: 100%;
  height: auto;
}

.grid line {
  stroke: rgba(219, 228, 241, 0.95);
  stroke-dasharray: 3 4;
  stroke-width: 1;
}

.y-axis text,
.x-axis text {
  fill: #7e8fa9;
  font-size: 10px;
  font-weight: 600;
}

.trend-line {
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.area {
  opacity: 1;
}

.point {
  stroke: rgba(255, 255, 255, 0.96);
  stroke-width: 1.2;
}
</style>
