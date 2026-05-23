<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowUpDown,
  Bell,
  CalendarDays,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronRight,
  Droplets,
  Filter,
  Gauge,
  HeartPulse,
  Info,
  LogOut,
  RefreshCw,
  Settings,
  TriangleAlert,
  User,
  Waves,
} from '@lucide/vue'

type IconName =
  | 'dashboard'
  | 'check'
  | 'trends'
  | 'alerts'
  | 'settings'
  | 'calendar'
  | 'filter'
  | 'sort'
  | 'warning'
  | 'droplet'
  | 'heart-pulse'
  | 'wave'
  | 'user'
  | 'bell'
  | 'sync'
  | 'info'
  | 'logout'
  | 'chevron-right'
  | 'chevron-down'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number
    strokeWidth?: number
  }>(),
  {
    size: 20,
    strokeWidth: 2,
  },
)

const iconMap = {
  dashboard: Gauge,
  check: Check,
  trends: ChartColumn,
  alerts: Bell,
  settings: Settings,
  calendar: CalendarDays,
  filter: Filter,
  sort: ArrowUpDown,
  warning: TriangleAlert,
  droplet: Droplets,
  'heart-pulse': HeartPulse,
  wave: Waves,
  user: User,
  bell: Bell,
  sync: RefreshCw,
  info: Info,
  logout: LogOut,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
} as const

const currentIcon = computed(() => iconMap[props.name])
</script>

<template>
  <component
    :is="currentIcon"
    :size="size"
    :stroke-width="strokeWidth"
    class="app-icon"
    aria-hidden="true"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}
</style>
