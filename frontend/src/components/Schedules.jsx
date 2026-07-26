import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Schedules({ token }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSchedules = async () => {
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : '';
      const res = await fetch(`${host}/api/schedules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      const data = await res.json();
      setSchedules(data.schedules || []);
    } catch (err) {
      toast.error("Error fetching schedules", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSchedules();
    }
  }, [token]);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!url) return;
    setIsSubmitting(true);
    
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : '';
      const res = await fetch(`${host}/api/schedules`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url, frequency })
      });
      
      if (!res.ok) throw new Error('Failed to create schedule');
      
      toast.success("Schedule created successfully!");
      setUrl('');
      await fetchSchedules(); // Refresh the list
    } catch (err) {
      toast.error("Error creating schedule", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (scheduleId) => {
    try {
      const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8000' 
        : '';
      const res = await fetch(`${host}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to delete schedule');
      
      toast.success("Schedule deleted");
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    } catch (err) {
      toast.error("Error deleting schedule", { description: err.message });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <form onSubmit={handleAddSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Create New Schedule</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Target URL</label>
            <input 
              type="url" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://example.com" 
              required 
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Frequency</label>
            <select 
              value={frequency} 
              onChange={e => setFrequency(e.target.value)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <button className="primary" type="submit" disabled={isSubmitting} style={{ marginTop: '8px' }}>
            {isSubmitting ? 'Saving...' : 'Add Schedule'}
          </button>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--panel-border)' }}>
          <h2 style={{ marginBottom: '8px' }}>Active Schedules</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            You will receive an email report whenever these background audits complete.
          </p>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Target URL</th>
                <th>Frequency</th>
                <th>Next Run</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '32px' }}>Loading schedules...</td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>You have no active schedules.</td>
                </tr>
              ) : (
                schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td>
                      <a href={schedule.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                        {schedule.url}
                      </a>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{schedule.frequency}</td>
                    <td>{new Date(schedule.next_run_time).toLocaleString()}</td>
                    <td>
                      <button 
                        onClick={() => handleDelete(schedule.id)}
                        style={{ background: 'transparent', color: 'var(--error)', padding: '4px 8px', border: '1px solid var(--error)' }}
                      >
                        Delete
                      </button>
                    </td>
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
