import _ from 'lodash'
class StringUtil {
    /**
     * 
     * @param rawFilename 
     */
    static encodeFilename(rawFilename: string) {
        let encodeFilename = rawFilename
        let illegalCharMap = {
            '\\': '＼',
            '/': '／',
            ':': '：',
            '*': '＊',
            '?': '？',
            '=': '＝',
            '%': '％',
            '+': '＋',
            '<': '《',
            '>': '》',
            '|': '｜',
            '"': '〃',
            '!': '！',
            '\n': '',
            '\r': '',
            '&': '＆',
        }
        for (let key of Object.keys(illegalCharMap)) {
            let legalChar: string = _.get(illegalCharMap, [key], '')
            // 全局替换
            encodeFilename = encodeFilename.replace(new RegExp(`\\${key}`, 'g'), legalChar)
        }
        return encodeFilename
    }
}
export default StringUtil
