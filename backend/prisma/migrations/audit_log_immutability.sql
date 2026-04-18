-- CreateAuditLogImmutability
-- Enforces immutability on the AuditLog table at the database level.
-- No UPDATE or DELETE operations should ever be performed on audit logs.

-- Prevent UPDATE operations
CREATE RULE no_update_audit AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;

-- Prevent DELETE operations  
CREATE RULE no_delete_audit AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
