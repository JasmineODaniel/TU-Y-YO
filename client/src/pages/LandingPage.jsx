import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();

  const logoSvg = (
    <svg width="120" height="80" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 20 H 26" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 14 C 28 14 28 26 20 26" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M55 20 H 34" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 14 C 32 14 32 26 40 26" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="30" cy="20" r="2" fill="var(--text-primary)" />
    </svg>
  );

  return (
    <div className="landing-page" style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-header)',
      color: 'white',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ marginBottom: '40px' }}
      >
        {logoSvg}
        <h1 style={{ 
          fontFamily: "'Michroma', sans-serif", 
          fontSize: '3rem', 
          marginTop: '20px',
          letterSpacing: '4px'
        }}>TU-Y-YO</h1>
        <p style={{ opacity: 0.7, fontSize: '1.2rem', marginTop: '10px' }}>End-to-End Encrypted Messaging</p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        style={{ display: 'flex', gap: '20px' }}
      >
        <button 
          onClick={() => navigate('/login')}
          style={{
            padding: '12px 30px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'white',
            color: 'var(--bg-header)',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          Sign In
        </button>
        <button 
          onClick={() => navigate('/login?mode=signup')}
          style={{
            padding: '12px 30px',
            borderRadius: 'var(--radius-md)',
            border: '2px solid white',
            background: 'transparent',
            color: 'white',
            fontWeight: '600',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'white';
            e.target.style.color = 'var(--bg-header)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = 'white';
          }}
        >
          Create Account
        </button>
      </motion.div>

      <div style={{ position: 'absolute', bottom: '30px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span style={{ fontSize: '0.9rem' }}>Secure & Encrypted</span>
      </div>
    </div>
  );
}
