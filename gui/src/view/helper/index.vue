<template>
  <div>
    <webview
      name="github-readme"
      id="github-readme"
      src="https://github.com/YaoZeyuan/stablog/blob/master/README.md"
    ></webview>
  </div>
</template>

<script>
import _ from 'lodash'

export default {
  name: 'dashboard',
  data() {
    return {}
  },
}
</script>

<style scoped>
webview {
  display: inline-flex;
  width: 100%;
  margin: 0 auto;
  min-height: 85vh;
}
</style>
