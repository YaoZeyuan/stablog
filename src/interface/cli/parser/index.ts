import { object, or } from '@optique/core/constructs'
import { message } from '@optique/core/message'
import { optional, withDefault } from '@optique/core/modifiers'
import type { InferValue } from '@optique/core/parser'
import { command, constant, option } from '@optique/core/primitives'
import { string } from '@optique/core/valueparser'

const taskConfigOption = () => withDefault(
  option('--config', string({ metavar: 'FILE' }), {
    description: message`任务配置文件路径`,
  }),
  'customer_task_config.json',
)

const localConfigOption = () => optional(
  option('--local-config', string({ metavar: 'FILE' }), {
    description: message`本地请求配置文件路径`,
  }),
)

const databaseOption = () => optional(
  option('--database', string({ metavar: 'FILE' }), {
    description: message`SQLite 数据库路径`,
  }),
)

const outputOption = () => optional(
  option('--output', string({ metavar: 'DIR' }), {
    description: message`电子书输出目录`,
  }),
)

const sharedOptions = () => ({
  configPath: taskConfigOption(),
  localConfigPath: localConfigOption(),
  databasePath: databaseOption(),
})

export const cliParser = or(
  command('init', object({
    action: constant('init' as const),
    ...sharedOptions(),
    rebase: option('--rebase', { description: message`删除旧数据库并重建` }),
  }), { description: message`初始化运行目录和数据库` }),
  command('fetch', object({
    action: constant('fetch' as const),
    ...sharedOptions(),
  }), { description: message`按配置抓取微博并写入 SQLite` }),
  command('generate', object({
    action: constant('generate' as const),
    ...sharedOptions(),
    outputPath: outputOption(),
  }), { description: message`从 SQLite 生成电子书（当前需 GUI 渲染能力）` }),
  command('run', object({
    action: constant('run' as const),
    ...sharedOptions(),
    outputPath: outputOption(),
    rebase: option('--rebase', { description: message`执行前删除旧数据库并重建` }),
  }), { description: message`顺序执行 init、fetch、generate` }),
)

export type CliCommand = InferValue<typeof cliParser>
