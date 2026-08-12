// 简单脚本, 用于实时编译静态资源中的less文件
let watch = require('watch')
let exec = require('child_process').exec
let path = require('path')
let fs = require('fs')
let less = require('less')

let Const_Target_Path = path.resolve(__dirname, '..', './src/public/css')
let filenameList = fs.readdirSync(Const_Target_Path)
filenameList = filenameList.filter((item) => item.includes('.less'))
filenameList = filenameList.map((item) => item.split('.less')[0])

async function writeCSS(fileuri) {
  // for (let filename of filenameList) {
  // let fileuri = path.resolve(Const_Target_Path, `${filename}.less`)
  let filename = path.parse(fileuri).name
  let outputuri = path.resolve(Const_Target_Path, `${filename}.css`)
  let rawContent = fs.readFileSync(fileuri).toString()
  let cssContent = await less.render(rawContent)
  fs.writeFileSync(outputuri, cssContent.css)
}

let runner = function () {
  // watch for less file changes
  var dir = Const_Target_Path
  console.log(`start to watch: ${dir}`)
  watch.watchTree(dir, function _onchange(f, curr, prev) {
    if (f && f.endsWith && f.endsWith('.less')) {
      console.log('update => ', f)
      let realname = path.resolve(f)
      writeCSS(realname)
    }
  })
  // writeCSS(dir)
}
runner()
