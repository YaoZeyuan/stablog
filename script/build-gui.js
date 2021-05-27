let shelljs = require('shelljs')

console.log('entry client directory')
shelljs.cd('./client')
console.log('run `npm run build`')
shelljs.exec('npm run build')
console.log('return root category`')
shelljs.cd('..')
console.log('remove old static`')
shelljs.rm('-rf', './dist/client')
shelljs.mkdir('-p', './dist/client/dist')
console.log('copy new static`')
shelljs.cp('./client/dist/*', './dist/client/dist/')
console.log('client 构建完毕')