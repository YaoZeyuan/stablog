import http from '~/src/library/http'
import logger from '~/src/library/logger'
class Base {
  static readonly http = http
  static readonly CONST_SORT_BY_CREATED = 'created'
  static logger = logger
}

export default Base
