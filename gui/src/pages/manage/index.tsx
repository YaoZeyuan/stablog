import './index.less';
import { remote } from 'electron';
import TypeWeibo from '@/../../src/type/namespace/weibo';
import { useState, useEffect } from 'react';
import { enableMapSet } from 'immer';
enableMapSet();
import produce from 'immer';
import { Table, Card, Select } from 'antd';
let Option = Select.Option;
let MUser = remote.getGlobal('mUser');
let MBlog = remote.getGlobal('mBlog');

type BlogDistributionItem = {
  date: string;
  key: string;
  type: 'year' | 'month' | 'day';
  startAt: number;
  count: number;
  childrenMap: BlogDistributionMap;
};

type BlogDistributionMap = Map<
  string,
  {
    date: string;
    key: string;
    type: 'year' | 'month' | 'day';
    startAt: number;
    count: number;
    childrenMap: BlogDistributionMap;
  }
>;

export default function IndexPage() {
  let [$$userDatabase, set$$UserDatabase] = useState<
    Map<string, TypeWeibo.TypeWeiboUserInfo>
  >(produce(new Map(), (raw) => raw));
  let [
    blogDistributionMap,
    setBlogDistributionMap,
  ] = useState<BlogDistributionMap>(new Map());

  let [isLoading, setIsLoading] = useState<boolean>(false);
  let [selectUserId, setSelectUserId] = useState<string>('');

  let [storageSelect, setStorageSelect] = useState<{
    year: string;
    month: string;
    day: string;
    yearList: string[];
    monthList: string[];
    blogList: TypeWeibo.TypeMblog[];
  }>({
    year: '',
    month: '',
    day: '',
    yearList: [],
    monthList: [],
    blogList: [],
  });

  /**
   * 获取用户信息列表
   */
  async function asyncFetchUserInfoList() {
    let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = await MUser.asyncGetUserList();
    console.log('fetchUserInfoList => ', userInfoList);
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
    let distributionMap: BlogDistributionMap = await MBlog.asyncGetWeiboDistribution(
      selectUserId,
    );
    setIsLoading(false);
    // 必须要手工转成obj
    setBlogDistributionMap(distributionMap);
    // 初始化年份列表
    if (distributionMap.size === 0) {
      setStorageSelect({
        year: '',
        month: '',
        day: '',
        yearList: [],
        monthList: [],
        blogList: [],
      });
    } else {
      let yearList: string[] = [];
      distributionMap.forEach((item) => {
        let date = item.date;
        yearList.push(date);
      });
      setStorageSelect(() => {
        return {
          year: '',
          month: '',
          day: '',
          yearList: yearList,
          monthList: [],
          blogList: [],
        };
      });
    }
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

  async function asyncHandleSelectChange() {
    // setSelectUserId(`${newSelectUid}`);
    // 清空旧选项
    resetSelect();
    await asyncGetDistribute();
  }

  // 支持点选
  async function asyncHandleStorageSelectInTable(row: BlogDistributionItem) {
    if (row.type === 'year') {
      setStorageSelect({
        ...storageSelect,
        year: row.date,
        blogList: [],
      });
    }
    if (row.type === 'month') {
      setStorageSelect({
        ...storageSelect,
        month: row.date,
        blogList: [],
      });
    }
    if (row.type === 'day') {
      let startAt = row.startAt;
      let endAt = row.startAt + 86400 - 1;
      let blogList = await asyncGetBlogListInRange(startAt, endAt);
      setStorageSelect({
        ...storageSelect,
        day: row.date,
        blogList: blogList,
      });
    }
  }

  /**
   * 重置选择
   */
  function resetSelect() {
    setStorageSelect({
      year: '',
      month: '',
      day: '',
      yearList: [],
      monthList: [],
      blogList: [],
    });
  }

  useEffect(() => {
    asyncFetchUserInfoList();
  }, []);

  useEffect(() => {
    if ($$userDatabase.has(selectUserId)) {
      asyncHandleSelectChange();
    }
  }, [selectUserId]);
  useEffect(() => {
    if ($$userDatabase.has(selectUserId)) {
      // asyncHandleSelectChange();
    }
  }, [blogDistributionMap]);

  let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = [];
  for (let key of $$userDatabase.keys()) {
    let record = $$userDatabase.get(key);
    userInfoList.push(record);
  }

  let currentUserInfo = $$userDatabase.get(selectUserId);
  console.log(`currentUserInfo => `, currentUserInfo);
  console.log(`storageSelect => `, storageSelect);

  let yearOptionEleList = storageSelect.yearList.map((item, index) => {
    console.log('item => ', item);
    return <Option value={item}>{item}</Option>;
  });
  console.log('yearOptionEleList => ', yearOptionEleList);
  let yearSelectEle = <Select>{yearOptionEleList}</Select>;

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
      </Card>
    </div>
  );
}
