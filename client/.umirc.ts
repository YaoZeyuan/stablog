import { defineConfig } from '@umijs/max';
import path from 'path'

export default defineConfig({
  // 使用hash模式, 解决基于文件进行浏览时的白屏问题
  history: { type: 'hash' },
  base: "/",
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  hash: true,
  chainWebpack(memo, { env, webpack }) {
    // 设置 alias
    memo.resolve.alias.set('~', path.resolve(__dirname, '..'));
    // 设置target为electron
    memo.target("electron-renderer")
  },
  locale: {
    default: 'zh-CN',
    antd: true,
    title: false,
    baseNavigator: true,
    baseSeparator: '-',
  },
  antd: {},
  layout: false,
  //  {
  //   // https://umijs.org/docs/max/layout-menu#构建时配置
  //   title: '稳部落',
  //   locale: false,
  //   menuRender: false,
  //   menuHeaderRender: () => false,
  //   pure: true,
  //   layout: 'top',
  //   siderWidth: 400,
  //   suppressSiderWhenMenuEmpty: true
  // },
  // nodeModulesTransform: {
  //   type: 'none',
  // },
  routes: [
    { path: '/', component: '@/pages/index' },
    { path: '/customer_task', component: '@/pages/customer_task/index' },
    { path: '/helper', component: '@/pages/helper/index' },
    { path: '/log', component: '@/pages/log/index' },
    { path: '/login', component: '@/pages/login/index' },
    { path: '/manage', component: '@/pages/manage/index' },
  ],
  fastRefresh: true,
});
