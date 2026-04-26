import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Shield, AlertTriangle, Check } from 'lucide-react';
import { tenantApi } from '../lib/api';
import { useAuthSession } from '../lib/auth';
import { getTenantId } from '../lib/api';
import { useToast } from '../components/Toast';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: session } = useAuthSession();
  const tenantId = getTenantId();

  const activeMembership = session?.memberships.find(m => m.tenantId === tenantId) ?? session?.memberships[0];
  const tenant = activeMembership?.tenant;
  const myRole = activeMembership?.role ?? 'VIEWER';
  const canEdit = myRole === 'OWNER' || myRole === 'ADMIN';

  const [name, setName] = useState(tenant?.name ?? '');
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () => tenantApi.update(tenantId!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setSaved(true);
      toast.success('Workspace settings saved');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  return (
    <div>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your workspace configuration</p>
      </div>

      {/* Workspace */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 600 }}>
        <div className="card-header">
          <h3 className="card-title">
            <Settings size={18} style={{ display: 'inline', marginRight: 8 }} />
            Workspace
          </h3>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="workspace-name">Workspace Name</label>
          <input
            id="workspace-name"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={!canEdit}
            placeholder="My Workspace"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Slug</label>
          <input
            className="form-input"
            value={tenant?.slug ?? ''}
            readOnly
            style={{ color: 'var(--text-muted)', cursor: 'not-allowed' }}
          />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Slug cannot be changed after workspace creation.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Status</label>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${tenant?.status === 'ACTIVE' ? 'active' : 'cancelled'}`}>
              <span className="badge-dot" />{tenant?.status ?? '—'}
            </span>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Your Role</label>
          <div style={{ marginTop: 4 }}>
            <span className="badge warning">
              <Shield size={11} />{myRole}
            </span>
          </div>
        </div>

        {canEdit && (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              id="btn-save-settings"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || name === tenant?.name}
            >
              {saved
                ? <><Check size={16} /> Saved</>
                : updateMutation.isPending
                  ? <><div className="spinner" />Saving...</>
                  : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {myRole === 'OWNER' && (
        <div className="card" style={{ maxWidth: 600, borderColor: 'var(--danger-border)' }}>
          <div className="card-header">
            <h3 className="card-title" style={{ color: 'var(--danger)' }}>
              <AlertTriangle size={18} style={{ display: 'inline', marginRight: 8 }} />
              Danger Zone
            </h3>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Deleting a workspace is irreversible and will remove all billing data including customers, subscriptions, and invoices.
          </p>
          <button
            className="btn btn-danger"
            disabled
            title="Contact support to delete your workspace"
          >
            Delete Workspace
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Contact support to request workspace deletion.
          </p>
        </div>
      )}
    </div>
  );
}
