const fs = require('node:fs')
const path = require('node:path')

const repositoryRoot = path.resolve(__dirname, '../..')
const staleRelativePathList = [
  'dist/src',
  'dist/library/pdf/jspdf.node.js',
  'dist/library/pdf/jspdf.node.js.map',
  'dist/package.json',
]

for (const relativePath of staleRelativePathList) {
  fs.rmSync(path.resolve(repositoryRoot, relativePath), {
    recursive: true,
    force: true,
  })
}
