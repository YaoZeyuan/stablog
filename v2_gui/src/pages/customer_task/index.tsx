import React, { useEffect, useState } from 'react';
import process from 'immer';
import {
  Form,
  Input,
  InputNumber,
  Button,
  Checkbox,
  Descriptions,
  Slider,
  Divider,
  Radio,
  DatePicker,
  Select,
  Switch,
  Modal,
} from 'antd';
import './index.less';

import _ from 'lodash';
import moment from 'moment';
import fs from 'fs';
import http from '@/library/http';
import util from '@/library/util';
import querystring from 'query-string';
import packageConfig from '@/../../package.json';
import { TypeTaskConfig } from './task_type';
import * as TaskUtils from './utils';

let currentVersion = parseFloat(packageConfig.version);

let TaskConfigType = TypeTaskConfig;

const electron = require('electron');
const shell = electron.shell;
const ipcRenderer = electron.ipcRenderer;
const remote = electron.remote;

let pathConfig = remote.getGlobal('pathConfig');

const { RangePicker } = DatePicker;
const { Option } = Select;

type TypeState = {
  isLogin: boolean;
  showUpgradeInfo: boolean;
  remoteVersionConfig: {
    version: number;
    downloadUrl: string;
    releaseAt: string;
    releaseNote: string;
  };
};

type TypeDatabase = {
  taskConfig: TypeTaskConfig.Customer;
  currentUserInfo: {
    screen_name: string;
    statuses_count: number;
    total_page_count: number;
    followers_count: number;
  };
};

const Order: {
  由旧到新: 'asc';
  由新到旧: 'desc';
} = {
  由旧到新: 'asc',
  由新到旧: 'desc',
};
const ImageQuilty = {
  无图: 'none',
  默认: 'default',
};
const PdfQuilty: { [key: string]: 50 | 60 | 70 | 90 | 100 } = {
  '50': 50,
  '60': 60,
  '70': 70,
  '90': 90,
  '100': 100,
};

const Translate_Image_Quilty = {
  [TaskConfigType.CONST_Image_Quilty_默认]: '默认',
  [TaskConfigType.CONST_Image_Quilty_无图]: '无图',
};

const defaultConfigItem = {
  uid: '',
  rawInputText: '',
  comment: '',
};
const MergeBy: { [key: string]: string } = {
  ['年']: 'year',
  ['月']: 'month',
  ['日']: 'day',
  ['微博条数']: 'count',
};

let taskConfig: TypeTaskConfig.Customer = {
  configList: [_.clone(defaultConfigItem)],
  imageQuilty: TaskConfigType.CONST_Image_Quilty_默认,
  pdfQuilty: PdfQuilty['60'],
  maxBlogInBook: 100000,
  postAtOrderBy: TaskConfigType.CONST_Order_Asc,
  bookTitle: '',
  comment: '',
  mergeBy: TaskConfigType.CONST_Merge_By_月,
  mergeCount: 1000,
  fetchStartAtPageNo: 0,
  fetchEndAtPageNo: 100000,
  outputStartAtMs: moment('2010-01-01 00:00:00').unix() * 1000,
  outputEndAtMs: moment().add(1, 'year').unix() * 1000,
  isSkipFetch: false,
  isSkipGeneratePdf: false,
};
if (taskConfig.configList.length === 0) {
  // 如果没有数据, 就要手工补上一个, 确保数据完整
  taskConfig.configList.push(_.clone(defaultConfigItem));
}

// 基于配置文件作为初始值
let jsonContent = util.getFileContent(pathConfig.customerTaskConfigUri);
try {
  taskConfig = JSON.parse(jsonContent);
} catch (e) {}
// 始终重置为次日
taskConfig.outputEndAtMs = moment().add(1, 'day').unix() * 1000;
if (taskConfig.configList.length === 0) {
  taskConfig.configList.push(_.clone(defaultConfigItem));
}

export default function IndexPage() {
  const [form] = Form.useForm();
  const [$$status, set$$Status] = useState<TypeState>(
    process(
      {
        isLogin: false,
        showUpgradeInfo: false,
        remoteVersionConfig: {
          version: 1.0,
          downloadUrl: '',
          releaseAt: '',
          releaseNote: '',
        },
      },
      (e) => e,
    ),
  );
  const [$$database, set$$Database] = useState<TypeDatabase>(
    process(
      {
        taskConfig: taskConfig,
        currentUserInfo: {
          screen_name: '',
          statuses_count: 0,
          total_page_count: 0,
          followers_count: 0,
        },
      },
      (e) => e,
    ),
  );
  // 每次database更新后, 重写 taskConfig 配置
  useEffect(() => {
    TaskUtils.saveConfig($$database.taskConfig);
  }, [$$database]);

  const onFinish = (values: any) => {
    console.log('Success:', values);
  };

  let initValue = {
    ...$$database.taskConfig,
    fetchPageNoRange: [
      $$database.taskConfig.fetchStartAtPageNo,
      $$database.taskConfig.fetchEndAtPageNo,
    ],
    outputTimeRange: [
      moment.unix($$database.taskConfig.outputStartAtMs / 1000),
      moment.unix($$database.taskConfig.outputEndAtMs / 1000),
    ],
  };
  console.log('initValue => ', initValue);

  return (
    <div className="customer-task">
      <Modal
        title="发现新版本"
        visible={$$status.showUpgradeInfo}
        onOk={() => {
          set$$Status(
            process($$status, (raw) => {
              raw.showUpgradeInfo = false;
            }),
          );
          TaskUtils.jumpToUpgrade($$status.remoteVersionConfig.downloadUrl);
        }}
        okText="更新"
        onCancel={() => {
          set$$Status(
            process($$status, (raw) => {
              raw.showUpgradeInfo = false;
            }),
          );
        }}
      >
        <p>最新版本:{$$status.remoteVersionConfig.version}</p>
        <p>更新内容:{$$status.remoteVersionConfig.releaseNote}</p>
        <p>更新时间:{$$status.remoteVersionConfig.releaseAt}</p>
      </Modal>
      <Form
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        name="basic"
        form={form}
        onValuesChange={(changedValues, values) => {
          console.log('onValuesChange', changedValues, values);
          set$$Database(
            process($$database, (raw: TypeDatabase) => {
              let updateKey = Object.keys(changedValues)[0];
              switch (updateKey) {
                case 'rawInputText':
                  let rawInput = changedValues['rawInputText'];
                  // 先记录数据, 待点击同步按钮后再更新uid信息
                  raw.taskConfig.configList[0].rawInputText = rawInput;
                  raw.taskConfig.configList[0].uid = '';
                  raw.taskConfig.configList[0].comment = '';
                  break;
                case 'fetchPageNoRange':
                  raw.taskConfig['fetchStartAtPageNo'] =
                    changedValues[updateKey][0];
                  raw.taskConfig['fetchEndAtPageNo'] =
                    changedValues[updateKey][1];
                  break;
                case 'outputTimeRange':
                  raw.taskConfig['outputStartAtMs'] =
                    changedValues[updateKey][0].unix() * 1000;
                  raw.taskConfig['outputEndAtMs'] =
                    changedValues[updateKey][1].unix() * 1000;
                  break;
                case 'mergeBy':
                  raw.taskConfig[updateKey] = changedValues[updateKey].value;
                  break;
                default:
                  raw.taskConfig[updateKey] = changedValues[updateKey];
              }
              console.log('NEW ITEM =>', raw);
            }),
          );
        }}
        initialValues={initValue}
        onFinish={onFinish}
      >
        <Form.Item label="个人主页">
          <div className="flex-container">
            <Form.Item name="rawInputText">
              <Input placeholder="请输入用户个人主页url.示例:https://weibo.com/u/5390490281" />
            </Form.Item>
            <Button
              onClick={async () => {
                // 先获取uidr
                let uid = $$database.taskConfig.configList[0].uid;
                if (uid === '') {
                  uid = await TaskUtils.asyncGetUid(
                    $$database.taskConfig.configList[0].rawInputText,
                  );
                  set$$Database(
                    process($$database, (raw) => {
                      raw.taskConfig.configList[0].uid = uid;
                    }),
                  );
                }
                // 然后更新用户信息
                let userInfo = await TaskUtils.asyncGetUserInfo(uid);
                set$$Database(
                  process($$database, (raw) => {
                    raw.currentUserInfo = userInfo;
                  }),
                );
              }}
            >
              同步用户信息
            </Button>
          </div>
        </Form.Item>

        <Form.Item label="用户信息">
          {$$database.currentUserInfo.screen_name === '' ? (
            '数据待同步'
          ) : (
            <Descriptions bordered>
              <Descriptions.Item label="用户名">
                {$$database.currentUserInfo.screen_name}
              </Descriptions.Item>
              <Descriptions.Item label="微博总数">
                {$$database.currentUserInfo.statuses_count}
              </Descriptions.Item>
              <Descriptions.Item label="待抓取页面数">
                {$$database.currentUserInfo.total_page_count}
              </Descriptions.Item>
              <Descriptions.Item label="备份全部微博预计耗时">
                {Math.floor(
                  ($$database.currentUserInfo.total_page_count * 30) / 60,
                )}
                分钟
              </Descriptions.Item>
              <Descriptions.Item label="粉丝数">
                {$$database.currentUserInfo.followers_count}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Form.Item>
        <Divider>备份配置</Divider>
        <Form.Item label="备份范围">
          <Form.Item name="fetchPageNoRange">
            <Slider range />
          </Form.Item>
          <span>
            从第{$$database.taskConfig.fetchStartAtPageNo}页备份到第
            {$$database.taskConfig.fetchEndAtPageNo}页
          </span>
        </Form.Item>
        <Divider>输出规则</Divider>

        <Form.Item label="微博排序" name="postAtOrderBy">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value={Order.由旧到新}>由旧到新</Radio.Button>
            <Radio.Button value={Order.由新到旧}>由新到旧</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="图片配置" name="imageQuilty">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value={ImageQuilty.无图}>无图</Radio.Button>
            <Radio.Button value={ImageQuilty.默认}>有图</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="自动分卷">
          <div className="flex-container">
            <span>每</span>
            <Form.Item name="maxBlogInBook">
              <InputNumber />
            </Form.Item>
            <span>条微博输出一本电子书</span>
          </div>
        </Form.Item>
        <Form.Item label="时间范围">
          <div className="flex-container">
            <span>只输出从</span>
            <Form.Item name="outputTimeRange">
              <RangePicker picker="date" />
            </Form.Item>

            <span>间发布的微博</span>
          </div>
        </Form.Item>

        <Form.Item label="分页依据">
          <div className="flex-container">
            按
            <Form.Item name="mergeBy">
              <Select labelInValue={false} style={{ width: 120 }}>
                <Option value={MergeBy.年}>年</Option>
                <Option value={MergeBy.月}>月</Option>
                <Option value={MergeBy.日}>日</Option>
                <Option value={MergeBy.微博条数}>微博条数</Option>
              </Select>
            </Form.Item>
            汇集微博
          </div>
        </Form.Item>
        {$$database.taskConfig.mergeBy === MergeBy.微博条数 ? (
          <Form.Item label="分页微博条数">
            , 每
            <Form.Item name="mergeCount">
              <InputNumber
                placeholder="每n条微博一页"
                min={100}
                step={100}
              ></InputNumber>
            </Form.Item>
            条微博一页
          </Form.Item>
        ) : null}
        <Form.Item label="操作">
          <Button>开始备份</Button>
          <Button onClick={TaskUtils.openOutputDir}>打开电子书所在目录</Button>
          <Button
            onClick={async () => {
              let remoteConfig = await TaskUtils.asyncCheckNeedUpdate();
              if (remoteConfig === false) {
                return;
              }
              console.log('remoteConfig => ', remoteConfig);
              set$$Status(
                process($$status, (raw) => {
                  raw.showUpgradeInfo = true;
                  raw.remoteVersionConfig = remoteConfig;
                }),
              );
            }}
          >
            检查更新
          </Button>
        </Form.Item>
        <Divider>高级选项</Divider>
        <Form.Item label="开发者配置">
          <div className="flex-container">
            <Form.Item name="isSkipFetch" valuePropName="checked">
              <Switch></Switch>
            </Form.Item>
            跳过抓取流程, 直接输出电子书
          </div>
          <div className="flex-container">
            <Form.Item name="isSkipGeneratePdf" valuePropName="checked">
              <Switch></Switch>
            </Form.Item>
            只输出网页,不输出pdf文件
          </div>
        </Form.Item>
      </Form>
      <div>
        <pre>{JSON.stringify($$database.taskConfig, null, 4)}</pre>
      </div>
    </div>
  );
}
