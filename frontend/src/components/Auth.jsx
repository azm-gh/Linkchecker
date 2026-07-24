import { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
        toast.error("Email not verified", {
          description: "We just sent a new verification link to your inbox."
        });
        auth.signOut();
      } else {
        toast.success("Successfully logged in!");
      }
    } catch (error) {
      toast.error("Login failed", { description: error.message });
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      toast.success("Registration successful!", {
        description: "Please check your email for the verification link."
      });
      auth.signOut();
    } catch (error) {
      toast.error("Registration failed", { description: error.message });
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error("Email required", { description: "Please enter your email to reset your password." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent!", { description: "Check your inbox." });
    } catch (error) {
      toast.error("Reset failed", { description: error.message });
    }
  };

  // Using Emil's rule: never animate from scale(0). Start from 0.95.
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      style={{ maxWidth: '400px', margin: '100px auto', textAlign: 'center' }}
    >
      <h1 style={{ marginBottom: '8px' }}>Link Checker</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        High-performance, concurrent web crawler powered by Python.
      </p>

      <form className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jakub@example.com" 
            required 
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" 
            required 
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button 
            className="primary" 
            onClick={handleLogin} 
            disabled={loading} 
            style={{ flex: 1 }}
          >
            Login
          </button>
          <button 
            type="button"
            onClick={handleRegister} 
            disabled={loading}
            style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white' }}
          >
            Register
          </button>
        </div>

        <button 
          type="button" 
          onClick={handleResetPassword}
          style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '4px', alignSelf: 'center', marginTop: '8px' }}
        >
          Forgot Password?
        </button>
      </form>
    </motion.div>
  );
}
