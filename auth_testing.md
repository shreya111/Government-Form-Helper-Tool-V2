# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Create Test User & Session (Mongo)
```
mongosh --eval "
use('test_database');
var userId = 'user_test' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({ user_id: userId, email: 'test.user.'+Date.now()+'@example.com', name: 'Test User', picture: '', created_at: new Date().toISOString() });
db.user_sessions.insertOne({ user_id: userId, session_token: sessionToken, expires_at: new Date(Date.now()+7*24*60*60*1000).toISOString(), created_at: new Date().toISOString() });
print('Session token: ' + sessionToken); print('User ID: ' + userId);
"
```

## Backend API
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer <SESSION_TOKEN>"
curl -X GET "$URL/api/documents" -H "Authorization: Bearer <SESSION_TOKEN>"
```

## Browser
```
await page.context.add_cookies([{ "name":"session_token","value":"<TOKEN>","domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None" }])
```

## Notes
- user_id is a custom field; MongoDB _id is separate. Always project {"_id":0}.
- Session user_id must match user's user_id.
- Callback detection uses useLocation().hash, not window.location.hash.
- Backend reads session_token from cookie first, then Authorization Bearer.
