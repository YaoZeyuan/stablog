import Base from '~/src/command/base'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import * as TypeWeibo from '~/src/type/namespace/weibo'
import MMblogUser from '~/src/model/mblog_user'
import _ from 'lodash'
import CommonUtil from '~/src/library/util/common'
import fs from 'fs-extra'
import moment from 'moment'
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
            total_export_mblog_count: number,
            record_list: TypeWeibo.TypeMblog[]
        }
    }
}


/**
 * 数据导出
 */
class DataTransferExport extends Base {

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
        let { exportUri, uid, exportStartAt, exportEndAt } = args


        this.log(`开始导出数据`, { exportUri, uid, exportStartAt, exportEndAt })
        let userInfo = await MMblogUser.asyncGetUserInfo(uid)
        let recordList = await MMblog.asyncGetMblogList(uid, exportStartAt, exportEndAt)
        this.log(`导出用户:${userInfo.screen_name}`)
        let startAtStr = moment.unix(exportStartAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)
        let endAtStr = moment.unix(exportEndAt).format(DATE_FORMAT.DISPLAY_BY_SECOND)
        this.log(`导出时间范围:${startAtStr}~${endAtStr}`)
        this.log(`导出记录数:${recordList.length}条`)
        this.log(`导出文件地址:${exportUri}`)

        let exportData: Type_Export = {
            version: DataTransferExport.export_format_version,
            export_data: {
                [userInfo.id]: {
                    info: userInfo,
                    start_at: exportStartAt,
                    end_at: exportEndAt,
                    total_export_mblog_count: recordList.length,
                    record_list: recordList
                }
            }
        }
        // 若目标文件不存在, 自动创建之
        fs.outputJsonSync(exportUri, exportData, {
            "spaces": 2
        })
        this.log(`导出完毕`)

    }


}
export default DataTransferExport
