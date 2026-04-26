CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerStatus') THEN
    CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvitationStatus') THEN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DevEmailType') THEN
    CREATE TYPE "DevEmailType" AS ENUM ('VERIFICATION', 'PASSWORD_RESET', 'INVITATION');
  END IF;
END $$;

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "nextInvoiceSequence" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "company" TEXT,
  "stripeCustomerId" TEXT,
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DevEmail" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "userId" TEXT,
  "type" "DevEmailType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevEmail_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;

ALTER TABLE "UsageRecord"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;

INSERT INTO "Customer" (
  "id",
  "tenantId",
  "name",
  "email",
  "company",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  t."name" || ' Workspace Customer',
  t."slug" || '@workspace.billflow.local',
  t."name",
  'ACTIVE'::"CustomerStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1
  FROM "Customer" c
  WHERE c."tenantId" = t."id"
    AND c."email" = t."slug" || '@workspace.billflow.local'
);

UPDATE "Subscription" s
SET "customerId" = c."id"
FROM "Customer" c
JOIN "Tenant" t
  ON t."id" = c."tenantId"
WHERE s."tenantId" = c."tenantId"
  AND c."email" = t."slug" || '@workspace.billflow.local'
  AND s."customerId" IS NULL;

UPDATE "UsageRecord" u
SET "customerId" = c."id"
FROM "Customer" c
JOIN "Tenant" t
  ON t."id" = c."tenantId"
WHERE u."tenantId" = c."tenantId"
  AND c."email" = t."slug" || '@workspace.billflow.local'
  AND u."customerId" IS NULL;

UPDATE "Invoice" i
SET "customerId" = COALESCE(s."customerId", c."id")
FROM "Subscription" s
LEFT JOIN "Customer" c
  ON c."tenantId" = s."tenantId"
LEFT JOIN "Tenant" t
  ON t."id" = c."tenantId"
WHERE i."subscriptionId" = s."id"
  AND (
    c."email" = t."slug" || '@workspace.billflow.local'
    OR s."customerId" = c."id"
  )
  AND i."customerId" IS NULL;

UPDATE "Payment" p
SET "customerId" = i."customerId"
FROM "Invoice" i
WHERE p."invoiceId" = i."id"
  AND p."customerId" IS NULL;

WITH ranked AS (
  SELECT
    i."id",
    'INV-' || upper(replace(t."slug", '-', '')) || '-' || lpad(row_number() OVER (
      PARTITION BY i."tenantId"
      ORDER BY i."createdAt", i."id"
    )::text, 6, '0') AS invoice_number
  FROM "Invoice" i
  JOIN "Tenant" t
    ON t."id" = i."tenantId"
)
UPDATE "Invoice" i
SET "invoiceNumber" = ranked.invoice_number
FROM ranked
WHERE i."id" = ranked."id"
  AND i."invoiceNumber" IS NULL;

UPDATE "Tenant" t
SET "nextInvoiceSequence" = seq.next_sequence
FROM (
  SELECT
    i."tenantId",
    COUNT(*) + 1 AS next_sequence
  FROM "Invoice" i
  GROUP BY i."tenantId"
) seq
WHERE t."id" = seq."tenantId";

ALTER TABLE "Subscription"
  ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "UsageRecord"
  ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "Invoice"
  ALTER COLUMN "customerId" SET NOT NULL,
  ALTER COLUMN "invoiceNumber" SET NOT NULL;

ALTER TABLE "Payment"
  ALTER COLUMN "customerId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_tenantId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_customerId_fkey'
  ) THEN
    ALTER TABLE "Subscription"
      ADD CONSTRAINT "Subscription_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsageRecord_customerId_fkey'
  ) THEN
    ALTER TABLE "UsageRecord"
      ADD CONSTRAINT "UsageRecord_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UsageRecord_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "UsageRecord"
      ADD CONSTRAINT "UsageRecord_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_customerId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_customerId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TenantInvitation_tenantId_fkey'
  ) THEN
    ALTER TABLE "TenantInvitation"
      ADD CONSTRAINT "TenantInvitation_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TenantInvitation_invitedByUserId_fkey'
  ) THEN
    ALTER TABLE "TenantInvitation"
      ADD CONSTRAINT "TenantInvitation_invitedByUserId_fkey"
      FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TenantInvitation_acceptedByUserId_fkey'
  ) THEN
    ALTER TABLE "TenantInvitation"
      ADD CONSTRAINT "TenantInvitation_acceptedByUserId_fkey"
      FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DevEmail_tenantId_fkey'
  ) THEN
    ALTER TABLE "DevEmail"
      ADD CONSTRAINT "DevEmail_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DevEmail_userId_fkey'
  ) THEN
    ALTER TABLE "DevEmail"
      ADD CONSTRAINT "DevEmail_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_stripeCustomerId_key" ON "Customer"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_email_key" ON "Customer"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_customerId_status_idx" ON "Subscription"("customerId", "status");
CREATE INDEX IF NOT EXISTS "UsageRecord_customerId_metricKey_windowStart_idx" ON "UsageRecord"("customerId", "metricKey", "windowStart");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_customerId_status_idx" ON "Invoice"("customerId", "status");
CREATE INDEX IF NOT EXISTS "Payment_customerId_status_idx" ON "Payment"("customerId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantInvitation_token_key" ON "TenantInvitation"("token");
CREATE INDEX IF NOT EXISTS "TenantInvitation_tenantId_status_idx" ON "TenantInvitation"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "TenantInvitation_email_status_idx" ON "TenantInvitation"("email", "status");
CREATE INDEX IF NOT EXISTS "DevEmail_recipient_createdAt_idx" ON "DevEmail"("recipient", "createdAt");
CREATE INDEX IF NOT EXISTS "DevEmail_tenantId_createdAt_idx" ON "DevEmail"("tenantId", "createdAt");
