<template>
  <div>
    <webview name="weibo" id="foo" src="https://m.weibo.cn/" style disablewebsecurity></webview>
  </div>
</template>

<script>
  import _ from "lodash"

  export default {
    name: 'dashboard',
    data(){
        return {}
    }
  }
</script>

<style scoped>
webview {
  display: inline-flex;
  width: 80vw;
  margin: 0 auto;
  min-height: 80vh;
}
</style>
