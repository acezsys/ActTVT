import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/auth/text-captcha').then(({ data }) => setCaptcha(data));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/reset-password', {
        uid: params.get('uid'),
        token: params.get('token'),
        newPassword,
        challengeToken: captcha.challengeToken,
        captchaAnswer,
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Set a new password</h1>
        {done ? (
          <p>Password updated — redirecting to login…</p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">New password (min. 8 characters)</span>
              <input className="text-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </label>
            {captcha && (
              <label className="field">
                <span className="field-label">{captcha.question}</span>
                <input className="text-input" value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} required />
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" type="submit">Update password</button>
          </>
        )}
        <Link to="/login" className="auth-link">Back to login</Link>
      </form>
    </div>
  );
}
