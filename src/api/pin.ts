import _ from 'lodash'
import Base from '~/src/api/base'
import TypePin from '~/src/type/namespace/pin'

class Pin extends Base {
  /**
   * 获取想法详情
   * demo => https://www.zhihu.com/api/v4/pins/1097830077735231488
   * @param pinId
   */
  static async asyncGet(pinId: number | string): Promise<TypePin.Record> {
    const baseUrl = `https://www.zhihu.com/api/v4/pins/${pinId}`
    const config = {}
    const pinRecord: TypePin.Record = await Base.http.get(baseUrl, {
      params: config,
    })
    return pinRecord
  }
}
export default Pin
