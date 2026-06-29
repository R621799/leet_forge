import Credentials from "./frontend/pages/login.jsx"
import Quiz from './frontend/pages/quiz.jsx'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Credentials />} />
        <Route path="/quiz" element={<Quiz/>} />
      </Routes>
    </BrowserRouter>
  );
}