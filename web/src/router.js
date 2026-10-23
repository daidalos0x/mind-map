import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Edit',
    component: () => import('./pages/Edit/Index.vue')
  },
  {
    path: '/index',
    redirect: '/'
  },
  {
    path: '/doc/zh',
    component: () => import('./pages/Doc.vue')
  }
]

// 桌面端从 file/http 本地地址加载，用 hash 模式避免刷新 404
const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
