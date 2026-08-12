import http from '~/src/library/http/index.js'
import logger from '~/src/library/logger.js'
class Base {
  static readonly http = http
  static readonly CONST_SORT_BY_CREATED = 'created'
  static logger = logger
}

export default Base
