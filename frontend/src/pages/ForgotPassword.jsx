import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post('/auth/forgot-password', { email });
    setSent(true);
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Reset password</h1>
        {sent ? (
          <p>If that email is registered, a reset link has been sent. Check your inbox.</p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Your email</span>
              <input className="text-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <button className="btn btn-primary" type="submit">Send reset link</button>
          </>
        )}
        <Link to="/login" className="auth-link">Back to login</Link>
      </form>
    </div>
  );
}
