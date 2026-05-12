import { createRouter, createWebHistory } from 'vue-router'
import AlertRecordsView from '@/views/AlertRecordsView.vue'
import DashboardView from '@/views/DashboardView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TrendsReportView from '@/views/TrendsReportView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/trends',
      name: 'trends-report',
      component: TrendsReportView,
    },
    {
      path: '/alerts',
      name: 'alert-records',
      component: AlertRecordsView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

export default router
