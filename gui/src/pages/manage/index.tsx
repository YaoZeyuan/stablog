import './index.less';
import { remote } from 'electron';
import TypeWeibo from '@/../../src/type/namespace/weibo';
import { useState, useEffect } from 'react';
import { enableMapSet } from 'immer';
enableMapSet();
import produce from 'immer';
import { Table, Card, Select } from 'antd';
import Util from '@/library/util';
let Option = Select.Option;
let MUser = remote.getGlobal('mUser');
let MBlog = remote.getGlobal('mBlog');

type BlogDistributionItem = {
  date: string;
  key: string;
  type: 'year' | 'month' | 'day';
  startAt: number;
  count: number;
  childrenMap: BlogDistributionObj;
};

type BlogDistributionObj = { [key: string]: BlogDistributionItem };

const Const_Default_Storage_Select: {
  year: string;
  month: string;
  day: string;
  yearList: string[];
  monthList: string[];
  blogList: TypeWeibo.TypeMblog[];
} = {
  year: '',
  month: '',
  day: '',
  yearList: [],
  monthList: [],
  blogList: [],
};

export default function IndexPage() {
  let [$$userDatabase, set$$UserDatabase] = useState<
    Map<string, TypeWeibo.TypeWeiboUserInfo>
  >(produce(new Map(), (raw) => raw));
  let [
    blogDistributionObj,
    setBlogDistributionObj,
  ] = useState<BlogDistributionObj>({});

  let [isLoading, setIsLoading] = useState<boolean>(false);
  let [selectUserId, setSelectUserId] = useState<string>('');

  let [$$storageSelect, set$$StorageSelect] = useState<{
    year: string;
    month: string;
    day: string;
    yearList: string[];
    monthList: string[];
    blogList: TypeWeibo.TypeMblog[];
  }>(produce(Const_Default_Storage_Select, (raw) => raw));

  /**
   * 获取用户信息列表
   */
  async function asyncFetchUserInfoList() {
    let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = await MUser.asyncGetUserList();
    for (let record of userInfoList) {
      set$$UserDatabase(($$oldDatabase) => {
        return produce($$oldDatabase, (raw) => {
          raw.set(`${record.id}`, record);
        });
      });
    }
  }
  async function asyncGetDistribute() {
    setIsLoading(true);
    console.log('start to load distributionMap');
    let distributionObj: BlogDistributionObj = await MBlog.asyncGetWeiboDistribution(
      selectUserId,
    );
    await Util.asyncSleepMs(1000);
    console.log(
      'distributionMap has load complete, distributionMap.size => ',
      distributionObj,
    );
    // distributionObj.forEach((item) => console.log(item));
    setIsLoading(false);
    // 必须要手工转成obj
    setBlogDistributionObj(distributionObj);

    set$$StorageSelect(
      produce(Const_Default_Storage_Select, (raw) => {
        raw.yearList = Object.keys(distributionObj);
      }),
    );
    console.log('setBlogDistributionMap');
    // 初始化年份列表
    // if (distributionMap.size === 0) {
    //   console.log('distributionMap size => 0');
    //   set$$StorageSelect(() => {
    //     return produce(Const_Default_Storage_Select, (raw) => raw);
    //   });
    // } else {
    //   console.log('distributionMap size !== 0');
    //   let yearList: string[] = [];
    //   if (distributionMap) {
    //     console.log('distributionMap =>', distributionMap);
    //     // console.log('distributionMap.values =>', distributionMap.values());
    //     for (let item of Object.keys(distributionMap)) {
    //       console.log('item.date => ', item);
    //       yearList.push(distributionMap[item].date);
    //     }
    //     console.log('yearList => ', yearList);
    //     // distributionMap.forEach((item) => {
    //     //   let date = item.date;
    //     //   console.log('date => ', date);
    //     //   yearList.push(date);
    //     // });

    //     set$$StorageSelect(() => {
    //       console.log('start set storage');

    //       return produce(Const_Default_Storage_Select, (raw) => {
    //         raw.yearList = yearList;
    //         raw.year = yearList[0];

    //         if (raw.year) {
    //           let monthList: string[] = [];
    //           for (let month of Object.keys(
    //             distributionMap[raw.year].childrenMap,
    //           )) {
    //             monthList.push(month);
    //           }
    //           raw.monthList = monthList;
    //           raw.month = monthList[0] || '';
    //         }
    //       });
    //     });
    //   }
    // }
  }

  /**
   * 获取当天微博数据列表
   */
  async function asyncGetBlogListInRange(startAt: number, endAt: number) {
    let blogList = (await MBlog.asyncGetMblogList(
      selectUserId,
      startAt,
      endAt,
    )) as TypeWeibo.TypeMblog[];
    return blogList;
  }

  // 支持点选
  async function asyncHandleStorageSelectInTable(
    selectDate: string,
    type: 'year' | 'month' | 'day',
  ) {
    if (type === 'year') {
      let rowItem = blogDistributionObj[selectDate];

      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.year = rowItem.date;
          let rawMonthItemList: BlogDistributionItem[] = [];
          for (let key of Object.keys(rowItem.childrenMap)) {
            rawMonthItemList.push(rowItem.childrenMap[key]);
          }
          rawMonthItemList.sort(
            (a: BlogDistributionItem, b: BlogDistributionItem) => {
              // 从object中取出的数据顺序是乱的, 手工排序一下
              return a.startAt - b.startAt;
            },
          );
          raw.monthList = rawMonthItemList.map((item) => item.date);
          raw.month = '';
          raw.blogList = [];
        });
      });
    }
    if (type === 'month') {
      let rowItem =
        blogDistributionObj[$$storageSelect.year].childrenMap[selectDate];

      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.month = rowItem.date;
          raw.blogList = [];
        });
      });
    }
    if (type === 'day') {
      let row =
        blogDistributionObj[$$storageSelect.year].childrenMap[
          $$storageSelect.month
        ].childrenMap[selectDate];

      let startAt = row.startAt;
      let endAt = row.startAt + 86400 - 1;
      let blogList = await asyncGetBlogListInRange(startAt, endAt);
      set$$StorageSelect(($$storageSelect) => {
        return produce($$storageSelect, (raw) => {
          raw.day = row.date;
          raw.blogList = blogList;
        });
      });
    }
  }

  /**
   * 重置选择
   */
  function resetSelect() {
    set$$StorageSelect(() => {
      return produce(Const_Default_Storage_Select, (raw) => raw);
    });
  }

  useEffect(() => {
    asyncFetchUserInfoList();
  }, []);

  useEffect(() => {
    if ($$userDatabase.has(selectUserId)) {
      asyncGetDistribute();
      resetSelect();
    }
  }, [selectUserId]);

  let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = [];
  for (let key of $$userDatabase.keys()) {
    let record = $$userDatabase.get(key);
    userInfoList.push(record);
  }

  let currentUserInfo = $$userDatabase.get(selectUserId);

  let yearOptionEleList = $$storageSelect.yearList.map((item, index) => {
    return (
      <Option value={item} key={index}>
        {item}
      </Option>
    );
  });
  let yearSelectEle = (
    <Select
      className="year-select"
      value={$$storageSelect.year}
      onSelect={(selectDate: string) => {
        asyncHandleStorageSelectInTable(selectDate, 'year');
      }}
    >
      {yearOptionEleList}
    </Select>
  );
  let monthOptionEleList = $$storageSelect.monthList.map((item, index) => {
    return (
      <Option value={item} key={index}>
        {item}
      </Option>
    );
  });
  let monthSelectEle = (
    <Select
      className="month-select"
      value={$$storageSelect.month}
      onSelect={(selectDate: string) => {
        asyncHandleStorageSelectInTable(selectDate, 'month');
      }}
    >
      {monthOptionEleList}
    </Select>
  );

  console.log('blogDistributionObj => ', blogDistributionObj);

  function getSummaryList() {
    if (Object.keys(blogDistributionObj).length === 0) {
      return [];
    }
    const { year, month } = $$storageSelect;
    let summaryList: BlogDistributionItem[] = [];
    if (year === '') {
      // 按年展示
      Object.keys(blogDistributionObj).forEach((year_str) => {
        summaryList.push(blogDistributionObj[year_str]);
      });
      return summaryList;
    }
    if (month === '') {
      // 按月展示
      let yearDistributionObj = blogDistributionObj[year]['childrenMap'];
      Object.keys(yearDistributionObj).forEach((month_str) => {
        summaryList.push(yearDistributionObj[month_str]);
      });
      return summaryList;
    }
    // 按天展示
    let monthDistributionObj =
      blogDistributionObj[year]['childrenMap'][month]['childrenMap'];
    Object.keys(monthDistributionObj).forEach((day_str) => {
      summaryList.push(monthDistributionObj[day_str]);
    });
    return summaryList;
  }

  let rawSummaryList = getSummaryList();
  rawSummaryList.sort((a, b) => {
    // 从object中取出的数据顺序是乱的, 手工排序一下
    return a.startAt - b.startAt;
  });
  let weiboStorageSummaryList = rawSummaryList;
  console.log('weiboStorageSummaryList => ', weiboStorageSummaryList);

  return (
    <div className="manager-container">
      <Card title="Card title">
        <Table
          onRow={(record) => {
            return {
              onClick: () => {
                setSelectUserId(`${record.id}`);
              },
            };
          }}
          columns={[
            {
              title: '已缓存账号',
              dataIndex: 'screen_name',
              key: 'screen_name',
              render: (text, record: TypeWeibo.TypeWeiboUserInfo, index) => {
                return (
                  <div className="user-info" key={record.id}>
                    <img
                      alt={record.screen_name}
                      src={record.avatar_hd}
                      className="avatar"
                    />
                    <div className="name">{record.screen_name}</div>
                    <div className="id">({record.id})</div>
                  </div>
                );
              },
            },
            {
              title: '个人简介',
              dataIndex: 'description',
              key: 'description',
            },
          ]}
          dataSource={userInfoList}
          pagination={false}
        ></Table>
      </Card>
      <Card
        title={
          currentUserInfo?.screen_name
            ? `${currentUserInfo?.screen_name} 已完成备份的微博列表`
            : ''
        }
      >
        {yearSelectEle}
        {monthSelectEle}
        <Table
          dataSource={weiboStorageSummaryList}
          columns={[
            {
              title: '日期',
              dataIndex: 'date',
              key: 'date',
            },
            {
              title: '微博数量',
              dataIndex: 'count',
              key: 'count',
            },
          ]}
          onRow={(record, index) => {
            return {
              onClick: () => {
                let selectType = record.type;
                switch (selectType) {
                  case 'year':
                    asyncHandleStorageSelectInTable(record.date, 'year');
                    break;
                  case 'month':
                    asyncHandleStorageSelectInTable(record.date, 'month');
                    break;
                  case 'day':
                    asyncHandleStorageSelectInTable(record.date, 'day');
                    break;
                }

                console.log(`click ${index} => `, record);
              },
            };
          }}
        ></Table>
      </Card>
    </div>
  );
}
