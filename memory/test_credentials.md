# FormWise — Test Credentials & Sessions

Auth: **Emergent-managed Google sign-in** (no app-managed passwords). For automated testing,
seed a user + session directly in Mongo and use the `session_token` as a Bearer token or cookie.

## Seed a test session (Mongo)
```
mongosh --quiet --eval "
use('test_database');
var uid='user_test'+Date.now(); var tok='test_session_'+Date.now();
db.users.insertOne({user_id:uid,email:'test.'+Date.now()+'@example.com',name:'Test User',picture:'',created_at:new Date().toISOString()});
db.user_sessions.insertOne({user_id:uid,session_token:tok,expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString(),created_at:new Date().toISOString()});
print(tok);
"
```

## Use it
- API: `-H "Authorization: Bearer <session_token>"`
- Browser: set cookie `session_token` (domain=preview host, path=/, httpOnly, secure, sameSite=None)

## Notes
- `user_id` is a custom field; Mongo `_id` is separate and always projected out.
- Backend reads session from cookie first, then Authorization Bearer.
- No real Google account is needed for backend/UI testing via the seed above.

## Seeded conflict-test session (2026-06, Phase 2)
- user_id `user_test_conflict`, email `conflict.tester@example.com`, session_token **`test_session_conflict_2026`**
- Has 2 processed seed documents (AADHAAR `seed-aadhaar-1` DOB 11/10/1997, BIRTH_CERTIFICATE `seed-birth-1` DOB 11/10/1998) → Date of Birth shows a conflict card in Review & Autofill.
- Re-seed: see the mongosh snippet in `/app/memory/PRD.md` (Phase 2 section) if the TTL (24h) has expired.

## Admin dashboard (/admin)
- `ADMIN_EMAILS` in backend/.env = singhaishreya33@gmail.com (owner) + conflict.tester@example.com (test admin → token `test_session_conflict_2026`).
- Non-admin session for 403 checks: user `user_test_plain` / `plain.tester@example.com` / token **`test_session_plain_2026`**.
