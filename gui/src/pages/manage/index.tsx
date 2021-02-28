import './index.less';
import { remote } from 'electron';
import TypeWeibo from '@/../../src/type/namespace/weibo';
import { useState, useEffect } from 'react';
import { enableMapSet } from 'immer';
enableMapSet();
import produce from 'immer';
import { Table } from 'antd';

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
    Map<number, TypeWeibo.TypeWeiboUserInfo>
  >(produce(new Map(), (raw) => raw));
  let [
    blogDistributionMap,
    setBlogDistributionMap,
  ] = useState<BlogDistributionMap>(new Map());

  let [isLoading, setIsLoading] = useState<boolean>(false);
  let [selectUserId, setSelectUserId] = useState<string>('');

  let [$$storageSelect, set$$StorageSelect] = useState<{
    year: string;
    month: string;
    day: string;
    yearList: string[];
    monthList: string[];
    blogList: TypeWeibo.TypeMblog[];
  }>(
    produce(
      {
        year: '',
        month: '',
        day: '',
        yearList: [],
        monthList: [],
        blogList: [],
      },
      (raw) => raw,
    ),
  );

  /**
   * 获取用户信息列表
   */
  async function asyncFetchUserInfoList() {
    let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = await MUser.asyncGetUserList();
    console.log('fetchUserInfoList => ', userInfoList);
    for (let record of userInfoList) {
      set$$UserDatabase(($$oldDatabase) => {
        return produce($$oldDatabase, (raw) => {
          raw.set(record.id, record);
        });
      });
    }
  }
  async function asyncGetDistribute() {
    setIsLoading(true);
    let distributionMap = (await MBlog.asyncGetWeiboDistribution(
      selectUserId,
    )) as BlogDistributionMap;
    setIsLoading(false);
    // 必须要手工转成obj
    setBlogDistributionMap(distributionMap);
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

  async function asyncHandleSelectChange(
    currentRow: TypeWeibo.TypeWeiboUserInfo,
    oldCurrentRow: TypeWeibo.TypeWeiboUserInfo,
  ) {
    setSelectUserId(`${currentRow.id}`);
    // 清空旧选项
    // this.resetSelect()
    await asyncGetDistribute();
  }

  // 支持点选
  async function asyncHandleStorageSelectInTable(row: BlogDistributionItem) {
    if (row.type === 'year') {
      set$$StorageSelect(
        produce($$storageSelect, (raw) => {
          raw.year = row.date;
          raw.blogList = [];
        }),
      );
    }
    if (row.type === 'month') {
      set$$StorageSelect(
        produce($$storageSelect, (raw) => {
          raw.month = row.date;
          raw.blogList = [];
        }),
      );
    }
    if (row.type === 'day') {
      let startAt = row.startAt;
      let endAt = row.startAt + 86400 - 1;
      let blogList = await asyncGetBlogListInRange(startAt, endAt);
      set$$StorageSelect(
        produce($$storageSelect, (raw) => {
          raw.day = row.date;
          raw.blogList = blogList;
        }),
      );
    }
  }

  /**
   * 重置选择
   */
  function resetSelect() {
    set$$StorageSelect(
      produce(
        {
          year: '',
          month: '',
          day: '',
          yearList: [],
          monthList: [],
          blogList: [],
        },
        (raw) => raw,
      ),
    );
  }

  useEffect(() => {
    asyncFetchUserInfoList();
  }, []);

  let userInfoList: TypeWeibo.TypeWeiboUserInfo[] = [];
  for (let key of $$userDatabase.keys()) {
    let record = $$userDatabase.get(key);
    userInfoList.push(record);
  }

  return (
    <div className="manager-container">
      <Table
        columns={[
          {
            title: '已缓存账号',
            dataIndex: 'screen_name',
            key: 'screen_name',
            render: (text, record: TypeWeibo.TypeWeiboUserInfo, index) => {
              return (
                <div  className="user-info" key={record.id}>
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
    </div>
  );
}
