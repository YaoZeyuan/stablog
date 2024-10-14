import { defineConfig } from 'umi';
import path from 'path'

export default defineConfig({
  // 使用hash模式, 解决基于文件进行浏览时的白屏问题
  history: { type: 'hash' },
  base: "/",
  publicPath: '/',
  hash: true,
  chainWebpack(memo, { env, webpack }) {
    // 设置 alias
    memo.resolve.alias.set('~', path.resolve(__dirname, '..'));
    // 设置target为electron
    memo.target("electron-renderer")
  },
  // plugins: ['@umijs/plugin-electron'],
  locale: {
    default: 'zh-CN',
    antd: true,
    title: false,
    baseNavigator: true,
    baseSeparator: '-',
  },
  antd: {},
  layout: {
    // https://umijs.org/docs/max/layout-menu#构建时配置
    title: 'UmiJS',
    locale: true,
  },
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
