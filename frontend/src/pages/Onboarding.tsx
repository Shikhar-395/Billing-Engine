import { type FormEvent, useState } from 'react';
import { tenantApi, setTenantId } from '../lib/api';
import { useAuthSession } from '../lib/auth';

function redirectTo(path: string) {
  if (typeof window !== 'undefined') {
    window.location.assign(path);
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to create your billing tenant right now.';
}

export default function OnboardingPage() {
  const { data: session } = useAuthSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError('');

    try {
      const tenant = await tenantApi.create({
        name,
        slug,
      });

      setTenantId(tenant.id);
      redirectTo('/');
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-copy">
          <span className="eyebrow">Workspace setup</span>
          <h1>Create the billing tenant for {session?.user.name || 'your account'}.</h1>
          <p>This is the company workspace that will own plans, subscriptions, invoices, payments, webhooks, and audit logs.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="tenant-name">
            Company name
          </label>
          <input
            id="tenant-name"
            className="form-input"
            type="text"
            autoComplete="organization"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Northstar Labs"
            required
          />

          <label className="form-label" htmlFor="tenant-slug">
            Workspace slug
          </label>
          <input
            id="tenant-slug"
            className="form-input"
            type="text"
            value={slug}
            onChange={(event) => setSlug(slugify(event.target.value))}
            placeholder="northstar-labs"
            required
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isPending}>
            {isPending ? <div className="spinner" /> : null}
            Create billing tenant
          </button>
        </form>
      </div>
    </div>
  );
}
