import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  X,
  Clock,
  Crown,
} from 'lucide-react';
import { teamApi } from '../lib/api';
import { relativeTime, formatDate } from '../lib/utils';
import type { TenantMember, TenantInvitation } from '../types';
import { useToast } from '../components/Toast';
import { useAuthSession } from '../lib/auth';

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

function roleColor(role: Role) {
  switch (role) {
    case 'OWNER': return 'warning';
    case 'ADMIN': return 'active';
    case 'MEMBER': return 'trialing';
    case 'VIEWER': return 'scheduled';
  }
}

// ── Invite Modal ──────────────────────────────────────────
function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => teamApi.createInvitation({ email: email.trim(), role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      toast.success(`Invitation sent to ${email}`);
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to send invitation';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Invite Team Member</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form
          className="auth-form"
          onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate(); }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="invite-email">Email Address *</label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              placeholder="teammate@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              className="form-input"
              value={role}
              onChange={e => setRole(e.target.value as Role)}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? <><div className="spinner" />Sending...</> : <><UserPlus size={16} />Send Invitation</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: session } = useAuthSession();
  const [showInvite, setShowInvite] = useState(false);

  const currentUserId = session?.user.id;
  const myMemberships = session?.memberships ?? [];
  const activeMembership = myMemberships[0];
  const myRole = activeMembership?.role ?? 'VIEWER';
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamApi.listMembers,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: teamApi.listInvitations,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: Role }) =>
      teamApi.updateMemberRole(membershipId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => teamApi.removeMember(membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (invitationId: string) => teamApi.cancelInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      toast.success('Invitation cancelled');
    },
    onError: () => toast.error('Failed to cancel invitation'),
  });

  const pendingInvitations = invitations.filter((inv: TenantInvitation) => inv.status === 'PENDING');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Team</h2>
          <p>Manage workspace members and pending invitations</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" id="btn-invite-member" onClick={() => setShowInvite(true)}>
            <UserPlus size={16} /> Invite Member
          </button>
        )}
      </div>

      {/* Members */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">
            <Users size={18} style={{ display: 'inline', marginRight: 8 }} />
            Members ({members.length})
          </h3>
        </div>
        {membersLoading ? (
          <div className="loading-page"><div className="spinner" /> Loading...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Email Verified</th>
                  <th>Joined</th>
                  {canManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member: TenantMember) => {
                  const isMe = member.userId === currentUserId;
                  const isOwner = member.role === 'OWNER';
                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: isOwner ? 'var(--warning-bg)' : 'var(--accent-glow)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: isOwner ? 'var(--warning)' : 'var(--accent-primary)',
                            fontWeight: 700, fontSize: 13, flexShrink: 0,
                          }}>
                            {isOwner ? <Crown size={14} /> : member.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              {member.user.name}
                              {isMe && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>(you)</span>}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {canManage && !isMe && !isOwner ? (
                          <select
                            className="form-input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                            value={member.role}
                            onChange={e => updateRoleMutation.mutate({
                              membershipId: member.id,
                              role: e.target.value as Role,
                            })}
                            id={`role-${member.id}`}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className={`badge ${roleColor(member.role)}`}>
                            <Shield size={11} />{member.role}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${member.user.emailVerified ? 'active' : 'past_due'}`}>
                          <span className="badge-dot" />
                          {member.user.emailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {relativeTime(member.createdAt)}
                      </td>
                      {canManage && (
                        <td>
                          {!isMe && !isOwner && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => removeMutation.mutate(member.id)}
                              disabled={removeMutation.isPending}
                              id={`remove-member-${member.id}`}
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {(pendingInvitations.length > 0 || canManage) && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Clock size={18} style={{ display: 'inline', marginRight: 8 }} />
              Pending Invitations ({pendingInvitations.length})
            </h3>
          </div>
          {invitationsLoading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : pendingInvitations.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <Mail size={32} />
              <p style={{ marginTop: 8 }}>No pending invitations</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Invited by</th>
                    <th>Expires</th>
                    {canManage && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pendingInvitations.map((inv: TenantInvitation) => (
                    <tr key={inv.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                        {inv.email}
                      </td>
                      <td>
                        <span className={`badge ${roleColor(inv.role)}`}>{inv.role}</span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {inv.inviter?.name ?? '—'}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {formatDate(inv.expiresAt)}
                      </td>
                      {canManage && (
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => cancelInviteMutation.mutate(inv.id)}
                            disabled={cancelInviteMutation.isPending}
                            id={`cancel-invite-${inv.id}`}
                          >
                            <X size={13} /> Cancel
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
