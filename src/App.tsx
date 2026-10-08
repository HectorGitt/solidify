import { HashRouter, Route, Routes } from 'react-router-dom'
import { About } from './ui/About'
import { Landing } from './ui/Landing'
import { Viewer } from './ui/Viewer'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/m/:moduleId" element={<Viewer />} />
        <Route path="/m/:moduleId/:sceneId" element={<Viewer />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </HashRouter>
  )
}
