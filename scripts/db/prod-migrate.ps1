param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  Write-Error "[prod-migrate] DATABASE_URL is required"
}

$env:DATABASE_URL = $DatabaseUrl

Write-Host "[prod-migrate] generating prisma client"
npx prisma generate

Write-Host "[prod-migrate] running fail-closed preflight"
node scripts/db/preflight-prod-release.cjs

Write-Host "[prod-migrate] applying migrations"
npx prisma migrate deploy

Write-Host "[prod-migrate] migration status"
npx prisma migrate status

Write-Host "[prod-migrate] exporting SQL bundle for audit"
node scripts/db/export-migration-bundle.cjs

Write-Host "[prod-migrate] done"
