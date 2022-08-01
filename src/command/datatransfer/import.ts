import Base from '~/src/command/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import MMblogUser from '~/src/model/mblog_user'
import _ from 'lodash'
import CommonUtil from '~/src/library/util/common'
import fs from 'fs-extra'
import dayjs from 'dayjs'
import DATE_FORMAT from '~/src/constant/date_format'

type Type_Export = {
    /**
     * 导出数据版本
     */
    version: string
    /**
     * 导出数据
     */
    export_data: {
        [uid: string]: {
            info: TypeWeibo.TypeWeiboUserInfo,
            start_at: number,
            end_at: number,
            /**
            * 字符串格式的时间, 仅用于提示, 方便查看导出范围
            */
            start_at_str: string,
            /**
             * 字符串格式的时间, 仅用于提示, 方便查看导出范围
             */
            end_at_str: string,
            total_export_mblog_count: number,
            record_list: TypeWeibo.TypeMblog[]
        }
    }
}


/**
 * 数据导出
 */
class DataTransferImport extends Base {

    static export_format_version = "1.0.0"

    static get signature() {
        return `
            DataTransfer:Export
        `
    }

    static get description() {
        return '导出数据库内容'
    }

    async execute(args: any, options: any): Promise<any> {
        let { importUri } = args

        let content: Type_Export = fs.readJsonSync(importUri);
        if (content?.version !== DataTransferImport.export_format_version) {
            this.log(`导入数据库版本不为${DataTransferImport.export_format_version}, 无法导入, 自动退出`)
            return
        }
        for (let db of Object.values(content.export_data)) {
            let userInfo = db.info
            let record_list = db.record_list
            let startStr = dayjs.unix(db.start_at).format(DATE_FORMAT.DISPLAY_BY_SECOND)
            let endStr = dayjs.unix(db.end_at).format(DATE_FORMAT.DISPLAY_BY_SECOND)
            this.log(`开始导入用户${userInfo.screen_name}从${startStr}到${endStr}的数据记录`)
            // 导入用户信息
            await MMblogUser.replaceInto({
                author_uid: `${userInfo.id}`,
                raw_json: JSON.stringify(userInfo),
            })
            let counter = 0
            for (let record of record_list) {
                counter++;
                let id = record.id
                let author_uid = `${record.user.id}`
                let is_retweet = record.retweeted_status ? 1 : 0
                let is_article = record.article ? 1 : 0
                let raw_json = JSON.stringify(record)
                // 导入记录
                await MMblog.replaceInto({
                    id,
                    author_uid,
                    is_retweet,
                    is_article,
                    raw_json,
                    post_publish_at: record.created_timestamp_at,
                }).catch((e: Error) => {
                    this.log("数据库插入出错 => ", {
                        name: e?.name,
                        message: e?.message,
                        stack: e?.stack
                    })
                    return
                })
                if (counter % 100 === 0) {
                    this.log(`已成功导入${counter}/${record_list.length}条记录`)
                    await CommonUtil.asyncSleep(100)
                }
            }
        }
        this.log(`所有记录导入完毕`)

    }


}
export default DataTransferImport
