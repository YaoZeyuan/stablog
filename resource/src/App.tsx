import React, { Component } from 'react'
import logo from './stablog_logo_256x256.png'
import svg_logo_window from './static/windows.svg'
import svg_logo_mac from './static/mac.svg'
import backgroundSvg from './background.svg'

import './App.less'

export default class Base extends Component {
  state = {
    showMenu: false,
  }

  handleClick = () => {
    this.setState({
      showMenu: true,
    })
  }
  handleClickItem = () => {
    this.setState({
      showMenu: false,
    })
  }

  render() {
    return (
      <div className="Home">

        <div className="body">
          <div className="container">
            <div className="title">稳部落</div>
            <div className="slogan">专业导出备份微博记录</div>
            <div className="desc">一键导出指定用户的所有微博&文章</div>
            <div className="logo">
              <img src={logo} />
            </div>
            <div>
              <div className="download-container">
                <a className="download-button" target="_blank" href="https://dl.motrix.app/release/Motrix-Setup-1.4.1.exe">
                  <img className="download-button-icon" src={svg_logo_window} />Windows版
                </a>
                <a className="download-button" target="_blank" href="https://dl.motrix.app/release/Motrix-Setup-1.4.1.exe">
                  <img className="download-button-icon" src={svg_logo_mac} />Mac版
                </a>
              </div>
            </div>
          </div>
        </div>
        <div className="footer">
          <div className="comment">
            <a className="tip" href="https://github.com/YaoZeyuan/stablog" target="_blank">使用指南</a>
            <a className="tip" href="">致谢列表</a>
            <a className="tip" href="https://github.com/YaoZeyuan/stablog/issues" target="_blank">功能建议</a>
          </div>
        </div>
        <a href="https://github.com/you" className="fork-me-on-github">
          <img
            width="149px" height="149px" src="https://github.blog/wp-content/uploads/2008/12/forkme_right_green_007200.png?resize=149%2C149" alt="Fork me on GitHub" />
        </a>
      </div>
    )
  }
}
