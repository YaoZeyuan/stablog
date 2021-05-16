import Base from '~/src/command/base'
import { TypeWeiboUserInfo, TypeMblog, TypeWeiboEpub, TypeWeiboListByDay } from '~/src/type/namespace/weibo'
import TypeTaskConfig from '~/src/type/namespace/task_config'
import PathConfig from '~/src/config/path'
import MMblog from '~/src/model/mblog'
import MMblogUser from '~/src/model/mblog_user'
import _ from 'lodash'
import CommonUtil from '~/src/library/util/common'

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
            info: {

            },
            start_at: number,
            end_at: number,
            total_export_mblog_count: number,
            record_list: {

            }
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
        let userInfo = await MMblogUser.asyncGetUserInfo(uid)
        let recordList = await MMblog.asyncGetMblogList(uid, exportStartAt, exportEndAt)

    }


}
export default DataTransferExport
