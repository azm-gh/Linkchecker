import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function History({ token }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8000' 
          : '';
        const res = await fetch(`${host}/api/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        setHistory(data.history || []);
      } catch (err) {
        toast.error("Error fetching history", { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchHistory();
    }
  }, [token]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)' }}>
          <h2 style={{ marginBottom: '8px' }}>Scan History</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Your most recent scans are shown below.
          </p>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Target URL</th>
                <th>Total Scanned</th>
                <th>Broken Links</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>Loading history...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No history found.</td>
                </tr>
              ) : (
                history.map((scan, i) => (
                  <tr key={i}>
                    <td>{new Date(scan.timestamp).toLocaleString()}</td>
                    <td>
                      <a href={scan.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                        {scan.source_url}
                      </a>
                    </td>
                    <td>{scan.total_scanned}</td>
                    <td style={{ color: 'var(--error)', fontWeight: 'bold' }}>{scan.dead_count}</td>
                    <td>{scan.total_time_ms}ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
