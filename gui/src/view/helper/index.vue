<template>
  <div>
    <webview
      name="github-readme"
      id="github-readme"
      src="https://github.com/YaoZeyuan/zhihuhelp_with_node/blob/master/README.md"
      style
    ></webview>
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
