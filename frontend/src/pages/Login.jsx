import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import CheckboxCaptcha from '../components/CheckboxCaptcha';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!captchaToken) return setError('Please confirm the checkbox above.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, captchaToken });
      login(data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>ERM - Arieckal Industries</h1>
        <p className="auth-subtitle">Configured by Prowessz Consulting</p>

        <label className="field">
          <span className="field-label">Email id</span>
          <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input className="text-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <CheckboxCaptcha onChange={setCaptchaToken} />

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
        <Link to="https://www.prowessz.com" className="auth-link">Prowessz Consulting Services LLP</Link>
        </form>
    </div>
  );
}
