import { useState } from 'react';

// Simple "I'm not a robot" checkbox captcha — works out of the box with zero
// configuration. If you later want full bot-detection, set VITE_RECAPTCHA_SITE_KEY
// and swap this for Google reCAPTCHA v2; the backend already supports either
// (see backend/src/utils/captcha.js).
export default function CheckboxCaptcha({ onChange }) {
  const [checked, setChecked] = useState(false);

  function toggle() {
    const next = !checked;
    setChecked(next);
    onChange(next ? 'checkbox-verified' : null);
  }

  return (
    <label className="captcha-box" onClick={toggle}>
      <input type="checkbox" checked={checked} readOnly />
      <span>I'm not a robot</span>
    </label>
  );
}
