import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Scanner({ token }) {
  const [url, setUrl] = useState('');
  const [concurrency, setConcurrency] = useState(50);
  const [delay, setDelay] = useState(0.0);
  
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ total: 0, alive: 0, dead: 0, timeMs: 0 });
  
  const wsRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startScan = (e) => {
    e.preventDefault();
    if (!url) return;

    // Reset state
    setResults([]);
    setStats({ total: 0, alive: 0, dead: 0, timeMs: 0 });
    setIsScanning(true);
    setStatus('Connecting...');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // For local dev, point to port 8000. In prod, point to host
    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'localhost:8000' 
      : window.location.host;
      
    wsRef.current = new WebSocket(`${protocol}//${host}/ws/scan`);

    wsRef.current.onopen = () => {
      setStatus('Starting scan...');
      wsRef.current.send(JSON.stringify({ url, concurrency, delay, token }));
    };

    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      
      if (response.type === 'init') {
        setStatus(response.data.message);
        setStats(prev => ({ ...prev, total: response.data.total_links }));
      } 
      else if (response.type === 'progress') {
        const res = response.data;
        setResults(prev => [res, ...prev]);
        setStats(prev => ({
          ...prev,
          alive: res.is_alive ? prev.alive + 1 : prev.alive,
          dead: !res.is_alive ? prev.dead + 1 : prev.dead
        }));
      }
      else if (response.type === 'summary') {
        setStatus('Scan Complete!');
        setStats(prev => ({ ...prev, timeMs: response.data.total_time_ms }));
        setIsScanning(false);
        toast.success("Scan completed successfully!");
      }
      else if (response.type === 'error') {
        setStatus(`Error: ${response.message}`);
        setIsScanning(false);
        toast.error("Scan Error", { description: response.message });
      }
    };

    wsRef.current.onerror = () => {
      setStatus('WebSocket connection error.');
      setIsScanning(false);
      toast.error("Connection Error");
    };
    
    wsRef.current.onclose = () => {
      setIsScanning(false);
    };
  };

  const downloadCsv = () => {
    if (results.length === 0) return;
    
    let csvContent = "Target URL,Status,Response Time (ms),Error\n";
    // We reverse results here because we prepend them to the array for the UI
    [...results].reverse().forEach(r => {
      const safeUrl = `"${r.target_url.replace(/"/g, '""')}"`;
      const status = r.status_code || '';
      const error = r.error_message ? `"${r.error_message.replace(/"/g, '""')}"` : '';
      csvContent += `${safeUrl},${status},${r.response_time_ms},${error}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "scan_results.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <form onSubmit={startScan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Target URL</label>
            <input 
              type="url" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://example.com" 
              required 
              disabled={isScanning}
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>Concurrency</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{concurrency}</span>
              </label>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={concurrency} 
                onChange={e => setConcurrency(e.target.value)} 
                disabled={isScanning}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>Delay (seconds)</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{delay}s</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="5" 
                step="0.1" 
                value={delay} 
                onChange={e => setDelay(e.target.value)} 
                disabled={isScanning}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>
          
          <button className="primary" type="submit" disabled={isScanning}>
            {isScanning ? 'Scanning...' : 'Start Scan'}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ textAlign: 'center', marginBottom: '24px', color: status.includes('Error') ? 'var(--error)' : (status === 'Scan Complete!' ? 'var(--success)' : 'var(--accent-primary)'), fontWeight: 'bold' }}
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isScanning || results.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel" 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Scanned</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alive</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.alive}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dead</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--error)' }}>{stats.dead}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.timeMs ? `${stats.timeMs}ms` : '-'}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(!isScanning && results.length > 0) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button onClick={downloadCsv} style={{ background: 'var(--accent-secondary)', color: 'white' }}>
            Download CSV
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Target URL</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${r.is_alive ? 'success' : 'error'}`}>
                        {r.is_alive ? `${r.status_code} OK` : (r.error_message === 'Timeout' ? 'TIMEOUT' : `${r.status_code || ''} ERROR`)}
                      </span>
                    </td>
                    <td><span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>{r.response_time_ms}ms</span></td>
                    <td>
                      <a href={r.target_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                        {r.target_url}
                      </a>
                    </td>
                    <td style={{ color: 'var(--error)' }}>{r.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
