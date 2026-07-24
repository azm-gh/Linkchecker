import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { Toaster } from 'sonner';
import { AnimatePresence } from 'motion/react';

import Auth from './components/Auth';
import Layout from './components/Layout';
import Scanner from './components/Scanner';
import History from './components/History';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('scanner'); // 'scanner' or 'history'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        const t = await currentUser.getIdToken();
        setToken(t);
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <>
      {/* Sonner setup for premium toasts */}
      <Toaster 
        theme="dark" 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: 'var(--panel-bg)',
            border: '1px solid var(--panel-border)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }
        }}
      />
      
      {!user ? (
        <Auth />
      ) : (
        <Layout user={user} currentView={currentView} setCurrentView={setCurrentView}>
          <AnimatePresence mode="wait">
            {currentView === 'scanner' ? (
              <Scanner key="scanner" token={token} />
            ) : (
              <History key="history" token={token} />
            )}
          </AnimatePresence>
        </Layout>
      )}
    </>
  );
}

export default App;
