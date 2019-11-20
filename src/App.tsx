import React, { Component } from 'react';
import logo from './stablog_logo_256x256.png';
import backgroundSvg from './background.svg';
import './App.less';


export default class Base extends Component {
  render() {
    return (
      <div className="Home">
        <div className="header">
          <div className="logo">
            稳部落
          </div>
        </div>
        <div className="body">
          <div className="page-content">
            <div className="logo">
              <img src={logo} />
            </div>
            <div>
              <h1>一款易用的微博备份工具</h1>
              <div>
                支持将指定用户的所有微博记录与微博文章导出为pdf/网页
              </div>
              <div className="download-container">
                <div className="download-button">立即下载</div>
              </div>
            </div>
          </div>
        </div>
      </div >
    );
  }
}
