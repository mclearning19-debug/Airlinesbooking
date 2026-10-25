import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { signIn, signUp, useSession } from '../services/auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8; // keep in step with minPasswordLength in server/auth.js (the server enforces it)

// One page for both sign in and create account.
export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState('sign-in');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from ?? '/';
  const creating = mode === 'sign-up';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!isPending && session) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (creating && !form.name.trim()) next.name = 'Enter your name';
    if (!EMAIL.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (creating ? form.password.length < MIN_PASSWORD : !form.password) {
      next.password = creating ? `Use at least ${MIN_PASSWORD} characters` : 'Enter your password';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    setSubmitError('');
    const email = form.email.trim();
    // Better Auth returns { data, error } rather than throwing; network failures can still throw.
    try {
      const { error } = creating
        ? await signUp.email({ name: form.name.trim(), email, password: form.password })
        : await signIn.email({ email, password: form.password });
      if (error) setSubmitError(error.message || 'Something went wrong. Please try again.');
      else navigate(from, { replace: true });
    } catch {
      setSubmitError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card card">
      <form className="form" onSubmit={submit} noValidate>
        <h1>{creating ? 'Create your account' : 'Sign in'}</h1>
        {creating && (
          <label className="field">Name
            <input className={`input ${errors.name ? 'invalid' : ''}`} autoComplete="name" value={form.name} onChange={set('name')} />
            {errors.name && <span className="error">{errors.name}</span>}
          </label>
        )}
        <label className="field">Email
          <input className={`input ${errors.email ? 'invalid' : ''}`} type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          {errors.email && <span className="error">{errors.email}</span>}
        </label>
        <label className="field">Password
          <input className={`input ${errors.password ? 'invalid' : ''}`} type="password"
            autoComplete={creating ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
          {errors.password && <span className="error">{errors.password}</span>}
        </label>
        {submitError && <p className="error-banner" role="alert">{submitError}</p>}
        <button className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted small">
          {creating ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link-button" onClick={() => { setMode(creating ? 'sign-in' : 'sign-up'); setErrors({}); setSubmitError(''); }}>
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </div>
  );
}
