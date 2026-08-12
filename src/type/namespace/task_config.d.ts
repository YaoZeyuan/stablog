import type {
  CustomerTaskConfig,
  TaskRecord,
  ImageQuality,
} from '~/src/shared/config/task_config.js'

declare namespace TaskConfig {
  type imageQuilty = (typeof ImageQuality)[keyof typeof ImageQuality]
  type maxBlogInBook = number // 自动分卷: 单本电子书中最大问题/文章数量
  type Record = TaskRecord

  // 自定义抓取
  type Customer = CustomerTaskConfig
}

export default TaskConfig
