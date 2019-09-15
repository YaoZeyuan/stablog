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

export type TypenWeiboRecord_Mblog = {
  visible: {
    type: 0
    list_id: 0
  }
  created_at: '09-08'
  id: '4414052358656728'
  idstr: '4414052358656728'
  mid: '4414052358656728'
  can_edit: false
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
  textLength: 230
  source: '微博 weibo.com'
  favorited: false
  pic_types: ''

  isTop: 1
  page_info: {
    page_pic: {
      url: 'https://wx4.sinaimg.cn/wap720/48c999f1gy1g6uza6a6qlj20d407egm6.jpg'
    }
    page_url: 'https://media.weibo.cn/article?object_id=1022%3A2309404414789865570479&extparam=lmid--4414789868083942&luicode=10000011&lfid=2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO&id=2309404414789865570479'
    page_title: '香港反对派推促的美国反华法案对香港经济的影响？'
    content1: '香港反对派推促的美国反华法案对香港经济的影响？'
    content2: ''
    icon: 'https://h5.sinaimg.cn/upload/2016/12/28/14/feed_headlines_icon_flash20161228_2.png'
    type: TypePageType
    object_id: '1022:2309404414789865570479'
  }
  title: {
    text: '置顶'
    base_color: 1
  }
  // 微博文章json, 仅当微博为文章类型时, 才添加到数据记录中
  article?: TypeWeiboArticleRecord
  // 被转发的微博
  retweeted_status: TypenWeiboRecord_Mblog | TypeLongTextWeiboRecord
}

export type TypeWeiboRecord = {
  card_type: 9
  itemid: '1076031221171697_-_4414052358656728'
  scheme: 'https://m.weibo.cn/status/I5Tz5Ak0E?mblogid=I5Tz5Ak0E&luicode=10000011&lfid=1076031221171697'
  mblog: TypenWeiboRecord_Mblog
  show_type: 0
  title: ''
}

export type TypeWeiboListResponse = {
  ok: 1
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

export type TypeLongTextWeiboRecord = {
  visible: {
    type: 0
    list_id: 0
  }
  created_at: 'Sun Sep 15 00:35:14 +0800 2019'
  id: '4416583033738594'
  mid: '4416583033738594'
  can_edit: false
  show_additional_indication: 0
  text: '转发一个2014年的新闻作为素材：《全球住房最挤的香港人为何反对开发新区》<br /><a data-url="http://t.cn/Rv0v22h" href="http://finance.sina.com.cn/zl/international/20140618/143219449670.shtml" data-hide=""><span class=\'url-icon\'><img style=\'width: 1rem;height: 1rem\' src=\'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png\'></span><span class="surl-text">全球住房最挤的香港人为何反对开发新区</span></a><br /><br />这里看来，房地产问题之所以不能解决，起因就是“民主”——即非常复杂的deliberation、利益平衡、繁琐的流程，各种社会利益团体再在媒体的渲染系下被政治左右。基本上就是僵局。这种情况在西方民主国家非常常见，譬如说美国，要退出全民医疗保险，这是多少年都推不出来。任何大事都办不成。然后现有的房地产存量结构进一步加强。大规模的政策推行也就越来越难。<br /><br />恒隆董事局主席陈启宗昨天在一个被广泛转载的发布股东信上说，西方模式可能更安全，因为不会把决策寄于一个人。换言之就是把决策寄于一个人风险更大。这个看法不一定准确，因为有的时候，不同人、不同利益团体，有不同的意见，社会严重分化，也一样不能解决问题。但不能解决问题本身，可能会加剧问题，使得问题越来越难解决。<br /><br />人类社会非常复杂，它的运作不是可以重复的科学实验。只要有一项，比如在这个特定历史环境下，因为民主决策问题，导致正确的政策不能推进，那就影响好几代人。而如果少数人集体决策甚至一个人决策之下（比如李光耀在新加坡），就可以惠及几代人。对于大多数人来说这就是几代人的事情。在这个场景下只有现实的利益。比较什么优劣都是理论上的，譬如你可以在五百年之后去对哪个制度好进行评估。在当下的时点，说什么哪个制度更安全，都是扯淡。<br /><br />而且从西方哲学角度来讲，这个论证就不对。什么叫更安全？更安全是结果主义，就是说，你不是按照民主的本原价值去评估民主的价值，而是看它安全不安全，能不能产生更好的决策。那如果我们能够论证说寡头或个人哲学王统治下会产生更好的结果，是不是民主的理据就不成立了？在西方人看来不是这样的。民主是他们认为的基本权利——哪怕民主产生了坏的结果。这叫认赌服输。不忘初心牢记使命，你要宣扬西方民主，就按他们的逻辑。<br /><br />所以这种评价，什么哪个模式更安全更可靠，我觉得就是在当下时点的一个opinion，而且还不谈不上是well-informed，说在话没什么价值。只不过因为他是企业家嗓门大。<br /><br />所以，应该让它评估一下，民主进程对香港房地产的影响。到底是个什么影响。说说看。<br /><br />最后，作为有大历史观的社会观察家，我们需要抽离，去看大历史，客观评估，有些东西没有我们想的那么简单。不用去做太多的价值表达。你的价值表达并不因为你的社会地位（地产家的身份）而比别人跟高级。'
  textLength: 1964
  source: '微博 weibo.com'
  favorited: false
  pic_ids: []
  pic_types: ''
  is_paid: false
  mblog_vip_type: 0
  user: {
    id: 1221171697
    screen_name: '兔主席'
    profile_image_url: 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568490461&ssig=jVuVRWmmGm'
    profile_url: 'https://m.weibo.cn/u/1221171697?uid=1221171697'
    statuses_count: 7026
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
    followers_count: 1070493
    follow_count: 470
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
  reposts_count: 26
  comments_count: 32
  attitudes_count: 59
  pending_approval_count: 0
  isLongText: true
  reward_exhibition_type: 2
  reward_scheme: 'sinaweibo://reward?bid=1000293251&enter_id=1000293251&enter_type=1&oid=4416583033738594&seller=1221171697&share=18cb5613ebf3d8aadd9975c1036ab1f47&sign=09c4b011708498f2228a512b89bb39ee'
  hide_flag: 0
  darwin_tags: []
  mblogtype: 0
  more_info_type: 0
  number_display_strategy: {
    apply_scenario_flag: 3
    display_text_min_number: 1000000
    display_text: '100万+'
  }
  content_auth: 0
  pic_num: 0
  page_info: {
    object_type: 2
    type: 'webpage'
    page_pic: {
      url: 'https://img.t.sinajs.cn/t6/style/images/face/face_card_wb.png'
    }
    page_url: 'http://finance.sina.com.cn/zl/international/20140618/143219449670.shtml?'
    page_title: '全球住房最挤的香港人为何反对开发新区'
    content1: ''
  }
  bid: 'I6XoPfGzU'
  status_title: '转发一个2014年的新闻作为素材...'
  ok: 1
  // 微博文章json, 仅当微博为文章类型时, 才添加到数据记录中
  article?: TypeWeiboArticleRecord
}

export type TypeLongTextWeiboResponse = {
  ok: 1
  data: TypeLongTextWeiboRecord
}

export type TypeWeiboArticleRecord = {
  object_id: '1022:2309404414789865570479'
  title: '香港反对派推促的美国反华法案对香港经济的影响？'
  url: 'https://media.weibo.cn/article?id=2309404414789865570479'
  status: '1'
  object_type: 'article'
  article_type: 'top_article'
  content: '昨天香港反对派（包括同情运动的一般群众及作为运动先锋的连登年轻人等等）'
  use_new_readcount_v3: 1
  biz_exempt: 1
  is_new_style: 1
  dynamic_img_list: ['48c999f1ly1g6tsoj62rmj20jy0aen2y']
  show_dynamic_card: true
  top_info: {
    read_level: 1
    read_type: 0
    fans_level: 2
    fans_type: 0
    max_fans_level: 2
  }
  mid: '4414789868083942'
  wenda_object_id: '1022:2313474414789873958941'
  update_at: '2019-09-11 02:22:18'
  update_ip: '117.136.40.251'
  history: [
    {
      time: '2019-09-11 02:22:18'
      object_id: '1022:2309404415160428134405'
    },
  ]
  read_count_num: 627707
  target_url: 'https://media.weibo.cn/article?id=2309404414789865570479'
  pic_map: {
    'https://wx2.sinaimg.cn/large/48c999f1ly1g6tsoj62rmj20jy0aen2y.jpg': '48c999f1ly1g6tsoj62rmj20jy0aen2y'
    'https://wx4.sinaimg.cn/large/48c999f1ly1g6tsojbfk8j20dd06776h.jpg': '48c999f1ly1g6tsojbfk8j20dd06776h'
  }
  scheme_url: 'sinaweibo://article?object_id=1022:2309404414789865570479'
  show_edit: 1
  userinfo: {
    id: 1221171697
    screen_name: '兔主席'
    profile_image_url: 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568538686&ssig=QEqSlCcSBM'
    verified: true
    verified_type: 0
    verified_reason: '知名历史博主 头条文章作者'
    close_blue_v: false
    description: '大历史。大社会。 独立。理性。批判。建设。'
    gender: 'm'
    follow_me: false
    following: false
    followers_count: '107万'
    cover_image_phone: 'https://tva1.sinaimg.cn/crop.0.0.640.640.640/549d0121tw1egm1kjly3jj20hs0hsq4f.jpg'
    idstr: '1221171697'
    friends_count: 470
    name: '兔主席'
    avatar_large: 'https://tva3.sinaimg.cn/crop.0.0.180.180.180/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg?KID=imgbed,tva&Expires=1568538686&ssig=QEqSlCcSBM'
    avatar_hd: 'https://ww3.sinaimg.cn/orj480/48c999f1jw1e8qgp5bmzyj2050050aa8.jpg'
    vicon: 'yellowv'
    att: 0
    friendships_relation: 0
  }
  created_at: '09.10 01:49'
  follow_button: {
    skip_format: 1
    sub_type: 0
    type: 'follow'
    name: '加关注'
    params: {
      uid: 1221171697
    }
  }
  flow: {
    flow_type: 1
    flow_title: '推荐阅读'
  }
  sharecontent: {
    description: ''
    pic_url: ''
  }
  read_count: '62万+'
  page_id: '2309404414789865570479'
  article_version: 2
  scheme: 'sinaweibo://article?object_id=1022:2309404414789865570479'
  article_fingerprinting: '6f6ee4f5c587fb98807ca8f6ad37c669'
  refresh_placeholder_pic: 'https://h5.sinaimg.cn/upload/1000/48/2018/11/19/iPhone.png'
  edit_scheme: 'sinaweibo://articleedit?oid=1022:2309404414789865570479'
  edit_history_url: 'https://card.weibo.com/article/m/history/list/?showmenu=0#/id=2309404414789865570479'
  created_time: '2019-09-10T01:49:50Z'
  mblog: {
    id: '4414789868083942'
    reposts_count: 453
    comments_count: 825
    attitudes_count: 6152
    scheme_wb: 'sinaweibo://detail?mblogid=4414789868083942&luicode=10000370'
  }
  isMyself: 0
  liked: 0
  reward_users: []
  ok: 1
  msg: '文章内容获取成功'
  exp: {
    uid: null
    isLogin: false
    loginUrl: 'https://passport.weibo.cn/signin/welcome?entry=mweibo&r=https%3A%2F%2Fmedia.weibo.cn%2Farticle%3Fobject_id%3D1022%253A2309404414789865570479%26extparam%3Dlmid--4414789868083942%26luicode%3D10000011%26lfid%3D2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO%26id%3D2309404414789865570479'
    wx_callback: 'https://passport.weibo.com/othersitebind/authorize?entry=h53rdlanding&site=qq&callback=http%3A%2F%2Fmedia.weibo.cn%2Farticle%3Fobject_id%3D1022%253A2309404414789865570479%26extparam%3Dlmid--4414789868083942%26luicode%3D10000011%26lfid%3D2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO%26id%3D2309404414789865570479'
    wx_authorize: 'https://passport.weibo.com/othersitebind/authorize?site=weixin&entry=sinawap&type=normal&callback=http%3A%2F%2Fmedia.weibo.cn%2Farticle%3Fobject_id%3D1022%253A2309404414789865570479%26extparam%3Dlmid--4414789868083942%26luicode%3D10000011%26lfid%3D2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO%26id%3D2309404414789865570479'
    passport_login_url: 'https://passport.weibo.cn/signin/login?entry=mweibo&r=http%3A%2F%2Fmedia.weibo.cn%2Farticle%3Fobject_id%3D1022%253A2309404414789865570479%26extparam%3Dlmid--4414789868083942%26luicode%3D10000011%26lfid%3D2304131221171697_-_WEIBO_SECOND_PROFILE_WEIBO%26id%3D2309404414789865570479'
    deviceType: 'Windows'
    browserType: 'Chrome'
    online: true
    wm: null
    st: false
    isInClient: 0
    isWechat: 0
    hideHeaderBanner: 0
    request_key: '07f922d7d66e5af5576627583b969630'
  }
  token: ''
  rewards: {
    version: '6f2685094e508b25'
    rewardComponent: 'seller=1221171697&bid=1000207805&oid=1022:2309404414789865570479&share=1&access_type=mobileLayer&sign=fa9a82c795aa3c971b5c0adedf4a639f'
    extendParam: 'type=layer&extparam=lmid--4414789868083942'
    displayPayRead: 0
    isreward: 1
  }
  wxConfig: ''
  config: {
    id: '1022:2309404414789865570479'
    extparam: 'lmid--4414789868083942'
    cover_img: 'https://wx4.sinaimg.cn/wap720/48c999f1gy1g6uza6a6qlj20d407egm6.jpg'
  }
  callUinversalLink: true
  callWeibo: true
  amphtml: '<link rel="amphtml" href="https://media.weibo.cn/article/amp?id=2309404414789865570479">'
  scheme_user_profile: 'sinaweibo://userinfo?uid=1221171697&luicode=10000370'
  home_scheme: 'sinaweibo://gotohome?luicode=10000370'
  scheme_wb: 'sinaweibo://detail?mblogid=4414789868083942&luicode=10000370'
  article_scheme: 'sinaweibo://article?object_id=1022:2309404414789865570479&luicode=10000370'
  reward_scheme: 'sinaweibo://article?object_id=1022:2309404414789865570479&pos=1&anchor=reward&luicode=10000370'
  pay_scheme: 'sinaweibo://article?object_id=1022:2309404414789865570479&pos=1&anchor=pay&luicode=10000370'
}
