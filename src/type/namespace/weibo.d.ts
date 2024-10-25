export type TypePageType_Video = 'video'
export type TypePageType_Webpage = 'webpage'
export type TypePageType_Article = 'article'
export type TypePageType = TypePageType_Video | TypePageType_Webpage | TypePageType_Article

export type TypeUserInfoResponse_TabsInfo_Tab = {
  id: 2
  tabKey: 'weibo'
  must_show: 1
  hidden: 0
  title: '微博'
  tab_type: 'weibo'
  containerid: '1076031245161127'
  apipath: '/profile/statuses'
  url: '/index/my'
}
export type TypeUserInfoResponse = {
  ok: 1
  data: {
    avatar_guide: []
    userInfo: {
      id: 1245161127
      screen_name: 'eprom'
      profile_image_url: 'https://tva2.sinaimg.cn/crop.0.0.180.180.180/4a37a6a7jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568225294&ssig=sM99PIQa4u'
      profile_url: 'https://m.weibo.cn/u/1245161127?uid=1245161127&luicode=10000011&lfid=1005051245161127'
      statuses_count: 60406
      verified: true
      verified_type: 0
      verified_type_ext: 1
      verified_reason: '知名科学科普博主 微博签约自媒体'
      close_blue_v: false
      description: '群龙之首，傲视天际，万民敬仰'
      gender: 'm'
      mbtype: 12
      urank: 48
      mbrank: 7
      follow_me: false
      following: true
      followers_count: 334141
      follow_count: 207
      cover_image_phone: 'https://wx1.sinaimg.cn/crop.0.0.640.640.640/4a37a6a7ly1fj7ou6dawvj20u00u044p.jpg'
      avatar_hd: 'https://ww2.sinaimg.cn/orj480/4a37a6a7jw1e8qgp5bmzyj2050050aa8.jpg'
      like: false
      like_me: false
      toolbar_menus: [
        {
          type: 'profile_follow'
          name: '已关注'
          sub_type: 1
          params: {
            uid: 1245161127
          }
          actionlog: {
            act_code: '594'
            fid: '2307741245161127'
            oid: '1005051245161127'
            cardid: '230774_-_WEIBO_INDEX_PROFILE_FOLLOW'
            ext: 'uid:1718734760|ouid:1245161127|ptype:0|verified_type:0|load_read_level:0|btn_name:关注'
          }
        },
        {
          type: 'link'
          name: '聊天'
          params: {
            scheme: 'sinaweibo://messagelist?uid=1245161127&nick=eprom&verified_type=0&send_from=user_profile'
          }
          actionlog: {
            act_code: '594'
            fid: '2307741245161127'
            oid: 'messagelist'
            cardid: '230774_-_WEIBO_INDEX_PROFILE_CHAT'
            ext: 'uid:1718734760|ouid:1245161127|ptype:0|verified_type:0|load_read_level:0|btn_name:聊天'
          }
          scheme: 'https://m.weibo.cn/msg/chat?uid=1245161127&nick=eprom&verified_type=0&send_from=user_profile&luicode=10000011&lfid=1005051245161127'
        },
        {
          type: 'toolbar_menu_list'
          name: '他的热门'
          params: {
            menu_list: [
              {
                type: 'link'
                name: '热门内容'
                params: {
                  scheme: 'sinaweibo://cardlist?containerid=2310021245161127_-_HOTMBLOG'
                }
                actionlog: {
                  act_code: '594'
                  fid: '2307741245161127'
                  oid: '2310021245161127_-_HOTMBLOG'
                  cardid: '230774_-_WEIBO_INDEX_PROFILE_HOTWEIBO'
                  ext: 'uid:1718734760|ouid:1245161127|ptype:0|verified_type:0|load_read_level:0|btn_name:热门内容'
                }
                scheme: 'https://m.weibo.cn/p/index?containerid=2310021245161127_-_HOTMBLOG&luicode=10000011&lfid=1005051245161127'
              },
              {
                type: 'link'
                name: '橱窗'
                params: {
                  scheme: 'sinaweibo://cardlist?containerid=2316161245161127_-_USERSHOPWINDOW'
                }
                actionlog: {
                  act_code: '594'
                  fid: '2307741245161127'
                  oid: '2316161245161127_-_USERSHOPWINDOW'
                  cardid: '230774_-_WEIBO_INDEX_PROFILE_SHOPWINDOW'
                  ext: 'uid:1718734760|ouid:1245161127|ptype:0|verified_type:0|load_read_level:0|btn_name:橱窗'
                }
                scheme: 'https://m.weibo.cn/p/index?containerid=2316161245161127_-_USERSHOPWINDOW&luicode=10000011&lfid=1005051245161127'
              },
            ]
          }
          actionlog: {
            act_code: '594'
            fid: '2307741245161127'
            oid: '1005051245161127'
            cardid: '230774_-_WEIBO_INDEX_PROFILE_BTN_ALL'
            ext: 'uid:1718734760|ouid:1245161127|ptype:0|verified_type:0|load_read_level:0|btn_name:他的热门'
          }
        },
      ]
    }
    fans_scheme: 'https://m.weibo.cn/p/index?containerid=231051_-_fans_intimacy_-_1245161127&luicode=10000011&lfid=1005051245161127'
    follow_scheme: 'https://m.weibo.cn/p/index?containerid=231051_-_followersrecomm_-_1245161127&luicode=10000011&lfid=1005051245161127'
    tabsInfo: {
      selectedTab: 1
      tabs: Array<TypeUserInfoResponse_TabsInfo_Tab>
    }
    scheme: 'sinaweibo://userinfo?uid=1245161127&type=uid&value=1245161127&luicode=10000011&lfid=1076031245161127&v_p=42&fid=1005051245161127&uicode=10000011'
    showAppTips: 1
  }
}

export type Type_Profile_Info = {
  ok: 1
  data: {
    user: {
      id: 1221171697
      screen_name: '兔主席'
      profile_image_url: 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1658848615&ssig=ucJ%2FPNGgoj'
      profile_url: 'https://m.weibo.cn/u/1221171697?uid=1221171697&luicode=20000174&yingyongbao=1&sourceType=weixin&launchid=10000360-weixinh5_9999_01'
      statuses_count: 7993
      verified: true
      verified_type: 0
      verified_type_ext: 0
      verified_reason: '历史博主 头条文章作者'
      close_blue_v: false
      description: '大历史。大社会。 独立。理性。批判。建设。'
      gender: 'm'
      mbtype: 11
      urank: 38
      mbrank: 6
      follow_me: false
      following: true
      follow_count: 475
      followers_count: '178.2万'
      followers_count_str: '178.2万'
      cover_image_phone: 'https://tva1.sinaimg.cn/crop.0.0.640.640.640/549d0121tw1egm1kjly3jj20hs0hsq4f.jpg'
      avatar_hd: 'https://ww3.sinaimg.cn/orj480/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg'
      like: false
      like_me: false
    }
    statuses: []
    more: '/p/2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO'
    fans: '/p/second?containerid=1005051221171697_-_FANS'
    follow: '/p/second?containerid=1005051221171697_-_FOLLOWERS'
    button: {
      type: 'profile_follow'
      name: '已关注'
      sub_type: 1
      params: {
        uid: '1221171697'
      }
    }
  }
}

export type TypeWeiboUserInfo = {
  id: 1245161127
  screen_name: 'eprom'
  profile_image_url: 'https://tva2.sinaimg.cn/crop.0.0.180.180.180/4a37a6a7jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568225849&ssig=HCSlyweo%2BV'
  profile_url: 'https://m.weibo.cn/u/1245161127?uid=1245161127&luicode=10000011&lfid=2304131245161127_-_WEIBO_SECOND_PROFILE_WEIBO'
  statuses_count: 59804
  verified: true
  verified_type: 0
  verified_type_ext: 1
  verified_reason: '知名科学科普博主 微博签约自媒体'
  close_blue_v: false
  description: '群龙之首，傲视天际，万民敬仰'
  gender: 'm'
  mbtype: 12
  urank: 48
  mbrank: 7
  follow_me: false
  following: true
  followers_count: 293997
  follow_count: 205
  cover_image_phone: 'https://wx1.sinaimg.cn/crop.0.0.640.640.640/4a37a6a7ly1fj7ou6dawvj20u00u044p.jpg'
  avatar_hd: 'https://ww2.sinaimg.cn/orj480/4a37a6a7jw1e8qgp5bmzyj2050050aa8.jpg'
  like: false
  like_me: false
  badge: {
    taobao: 1
    gongyi_level: 1
    bind_taobao: 1
    self_media: 1
    dzwbqlx_2016: 1
    follow_whitelist_video: 1
    panda: 1
    user_name_certificate: 1
    wenchuan_10th: 1
    asiad_2018: 1
    relation_display: 1
    china_2019: 1
    hongkong_2019: 1
  }
}

export type TypenWeiboRecord_UserInfo = {
  id: 1221171697
  screen_name: '兔主席'
  profile_image_url: 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568350906&ssig=Efm2vfVTjS'
  profile_url: 'https://m.weibo.cn/u/1221171697?uid=1221171697&luicode=10000011&lfid=1076031221171697'
  statuses_count: 6979
  verified: true
  verified_type: 0
  verified_type_ext: 1
  verified_reason: '知名历史博主 头条文章作者'
  close_blue_v: false
  description: '大历史。大社会。 独立。理性。批判。建设。'
  gender: 'm'
  mbtype: 11
  urank: 38
  mbrank: 6
  follow_me: false
  following: true
  followers_count: 1053009
  follow_count: 468
  cover_image_phone: 'https://tva1.sinaimg.cn/crop.0.0.640.640.640/549d0121tw1egm1kjly3jj20hs0hsq4f.jpg'
  avatar_hd: 'https://ww3.sinaimg.cn/orj480/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg'
  like: false
  like_me: false
  badge: {
    bind_taobao: 1
    dzwbqlx_2016: 1
    follow_whitelist_video: 1
    user_name_certificate: 1
    china_2019: 1
    hongkong_2019: 1
  }
}

export type TypePageInfo = {
  page_pic: {
    url: 'https://wx4.sinaimg.cn/wap720/48c999f1gy1g6uza6a6qlj20d407egm6.jpg'
  }
  page_url: 'https://m.weibo.cn/feature/applink?scheme=sinaweibo%3A%2F%2Farticlebrowser%3Fobject_id%3D1022%253A2309404446645566701785%26url%3Dhttps%253A%252F%252Fcard.weibo.com%252Farticle%252Fm%252Fshow%252Fid%252F2309404446645566701785%253F_wb_client_%253D1%26extparam%3Dlmid--4446645569803228&luicode=10000011&lfid=2304131913094142_-_WEIBO_SECOND_PROFILE_WEIBO'
  page_title: '香港反对派推促的美国反华法案对香港经济的影响？'
  content1: '香港反对派推促的美国反华法案对香港经济的影响？'
  content2: ''
  icon: 'https://h5.sinaimg.cn/upload/2016/12/28/14/feed_headlines_icon_flash20161228_2.png'
  type: TypePageType
  object_id: '1022:2309404414789865570479'
  // 视频中带的key
  play_count: '36万次播放'
  media_info: {
    duration: 161.957
    stream_url: 'https://f.video.weibocdn.com/NMJVsI9olx07LzZ45oti01041200k0S70E010.mp4?label=mp4_ld&template=640x360.25.0&trans_finger=40a32e8439c5409a63ccf853562a60ef&ori=0&ps=1CwnkDw1GXwCQx&Expires=1617380389&ssig=9i8xY5%2Bsww&KID=unistore,video'
    stream_url_hd: 'https://f.video.weibocdn.com/UmEGuRZXlx07LzZ4GhsA01041200uhlA0E010.mp4?label=mp4_hd&template=852x480.25.0&trans_finger=62b30a3f061b162e421008955c73f536&ori=0&ps=1CwnkDw1GXwCQx&Expires=1617380389&ssig=iHKgDfh3oq&KID=unistore,video'
  }
}

/**
 * 最终版微博类型定义
 */
export type TypeMblog = {
  visible: {
    type: 0
    list_id: 0
  }
  created_at: '09-08' | string
  /**
   * 需要主动解析为该值, 作为微博发表时间戳
   */
  created_timestamp_at: number
  /**
   * 当delete值存在时,表示该微博已被删除. 此时created_timestamp_at不存在. 所有字段存在性都不能保证
   */
  deleted?: '1'
  /**
   * 微博状态, 当微博异常时, 会有该字段
   * 7 => 抱歉，此微博已被作者删除
   * 8 => 该微博因被多人投诉，根据《微博社区公约》，已被删除
   *
   */
  state: 7
  id: '4414052358656728'
  idstr: '4414052358656728'
  mid: '4414052358656728'
  can_edit: boolean
  thumbnail_pic: 'http://wx4.sinaimg.cn/thumbnail/48c999f1gy1g6rg0izojkj20yi1pce84.jpg'
  bmiddle_pic: 'http://wx4.sinaimg.cn/bmiddle/48c999f1gy1g6rg0izojkj20yi1pce84.jpg'
  original_pic: 'http://wx4.sinaimg.cn/large/48c999f1gy1g6rg0izojkj20yi1pce84.jpg'
  is_paid: false
  mblog_vip_type: 0
  user: TypenWeiboRecord_UserInfo
  picStatus: '0:1,1:1,2:1,3:1,4:1'
  reposts_count: 53
  comments_count: 56
  attitudes_count: 347
  pending_approval_count: 0
  isLongText: boolean
  reward_exhibition_type: 2
  reward_scheme: 'sinaweibo://reward?bid=1000293251&enter_id=1000293251&enter_type=1&oid=4414052358656728&seller=1221171697&share=18cb5613ebf3d8aadd9975c1036ab1f47&sign=72970c731f265faf8d166e6281da4fc9'
  hide_flag: 0
  mblogtype: 0
  more_info_type: 0
  extern_safe: 0
  number_display_strategy: {
    apply_scenario_flag: 3
    display_text_min_number: 1000000
    display_text: '100万+'
  }
  content_auth: 0
  pic_num: 5
  mblog_menu_new_style: 0
  edit_config: {
    edited: false
  }
  weibo_position: 1
  show_attitude_bar: 0
  bid: 'I5Tz5Ak0E'
  pics: Array<TypenWeiboRecord_Pic>

  version: 4
  show_additional_indication: 0
  text: '发布了头条文章：《香港反对派推促的美国反华法案对香港经济的影响？》 与香港反对派及许多市民想象的不同，反华法案对香港经济的影响不大。1）香港贸易经济主要受制于中美贸易摩擦；2）香港的金融行业与贸易相关性间接有限。 <a data-url="http://t.cn/AiEi7fCM" href="https://media.weibo.cn/article?object_id=1022%3A2309404414789865570479&extparam=lmid--4414789868083942&luicode=10000011&lfid=2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO&id=2309404414789865570479" data-hide=""><span class=\'url-icon\'><img style=\'width: 1rem;height: 1rem\' src=\'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_article_default.png\'></span><span class="surl-text">香港反对派推促的美国反华法案对香港经济的影响？</span></a> '
  /**
   * 只在isLongText为false时有
   */
  raw_text?: '看见没有，放了多少油[偷笑]，还好吃就得多放油，然后。。。'
  textLength: 230
  source: '微博 weibo.com'
  favorited: false
  pic_types: ''

  isTop: 1
  page_info: TypePageInfo
  title: {
    text: '置顶'
    base_color: 1
  }
  // 微博文章json, 仅当微博为文章类型时, 才添加到数据记录中
  article?: TypeWeiboArticleRecord
  // 被转发的微博
  retweeted_status?: TypeMblog
}

export type TypenWeiboRecord_Pic = {
  pid: '48c999f1gy1g6rg0p5ctvj20yi1pc4qq'
  url: 'https://wx3.sinaimg.cn/orj360/48c999f1gy1g6rg0p5ctvj20yi1pc4qq.jpg'
  size: 'orj360'
  geo: {
    width: 360
    height: 640
    croped: false
  }
  large: {
    size: 'large'
    url: 'https://wx3.sinaimg.cn/large/48c999f1gy1g6rg0p5ctvj20yi1pc4qq.jpg'
    geo: {
      width: '1242'
      height: '2208'
      croped: false
    }
  }
}

export type TypeWeiboRecord = {
  card_type: 9 | number
  itemid: '1076031221171697_-_4414052358656728'
  scheme: 'https://m.weibo.cn/status/I5Tz5Ak0E?mblogid=I5Tz5Ak0E&luicode=10000011&lfid=1076031221171697'
  mblog: TypeMblog
  show_type: 0
  title: ''
}

export type TypeWeiboListResponse = {
  ok: 1 | 0
  msg: "" | '这里还没有内容'
  data: {
    cardlistInfo: {
      containerid: '1076031221171697'
      v_p: 42
      show_style: 1
      total: 7022
      since_id: 4414047003058832
    }
    cards: Array<TypeWeiboRecord>
    scheme: 'sinaweibo://cardlist?containerid=1076031221171697&extparam=&uid=1221171697&luicode=10000011&lfid=100103type%3D1%26q%3D%E5%85%94%E4%B8%BB%E5%B8%AD&type=uid&value=1221171697&since_id=4414889093011824&v_p=42&fid=1076031221171697&uicode=10000011'
  }
}

export type TypeLongTextWeiboResponse = {
  ok: 1
  data: TypeMblog
}

export type TypeWeiboArticleRecord = {
  object_id: string | '1022:2309404619352241471539'
  vuid: 0 | number
  uid: 1221171697 | number
  cover_img: {
    image: {
      url: string | 'https://ww4.sinaimg.cn/crop.0.0.1280.719.1000.562/006cSmwjgw1f5e8xstgc4j30zk0k0whp.jpg'
      height: 450
      width: 800
    }
    full_image: {
      url: string | 'https://ww4.sinaimg.cn/crop.0.0.1280.719.1000.562/006cSmwjgw1f5e8xstgc4j30zk0k0whp.jpg'
      height: 562
      width: 1000
    }
  }
  target_url: string | 'https://card.weibo.com/article/m/show/id/2309404619352241471539'
  title: string | '理解西方人对“种族灭绝”的近代历史心结'
  create_at: string | '03-27 13:27'
  read_count: string | '40万+'
  summary: '' | string
  writer: []
  ourl: ''
  url: string | 'https://weibo.com/ttarticle/p/show?id=2309404619352241471539'
  is_pay: 0
  is_reward: 0
  is_vclub: 0
  is_original: 0
  pay_status: 0
  follow_to_read: 1
  userinfo: {
    uid: 1221171697 | number
    id: 1221171697 | number
    screen_name: '兔主席' | string
    description: '大历史。大社会。 独立。理性。批判。建设。' | string
    followers_count: 1762801 | number
    friends_count: 465 | number
    verified: boolean
    verified_type: 0 | 1
    verified_type_ext: 0 | 1
    verified_reason: '知名历史博主 头条文章作者' | string
    avatar_large: string | 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1616914030&ssig=rphdPBquHf'
    profile_image_url: string | 'https://tva3.sinaimg.cn/crop.0.0.180.180.50/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1616914030&ssig=eXClERRC%2FH'
    cover_image: string | ''
    cover_image_phone: string | 'https://ww1.sinaimg.cn/crop.0.0.640.640.640/549d0121tw1egm1kjly3jj20hs0hsq4f.jpg'
    following: boolean
    mbtype: number
    mbrank: number
    url: string | 'https://weibo.com/u/1221171697'
    target_url: string | 'https://m.weibo.cn/profile/1221171697'
    scheme_url: string | 'sinaweibo://userinfo?uid=1221171697'
    is_vclub: 0 | 1
    is_vclub_gold: 0 | 1
  }
  content: string | '文本内容'
  is_import: 0
  is_repost_to_share: 0
  reward_data: {
    seller: number | 1221171697
    bid: 1000207805
    oid: string | '1022:2309404619352241471539'
    access_type: 'mobileLayer'
    share: 1
    sign: string | '6233ad671c5222c7f2aee451af28a202'
  }
  copyright: 0
  mid: 4619352240819112 | string
  is_word: 1
  article_browser: 1
  scheme_url: string | 'sinaweibo://articlebrowser?object_id=1022:2309404619352241471539&url=https%3A%2F%2Fcard.weibo.com%2Farticle%2Fm%2Fshow%2Fid%2F2309404619352241471539'
  article_recommend: []
  article_recommend_info: {
    type: 1
  }
  ignore_read_count: 0
  is_new_style: 1
  card_list: []
  object_info: []
  extra: null
  article_type: 'v3_h5'
  history: ''
  origin_oid: ''
  update_at: ''
  show_edit: 0
  pay_info: []
  pay_info_ext: []
  pay_edit_tips: ''
  pay_data: {
    version: '531294344d21a6d3'
    ua: 'h5'
    vuid: 1221171697 | number
    body_btn: []
    footer_btn: []
  }
  is_checking: null
  real_oid: null
  hide_share_button: 0
  hide_repost_button: 0
  article_fingerprinting: 'f8a66a53c0cf5b726a6703d83df4fdd9'
  is_follow: 0
}

export type TypeWeiboArticleRecordOld = {
  "article": "xxxxxxx"
  "config": {
    "uid": "5687069307",
    "id": "",
    "cid": "1001603925683628839885",
    "vid": "7305723493",
    "object_id": "1022:1001603925683628839885",
    "v_p": "5",
    "from": "1110006030",
    "wm": "",
    "ip": "",
    "containerid": "1001603925683628839885",
    "v": "1",
    "page": "1",
    "count": "20",
    "index_count": "3",
    "max_id": "0",
    "read_count": "29715",
    "is_owner": "",
    "is_login": "1",
    "desc": "\u5199\u5728\u524d\u9762\uff0c\u91cd\u8981\uff1a\u670b\u53cb\u4eec\uff0c\u5f00\u59cb\u6d4f\u89c8\u672c\u6708ETF\u8ba1\u5212\u524d\uff0c\u8bf7\u4ed4\u7ec6\u9605\u8bfb\u4ee5\u4e0b\u4e24\u70b9\uff1a1\u3001\u672c\u8ba1\u5212\u7edd\u975e\u4efb\u4f55\u5f62\u5f0f\u7684\u6295\u8d44\u5efa\u8bae\u6216\u662f\u6295\u8d44\u6307\u5bfc\u3002\u5728\u8fd9\u91cc\uff0c\u4ec5\u4ec5\u662f\u5c06\u672c\u4eba\u5341\u5e74\u524d\u5f00\u59cb\uff0c\u4e00\u4e9b\u670b\u53cb\u4e94\u5e74\u524d\u5f00\u59cb\u8fdb\u884c\u7684\u4e00\u4e2a\u6295\u8d44\u6307\u6570\u7684\u8ba1\u5212\u516c\u4e4b\u4e8e\u4f17\uff0c",
    "image": "https:\/\/ww1.sinaimg.cn\/bmiddle\/006cSmwjgw1ezhfldti8jj307j04jjri.jpg",
    "author": "ETF\u62ef\u6551\u4e16\u754c",
    "card_ad": false,
    "comment": true,
    "ispay": 0,
    "third_module": true,
    "copyright": 0
  },
  "scripts": "",
  "title": "投资指数才是你进行金融投资的最佳方式",
  "version": "3"
}

/**
 * 仅用于记录, 作为微博被删除的示例
 */
type TypeDeleteWeiboRecordDemo = {
  visible: {
    /**
     * 0 => 已被删除/只在半年内可见
     * 1 => 你没有查看这条微博的权限
     */
    type: 0 | 1
    list_id: 0
  }
  created_at: '08-16'
  id: '4405996207851235'
  idstr: '4405996207851235'
  mid: '4405996207851235'
  text: "抱歉，此微博已被作者删除。查看帮助：<a href='http://t.cn/Rfd3rQV' data-hide=''><span class='url-icon'><img style='width: 1rem;height: 1rem' src='//h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png'></span> <span class='surl-text'>网页链接</span></a>"
  state: 7
  deleted: '1'
  weibo_position: 2
  show_attitude_bar: 0
  retweeted: 1
  user: null
  bid: 'I2vZiwWsP'
  source: ''
}

/**
 * 仅用于记录, 作为被隐藏微博的示例
 */
type TypePrivateWeiboRecordDemo = {
  visible: { type: 0; list_id: 3; list_idstr: '3' }
  created_at: '2010-06-18'
  id: '20110061812539159'
  idstr: '730379578'
  mid: '20110061812539159'
  text: '抱歉，作者已设置仅展示半年内微博，此微博已不可见。 '
  retweeted: 1
  user: null
  bid: '1b1AKe'
  source: ''
}

export type TypeWeiboListByDay = {
  /**
   * 微博列表
   */
  weiboList: Array<TypeMblog>
  /**
   * 时间(当天0点0分)
   */
  dayStartAt: number
  /**
   * 分类标记
   */
  splitByStr: string
  /**
   * 文件名.
   * 如果分卷模式为count, 则文件名为`${开始日期}-${结束日期}`
   * 如果分卷模式为其他, 则文件名为`${记录所在日期}`
   */
  title: string
  /**
   * 容器内微博开始时间
   */
  postStartAt: number
  /**
   * 容器内微博结束时间
   */
  postEndAt: number
}
export type TypeWeiboEpub = {
  weiboDayList: Array<TypeWeiboListByDay>
  // 作者信息. 便于生成封面等信息
  userInfo: TypeWeiboUserInfo
  // 作者名
  screenName: string
  startDayAt: number
  endDayAt: number
  // 本书是第几本
  bookIndex: number
  // 总共几本
  totalBookCount: number
  // 书中总共包含微博数
  mblogInThisBookCount: number
  // 收集到的总微博数
  totalMblogCount: number
}
