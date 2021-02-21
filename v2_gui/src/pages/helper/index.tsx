import './index.less';



export default function IndexPage() {
  return (
    <div className="help-container">
      <webview
        id="github-readme"
        src="https://github.com/YaoZeyuan/stablog/blob/master/README.md"
      ></webview>
    </div>
  );
}
