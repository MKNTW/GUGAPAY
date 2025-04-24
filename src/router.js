import { createRouter, createWebHistory } from 'vue-router'

import Home from './views/Home.vue'
import Transfer from './views/Transfer.vue'
import Request from './views/Request.vue'
import Exchange from './views/Exchange.vue'
import Chat from './views/Chat.vue'
import Payment from './views/Payment.vue'
import History from './views/History.vue'

const routes = [
  {
    path: '/chat/:userId',
    component: () => import('./views/ChatView.vue')
  },
  { path: '/', component: Home },
  { path: '/transfer', component: Transfer },
  { path: '/request', component: Request },
  { path: '/exchange', component: Exchange },
  { path: '/chat', component: Chat },
  { path: '/payment/:id', component: Payment },
  { path: '/history', component: History },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
