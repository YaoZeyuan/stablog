import { defineConfig } from 'umi';

export default defineConfig({
  nodeModulesTransform: {
    type: 'none',
  },
  routes: [
    { path: '/', component: '@/pages/index' },
    { path: '/customer_task', component: '@/pages/customer_task/index' },
    { path: '/helper', component: '@/pages/helper/index' },
    { path: '/log', component: '@/pages/log/index' },
    { path: '/login', component: '@/pages/login/index' },
    { path: '/manage', component: '@/pages/manage/index' },
  ],
  fastRefresh: {},
});
