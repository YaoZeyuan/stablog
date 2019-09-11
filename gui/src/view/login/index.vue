<template>
  <div>
    <webview name="zhihu" id="foo" src="https://www.zhihu.com/" style></webview>
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
  height: 80vh;
}
</style>
