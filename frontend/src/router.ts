import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomePage, meta: { title: 'Accueil' } },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('./pages/CategoriesPage.vue'),
      meta: { title: 'Catégories' },
    },
    // Unknown addresses go back home
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Finance'} · Mes finances`;
});
