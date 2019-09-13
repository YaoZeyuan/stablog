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
  show_additional_indication: 0
  text: '【deep state】：有律政司檢控官被指在Facebook留言，評論示威者的衝擊行動及批评警方施暴，又教示威者一旦被捕应如何应对，被質疑是教人逃避調查 <a data-url="http://t.cn/AiEZXFBd" target="_blank" href="https://weibo.cn/sinaurl/blocked4620e555?url=https%3A%2F%2Fhk.on.cc%2Fhk%2Fbkn%2Fcnt%2Fnews%2F20190907%2Fbkn-20190907174035149-0907_00822_001.html&luicode=10000011&lfid=1076031221171697&u=https%3A%2F%2Fhk.on.cc%2Fhk%2Fbkn%2Fcnt%2Fnews%2F20190907%2Fbkn-20190907174035149-0907_00822_001.html" class=""><span class=\'url-icon\'><img style=\'width: 1rem;height: 1rem\' src=\'//h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_web_default.png\'></span><span class="surl-text">网页链接</span></a> <a data-url="http://t.cn/RU1yWf5" href="https://m.weibo.cn/p/index?containerid=23065700428004400000000000030&luicode=10000011&lfid=1076031221171697" data-hide=""><span class=\'url-icon\'><img style=\'width: 1rem;height: 1rem\' src=\'https://h5.sinaimg.cn/upload/2015/09/25/3/timeline_card_small_location_default.png\'></span><span class="surl-text">英国·伦敦</span></a> '
  textLength: 177
  source: '大型肉兔iPhone 7 Plus'
  favorited: false
  pic_types: '0,0,0,0,0'
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
  isLongText: false
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
}

export type TypeWeiboRecord = {
  card_type: 9
  itemid: '1076031221171697_-_4414052358656728'
  scheme: 'https://m.weibo.cn/status/I5Tz5Ak0E?mblogid=I5Tz5Ak0E&luicode=10000011&lfid=1076031221171697'
  mblog: TypenWeiboRecord_Mblog
  show_type: 0
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
