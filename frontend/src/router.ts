import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The home page's tabs on a phone, one address each (a computer shows every
    // card at any of them)
    { path: '/', name: 'home', component: HomePage, meta: { title: 'Accueil' } },
    { path: '/spending', name: 'spending', component: HomePage, meta: { title: 'Dépenses' } },
    { path: '/budget', name: 'budget', component: HomePage, meta: { title: 'Budget' } },
    { path: '/analysis', name: 'analysis', component: HomePage, meta: { title: 'Analyse' } },
    // Charts pull in Unovis: in their own chunk
    {
      path: '/accounts/:id',
      name: 'account',
      component: () => import('./pages/AccountPage.vue'),
      props: true,
      meta: { title: 'Compte' },
    },
    // Unknown addresses go back home
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'Finance'} · Mes finances`;
});
