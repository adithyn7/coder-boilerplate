import { Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import NotFound from '@/pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/index.html" element={<Navigate to="/" replace />} />
      {/* Add more routes here */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App