import { createRouter, createWebHistory } from 'vue-router'
import AlertDisplayView from '@/views/AlertDisplayView.vue'
import AlertRecordsView from '@/views/AlertRecordsView.vue'
import DataSimulationView from '@/views/DataSimulationView.vue'
import DashboardView from '@/views/DashboardView.vue'
import LoginView from '@/views/LoginView.vue'
import ProfileView from '@/views/ProfileView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TrendsReportView from '@/views/TrendsReportView.vue'
import { pinia } from '@/pinia'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/trends',
      name: 'trends-report',
      component: TrendsReportView,
      meta: { requiresAuth: true },
    },
    {
      path: '/alerts',
      name: 'alert-records',
      component: AlertRecordsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/alerts/live',
      name: 'alert-display-live',
      component: AlertDisplayView,
      meta: { requiresAuth: true, alertMode: 'live' },
    },
    {
      path: '/alerts/history/:alertId',
      name: 'alert-display-history',
      component: AlertDisplayView,
      meta: { requiresAuth: true, alertMode: 'history' },
    },
    {
      path: '/simulation',
      name: 'data-simulation',
      component: DataSimulationView,
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia)
  const isAuthenticated = authStore.isAuthenticated

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
