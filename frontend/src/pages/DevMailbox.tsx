import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, ExternalLink, Copy, Check, Zap, RefreshCw, Inbox } from 'lucide-react';
import { devMailboxApi, devApi } from '../lib/api';
import { relativeTime } from '../lib/utils';
import type { DevEmail } from '../types';
import { useToast } from '../components/Toast';

const TYPE_COLORS: Record<DevEmail['type'], string> = {
  VERIFICATION: 'trialing',
  PASSWORD_RESET: 'warning',
  INVITATION: 'active',
};

export default function DevMailboxPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['dev-mailbox'],
    queryFn: () => devMailboxApi.list({ limit: 100 }),
    refetchInterval: 5000,
  });

  const seedMutation = useMutation({
    mutationFn: devApi.seed,
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      toast.success(result.message);
    },
    onError: () => toast.error('Failed to seed data. Workspace may already have data.'),
  });

  const handleCopy = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Dev Mailbox</h2>
          <p>
            All emails sent in development are captured here — no real emails leave the system
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            id="btn-refresh-mailbox"
            onClick={() => refetch()}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            id="btn-seed-data"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending
              ? <><div className="spinner" />Seeding...</>
              : <><Zap size={15} />Generate Sample Data</>}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-page"><div className="spinner" /> Loading emails...</div>
      ) : emails.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Inbox size={48} />
            <h3>No Emails Captured</h3>
            <p>Sign up, request a password reset, or invite a team member to see captured emails here.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {emails.map((email: DevEmail) => {
            const isExpanded = expanded === email.id;
            return (
              <div
                key={email.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all var(--transition-fast)' }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}
                  onClick={() => setExpanded(isExpanded ? null : email.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div className="stat-icon accent" style={{ width: 36, height: 36, flexShrink: 0 }}>
                      <Mail size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{email.subject}</span>
                        <span className={`badge ${TYPE_COLORS[email.type]}`} style={{ fontSize: 11 }}>
                          {email.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12 }}>
                        <span>To: {email.recipient}</span>
                        <span>{relativeTime(email.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {email.actionUrl && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        id={`copy-url-${email.id}`}
                        onClick={() => handleCopy(email.actionUrl!, email.id)}
                        title="Copy action URL"
                      >
                        {copied === email.id ? <Check size={13} /> : <Copy size={13} />}
                        {copied === email.id ? 'Copied!' : 'Copy URL'}
                      </button>
                      <a
                        href={email.actionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        id={`open-url-${email.id}`}
                      >
                        <ExternalLink size={13} /> Open
                      </a>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-primary)',
                  }}>
                    <pre style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}>
                      {email.textBody}
                    </pre>
                    {email.actionUrl && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Action URL: </span>
                        <code style={{ fontSize: 12, color: 'var(--accent-primary)', wordBreak: 'break-all' }}>
                          {email.actionUrl}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
