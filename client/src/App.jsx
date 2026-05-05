import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, cryptoReady } = useAuth();
  if (!user || !cryptoReady) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, cryptoReady } = useAuth();
  if (user && cryptoReady) return <Navigate to="/chat" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={
        <PublicRoute><LandingPage /></PublicRoute>
      } />
      <Route path="/login" element={
        <PublicRoute><LoginPage /></PublicRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute>
          <ChatProvider><ChatPage /></ChatProvider>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
