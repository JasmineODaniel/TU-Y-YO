import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import './App.css';

function PrivateRoute({ children }) {
  const { user, cryptoReady } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (!cryptoReady) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/chat" /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/chat" /> : <LoginPage />} />
      <Route path="/chat" element={
        <PrivateRoute>
          <ChatProvider>
            <ChatPage />
          </ChatProvider>
        </PrivateRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
