import { createRoot } from 'react-dom/client'
import App from './pages'

const container = document.getElementById('app')

if (container === null) {
  throw new Error('前端根节点 #app 不存在')
}

createRoot(container).render(<App />)
