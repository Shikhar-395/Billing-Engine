import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authClient } from '../lib/auth';

const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';

function redirectTo(path: string) {
  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to create your account right now.';
}

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError('');

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || 'Unable to create your account.');
      }

      redirectTo('/onboarding');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsPending(false);
    }
  };

  const handleGoogle = async () => {
    setIsPending(true);
    setError('');

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });
    } catch (socialError) {
      setError(getErrorMessage(socialError));
      setIsPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-copy">
          <span className="eyebrow">Create account</span>
          <h1>Create your account, then set up your billing workspace.</h1>
          <p>After sign-up, you will create your company tenant and land in the dashboard.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="signup-name">
            Full name
          </label>
          <input
            id="signup-name"
            className="form-input"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ava Patel"
            required
          />

          <label className="form-label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            className="form-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />

          <label className="form-label" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            className="form-input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            required
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isPending}>
            {isPending ? <div className="spinner" /> : null}
            Create account
          </button>
        </form>

        {googleAuthEnabled ? (
          <button className="btn btn-secondary auth-submit" type="button" onClick={handleGoogle} disabled={isPending}>
            Continue with Google
          </button>
        ) : null}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
