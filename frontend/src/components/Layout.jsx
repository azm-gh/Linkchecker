import { useState } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, Activity, History, Clock } from 'lucide-react';

export default function Layout({ user, children, currentView, setCurrentView }) {
  
  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 16px' }}>
      
      {/* Header/Nav fixing the previous messy stacked layout */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '32px',
        background: 'rgba(255,255,255,0.02)',
        padding: '16px 24px',
        borderRadius: '12px',
        border: '1px solid var(--panel-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Link Checker</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              {user.email}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--panel-border)', paddingLeft: '24px' }}>
            <button 
              onClick={() => setCurrentView('scanner')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                background: currentView === 'scanner' ? 'var(--accent-primary)' : 'transparent',
                color: currentView === 'scanner' ? 'white' : 'var(--text-secondary)',
                border: currentView === 'scanner' ? 'none' : '1px solid transparent',
              }}
            >
              <Activity size={16} /> Scanner
            </button>
            <button 
              onClick={() => setCurrentView('history')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                background: currentView === 'history' ? 'var(--accent-primary)' : 'transparent',
                color: currentView === 'history' ? 'white' : 'var(--text-secondary)',
                border: currentView === 'history' ? 'none' : '1px solid transparent',
              }}
            >
              <History size={16} /> History
            </button>
            <button 
              onClick={() => setCurrentView('schedules')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '8px',
                background: currentView === 'schedules' ? 'var(--accent-primary)' : 'transparent',
                color: currentView === 'schedules' ? 'white' : 'var(--text-secondary)',
                border: currentView === 'schedules' ? 'none' : '1px solid transparent',
              }}
            >
              <Clock size={16} /> Schedules
            </button>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', 
            background: 'rgba(255,255,255,0.05)', 
            border: '1px solid var(--panel-border)' 
          }}
        >
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main>
        {children}
      </main>

    </div>
  );
}
