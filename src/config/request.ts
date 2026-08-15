class Request {
  static timeoutMs = 20 * 1000
  static ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
  // 由 GUI/CLI 入口在运行时显式注入，模块加载不得读取或创建业务配置文件。
  static cookie = ''
}
export default Request
