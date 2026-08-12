const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const repositoryRoot = path.resolve(__dirname, '..')
const distPath = path.resolve(repositoryRoot, 'dist')
const clientPath = path.resolve(repositoryRoot, 'client')
const clientDistPath = path.resolve(clientPath, 'dist')
const packagedClientPath = path.resolve(distPath, 'client', 'dist')

function assertPathInside(rootPath, targetPath, label) {
  const relativePath = path.relative(path.resolve(rootPath), path.resolve(targetPath))
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`${label} is outside its allowed root: ${targetPath}`)
  }
}

function runPnpmScript(scriptName, cwd) {
  const pnpmCliPath = process.env.npm_execpath
  if (!pnpmCliPath) {
    throw new Error('Run this build through `pnpm build-dist` so the pinned pnpm CLI is available.')
  }

  const result = childProcess.spawnSync(process.execPath, [pnpmCliPath, 'run', scriptName], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

assertPathInside(repositoryRoot, distPath, 'Server build directory')
assertPathInside(clientPath, clientDistPath, 'Client build directory')
assertPathInside(distPath, packagedClientPath, 'Packaged client directory')

console.log(`Clear old build output: ${distPath}`)
fs.rmSync(distPath, { recursive: true, force: true })

console.log('Build Electron main process and CLI')
runPnpmScript('build-server', repositoryRoot)

console.log('Build client application')
runPnpmScript('build', clientPath)
if (!fs.existsSync(clientDistPath)) {
  throw new Error(`Client build output is missing: ${clientDistPath}`)
}

console.log(`Copy client output: ${clientDistPath} -> ${packagedClientPath}`)
fs.mkdirSync(path.dirname(packagedClientPath), { recursive: true })
fs.cpSync(clientDistPath, packagedClientPath, { recursive: true })
console.log('Application build output is ready')
