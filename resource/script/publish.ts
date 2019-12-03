import path from 'path'
import shelljs from 'shelljs'

let parentPath = path.resolve('..')
let currentPath = path.resolve('..')
let buildPath = path.resolve(currentPath, 'build')

// 强制复制到目标文件夹下
shelljs.cp(`${buildPath}/*`, parentPath, '-rf')
