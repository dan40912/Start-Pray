-- Raw SQL equivalent of scripts/approve-existing-responses.js, for running
-- directly against the MySQL database (e.g. via `mysql` CLI or a GUI client)
-- if you'd rather not run the Node script.
--
-- Context: 2026-07-01 moderation policy change — responses are now
-- auto-approved on upload and only go back to PENDING when reported. This
-- statement is the one-time clean slate for existing rows.
--
-- Does NOT touch `isBlocked` — a response an admin explicitly blocked stays
-- hidden regardless of voiceModerationStatus. Unblock those separately from
-- /admin/prayerresponse if you want them back too.

-- 1. Preview how many rows will change:
SELECT COUNT(*) AS will_be_approved
FROM prayerresponse
WHERE voiceModerationStatus <> 'APPROVED';

-- 2. Apply the update:
UPDATE prayerresponse
SET voiceModerationStatus = 'APPROVED'
WHERE voiceModerationStatus <> 'APPROVED';
