-- Per-admin 2FA: each admin can enroll their own authenticator secret instead
-- of every admin sharing ADMIN_TOTP_SECRET.
--
-- Additive only, by design:
--   * all three columns are NULL-able with no default, so no existing row is touched
--   * NULL means "not enrolled yet" and the login keeps accepting the shared
--     ADMIN_TOTP_SECRET for that account, so nobody is locked out by deploying
--
-- Safe to run while the app is serving traffic; ADD COLUMN ... NULL is an
-- online operation on MySQL 8.
ALTER TABLE `adminaccount`
  ADD COLUMN `totpSecret` VARCHAR(255) NULL,
  ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
  ADD COLUMN `totpLastUsedStep` INTEGER NULL;
