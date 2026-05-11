import { createRouter, createWebHistory } from 'vue-router'
import ServerCheckView from '@/views/ServerCheckView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'server-check',
      component: ServerCheckView,
    },
  ],
})

export default router
