import React from 'react';
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
} from 'antd';
import './index.less';

const { RangePicker } = DatePicker;

export default function IndexPage() {
  const [form] = Form.useForm();
  const layout = {
    labelCol: { span: 8 },
    wrapperCol: { span: 16 },
  };
  const tailLayout = {
    wrapperCol: { offset: 8, span: 16 },
  };

  const onFinish = (values: any) => {
    console.log('Success:', values);
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Failed:', errorInfo);
  };
  return (
    <div>
      <Form
        {...layout}
        name="basic"
        form={form}
        initialValues={{ remember: true }}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
      >
        <Form.Item label="个人主页" name="rawInputText">
          <Input placeholder="请输入用户个人主页url.示例:https://weibo.com/u/5390490281" />
          <Button>同步用户信息</Button>
        </Form.Item>
        <Descriptions title="用户信息" bordered>
          <Descriptions.Item label="用户名">Cloud Database</Descriptions.Item>
          <Descriptions.Item label="微博总数">Prepaid</Descriptions.Item>
          <Descriptions.Item label="待抓取页面数">YES</Descriptions.Item>
          <Descriptions.Item label="备份全部微博预计耗时">
            YES
          </Descriptions.Item>
          <Descriptions.Item label="粉丝数">YES</Descriptions.Item>
        </Descriptions>
        <Divider>备份配置</Divider>
        <Form.Item label="备份范围" name="rawInputText">
          <Slider range defaultValue={[20, 50]} />
          从第{20}页备份到第{20}页
        </Form.Item>
        <Divider>输出规则</Divider>
        <Form.Item label="微博排序">
          <Radio.Group defaultValue="a" buttonStyle="solid">
            <Radio.Button value="b">由旧到新</Radio.Button>
            <Radio.Button value="a">由新到旧</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="图片配置">
          <Radio.Group defaultValue="a" buttonStyle="solid">
            <Radio.Button value="b">无图</Radio.Button>
            <Radio.Button value="a">有图</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="自动分卷">
          每<InputNumber />
          条微博输出一本电子书
        </Form.Item>
        <Form.Item label="时间范围">
          只输出从 <RangePicker picker="month" />
          间发布的微博
        </Form.Item>
        <Form.Item label="分页依据">
          按 <RangePicker picker="month" /> 汇集微博
        </Form.Item>
        <Form.Item label="操作">
          <Button>开始备份</Button>
          <Button>打开电子书所在目录</Button>
          <Button>检查更新</Button>
        </Form.Item>
        <Divider>高级功能</Divider>
        <Form.Item label="开发者模式">
          <Checkbox.Group
            options={[
              {
                label: '跳过备份过程, 直接输出电子书',
                value: false,
              },
              {
                label: '只输出网页,不输出pdf文件',
                value: false,
              },
            ]}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
