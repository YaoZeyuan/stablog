// 统一时间记录格式
class DATE_FORMAT {
  static get UNIT(): {
    YEAR: 'year'
    MONTH: 'month'
    WEEK: 'week'
    DAY: 'day'
    HOUR: 'hour'
    MINUTE: 'minute'
    SECOND: 'second'
    MILLSECOND: 'millsecond'
  } {
    return {
      YEAR: 'year',
      MONTH: 'month',
      WEEK: 'week',
      DAY: 'day',
      HOUR: 'hour',
      MINUTE: 'minute',
      SECOND: 'second',
      MILLSECOND: 'millsecond',
    }
  }

  // 数据库GroupBy
  static readonly SQL_GROUP_BY_YEAR: string = '%Y'
  static readonly SQL_GROUP_BY_MONTH: string = '%Y-%m'
  static readonly SQL_GROUP_BY_DAY: string = '%Y-%m-%d'
  static readonly SQL_GROUP_BY_HOUR: string = '%Y-%m-%d %H'
  static readonly SQL_GROUP_BY_MINUTE: string = '%Y-%m-%d %H:%i'
  static readonly SQL_GROUP_BY_SECOND: string = '%Y-%m-%d %H:%i:%s'
  static readonly SQL_GROUP_BY_MILLSECOND: string = '%Y-%m-%d %H:%i:%s.%f'

  static get SQL_GROUP_BY_UNIT() {
    return {
      [DATE_FORMAT.UNIT.YEAR]: DATE_FORMAT.SQL_GROUP_BY_YEAR,
      [DATE_FORMAT.UNIT.MONTH]: DATE_FORMAT.SQL_GROUP_BY_MONTH,
      [DATE_FORMAT.UNIT.DAY]: DATE_FORMAT.SQL_GROUP_BY_DAY,
      [DATE_FORMAT.UNIT.HOUR]: DATE_FORMAT.SQL_GROUP_BY_HOUR,
      [DATE_FORMAT.UNIT.MINUTE]: DATE_FORMAT.SQL_GROUP_BY_MINUTE,
      [DATE_FORMAT.UNIT.SECOND]: DATE_FORMAT.SQL_GROUP_BY_SECOND,
      [DATE_FORMAT.UNIT.MILLSECOND]: DATE_FORMAT.SQL_GROUP_BY_MILLSECOND,
    }
  }

  // 数据库记录
  static get DATABASE_BY_YEAR() {
    return 'YYYY'
  }

  static get DATABASE_BY_MONTH() {
    return 'YYYY-MM'
  }

  static get DATABASE_BY_DAY() {
    return 'YYYY-MM-DD'
  }

  static get DATABASE_BY_HOUR() {
    return 'YYYY-MM-DD_HH'
  }

  static get DATABASE_BY_MINUTE() {
    return 'YYYY-MM-DD_HH:mm'
  }

  static get DATABASE_BY_SECOND() {
    return 'YYYY-MM-DD_HH:mm:ss'
  }

  static get DATABASE_BY_MILLSECOND() {
    return 'YYYY-MM-DD_HH:mm:ss.SSS'
  }

  static get DATABASE_BY_UNIT() {
    return {
      [DATE_FORMAT.UNIT.YEAR]: DATE_FORMAT.DATABASE_BY_YEAR,
      [DATE_FORMAT.UNIT.MONTH]: DATE_FORMAT.DATABASE_BY_MONTH,
      [DATE_FORMAT.UNIT.DAY]: DATE_FORMAT.DATABASE_BY_DAY,
      [DATE_FORMAT.UNIT.WEEK]: DATE_FORMAT.DATABASE_BY_DAY,
      [DATE_FORMAT.UNIT.HOUR]: DATE_FORMAT.DATABASE_BY_HOUR,
      [DATE_FORMAT.UNIT.MINUTE]: DATE_FORMAT.DATABASE_BY_MINUTE,
      [DATE_FORMAT.UNIT.SECOND]: DATE_FORMAT.DATABASE_BY_SECOND,
      [DATE_FORMAT.UNIT.MILLSECOND]: DATE_FORMAT.DATABASE_BY_MILLSECOND,
    }
  }

  // ES记录
  static get ELASTIC_SEARCH_BY_YEAR() {
    return 'yyyy'
  }

  static get ELASTIC_SEARCH_BY_MONTH() {
    return 'yyyy-MM'
  }

  static get ELASTIC_SEARCH_BY_DAY() {
    return 'yyyy-MM-dd'
  }

  static get ELASTIC_SEARCH_BY_HOUR() {
    return 'yyyy-MM-dd HH:00:00'
  }

  static get ELASTIC_SEARCH_BY_MINUTE() {
    return 'yyyy-MM-dd HH:mm:00'
  }

  static get ELASTIC_SEARCH_BY_SECOND() {
    return 'yyyy-MM-dd HH:mm:ss'
  }

  static get ELASTIC_SEARCH_BY_MILLSECOND() {
    return 'yyyy-MM-dd HH:mm:ss.SSS'
  }

  static get ELASTIC_SEARCH_BY_UNIT() {
    return {
      [DATE_FORMAT.UNIT.YEAR]: DATE_FORMAT.ELASTIC_SEARCH_BY_YEAR,
      [DATE_FORMAT.UNIT.MONTH]: DATE_FORMAT.ELASTIC_SEARCH_BY_MONTH,
      [DATE_FORMAT.UNIT.DAY]: DATE_FORMAT.ELASTIC_SEARCH_BY_DAY,
      [DATE_FORMAT.UNIT.HOUR]: DATE_FORMAT.ELASTIC_SEARCH_BY_HOUR,
      [DATE_FORMAT.UNIT.MINUTE]: DATE_FORMAT.ELASTIC_SEARCH_BY_MINUTE,
      [DATE_FORMAT.UNIT.SECOND]: DATE_FORMAT.ELASTIC_SEARCH_BY_SECOND,
      [DATE_FORMAT.UNIT.MILLSECOND]: DATE_FORMAT.ELASTIC_SEARCH_BY_MILLSECOND,
    }
  }

  // 命令行参数
  static get COMMAND_ARGUMENT_BY_YEAR() {
    return 'YYYY'
  }

  static get COMMAND_ARGUMENT_BY_MONTH() {
    return 'YYYY-MM'
  }

  static get COMMAND_ARGUMENT_BY_DAY() {
    return 'YYYY-MM-DD'
  }

  static get COMMAND_ARGUMENT_BY_HOUR() {
    return 'YYYY-MM-DD HH'
  }

  static get COMMAND_ARGUMENT_BY_MINUTE() {
    return 'YYYY-MM-DD HH:mm'
  }

  static get COMMAND_ARGUMENT_BY_SECOND() {
    return 'YYYY-MM-DD HH:mm:ss'
  }

  static get COMMAND_ARGUMENT_BY_MILLSECOND() {
    return 'YYYY-MM-DD HH:mm:ss.SSS'
  }

  static get COMMAND_ARGUMENT_BY_UNIT() {
    return {
      [DATE_FORMAT.UNIT.YEAR]: DATE_FORMAT.COMMAND_ARGUMENT_BY_YEAR,
      [DATE_FORMAT.UNIT.MONTH]: DATE_FORMAT.COMMAND_ARGUMENT_BY_MONTH,
      [DATE_FORMAT.UNIT.DAY]: DATE_FORMAT.COMMAND_ARGUMENT_BY_DAY,
      [DATE_FORMAT.UNIT.WEEK]: DATE_FORMAT.COMMAND_ARGUMENT_BY_DAY,
      [DATE_FORMAT.UNIT.HOUR]: DATE_FORMAT.COMMAND_ARGUMENT_BY_HOUR,
      [DATE_FORMAT.UNIT.MINUTE]: DATE_FORMAT.COMMAND_ARGUMENT_BY_MINUTE,
      [DATE_FORMAT.UNIT.SECOND]: DATE_FORMAT.COMMAND_ARGUMENT_BY_SECOND,
      [DATE_FORMAT.UNIT.MILLSECOND]: DATE_FORMAT.COMMAND_ARGUMENT_BY_MILLSECOND,
    }
  }

  // 数据展示
  static get DISPLAY_BY_YEAR() {
    return 'YYYY'
  }

  static get DISPLAY_BY_MONTH() {
    return 'YYYY-MM'
  }

  static get DISPLAY_BY_DAY() {
    return 'YYYY-MM-DD'
  }

  static get DISPLAY_BY_HOUR() {
    return 'YYYY-MM-DD HH'
  }

  static get DISPLAY_BY_MINUTE() {
    return 'YYYY-MM-DD HH:mm'
  }

  static get DISPLAY_BY_SECOND() {
    return 'YYYY-MM-DD HH:mm:ss'
  }

  static get DISPLAY_BY_MILLSECOND() {
    return 'YYYY-MM-DD HH:mm:ss.SSS'
  }

  static get DISPLAY_BY_UNIT() {
    return {
      [DATE_FORMAT.UNIT.YEAR]: DATE_FORMAT.DISPLAY_BY_YEAR,
      [DATE_FORMAT.UNIT.MONTH]: DATE_FORMAT.DISPLAY_BY_MONTH,
      [DATE_FORMAT.UNIT.DAY]: DATE_FORMAT.DISPLAY_BY_DAY,
      [DATE_FORMAT.UNIT.HOUR]: DATE_FORMAT.DISPLAY_BY_HOUR,
      [DATE_FORMAT.UNIT.MINUTE]: DATE_FORMAT.DISPLAY_BY_MINUTE,
      [DATE_FORMAT.UNIT.SECOND]: DATE_FORMAT.DISPLAY_BY_SECOND,
      [DATE_FORMAT.UNIT.MILLSECOND]: DATE_FORMAT.DISPLAY_BY_MILLSECOND,
    }
  }
}

export default DATE_FORMAT
