# Admin 2FA Runbook

Updated: 2026-10-20 (Asia/Taipei)

> **2026-10 更新**：現在每位管理員可以在「後台 → 權限設定 → 我的兩步驟驗證」綁定自己的
> 驗證器。`ADMIN_TOTP_SECRET` 只作為尚未綁定帳號的備援，全部綁定後即可移除。
> 詳見 `docs/security-hardening.md`。

## Goal

Enable `/admin` login with:
- username
- password
- 6-digit TOTP (2FA)

## Required Environment Variables

Set these in each environment:

```env
ADMIN_SESSION_SECRET=<long-random-secret>
ADMIN_TOTP_SECRET=<totp-secret>
```

Notes:
- `ADMIN_SESSION_SECRET` signs admin session cookies.
- `ADMIN_TOTP_SECRET` is used by the current backend OTP check.
- Do not reuse local/dev secrets in production.

## One-Time Secret and QR Generation

Run in project root:

```powershell
@'
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

(async () => {
  const secret = authenticator.generateSecret();
  const issuer = 'Start Pray';
  const account = 'admin@start-pray.local';
  const otpauth = authenticator.keyuri(account, issuer, secret);

  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'admin-2fa-qr.png');

  await QRCode.toFile(outFile, otpauth, { width: 320, margin: 2 });

  console.log(JSON.stringify({ secret, otpauth, outFile }, null, 2));
})();
'@ | node -
```

Expected output includes:
- `secret`: put into `ADMIN_TOTP_SECRET`
- `outFile`: QR image path for authenticator app scanning

## Mobile Setup

1. Install an authenticator app (Google/Microsoft/1Password).
2. Use `+` and scan the generated QR.
3. Use the current 6-digit code as admin OTP at `/admin`.

## Deploy to Production Checklist

1. Generate a new production-only TOTP secret.
2. Set `ADMIN_SESSION_SECRET` and `ADMIN_TOTP_SECRET` in production env.
3. Restart application service.
4. Enroll production admin devices using the production QR.
5. Verify `/admin` login with real OTP.
6. Remove any temporary fallback `ADMIN_LOGIN_OTP` value if present.

## Verification API Behavior

- Missing OTP config => `503` from `/api/admin/auth/login`
- Wrong OTP => `401`
- Success => sets `start-pray-admin-session` cookie

## Code entry and timing

- The login form and API accept spaces and full-width digits in pasted codes.
- TOTP accepts the current 30-second step and the immediately previous step to allow submission across a refresh boundary. Older and future codes are rejected.
- Keep the phone and server clocks synchronized; this tolerance does not repair a different enrolled secret or a large clock offset.
- When `ADMIN_TOTP_SECRET` is configured, `ADMIN_LOGIN_OTP` cannot bypass it.
- Regression check: `node --test tests/admin-otp.test.mjs`.
