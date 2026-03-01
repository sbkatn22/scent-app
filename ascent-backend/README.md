# Ascent Backend

Django backend for the scent app. Uses Supabase for auth. Login returns Supabase session tokens (**access_token**, **refresh_token**, **expires_at**) when available. Protected endpoints (`/me`) require `Authorization: Bearer <access_token>`. Request bodies are JSON where applicable; responses are JSON.

---

## Base URL

- Local: `http://localhost:8000` (or whatever host/port you run the server on)
- All endpoints below are relative to the base URL.

---

## General

### Health check

| Method | Path | Body | Success response |
|--------|------|------|------------------|
| GET    | `/api/ping` | — | `200` — `{ "status": "ok", "message": "pong" }` |

---

## User API (`/api/user/`)

- **Login** returns `access_token`, `refresh_token`, and `expires_at` (if Supabase returns a session).
- **Register** creates both a Supabase Auth user and a Profile.
- **Refresh** exchanges a `refresh_token` for a new session.
- **Me** (get/update) require `Authorization: Bearer <access_token>`.
- Send JSON where a body is required (`Content-Type: application/json`).

---

## Profile object (returned by user endpoints)

```json
{
  "id": 1,
  "supabase_uid": "550e8400-e29b-41d4-a716-446655440000",
  "username": "string",
  "bio": "string",
  "profile_picture": "string",
  "created_at": "2026-02-28T12:00:00Z",
  "updated_at": "2026-02-28T12:00:00Z",
  "collection_ids": [1, 2, 3]
}
```

---

## Login

Authenticates against Supabase using email/password. If successful, returns the Profile and session tokens.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/login` | `{ "email": "<string>", "password": "<string>" }` | `200` — `{ "profile": <Profile>, "access_token", "refresh_token", "expires_at" }` | `400` missing email/password; `401` invalid credentials; `404` no profile for user |

### Request

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |

### Success response

```json
{
  "profile": { ... },
  "access_token": "<jwt>",
  "refresh_token": "<string>",
  "expires_at": 1700000000
}
```

Tokens are returned only if Supabase provides a session.

### Error response

```json
{ "error": "<message>" }
```

---

## Register (create user + profile)

Creates the user in **Supabase Auth**, then creates a local **Profile** using the returned UID. The client does not send `supabase_uid`.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/register` | `{ "email": "<string>", "password": "<string>", "username": "<string>" }` + optional fields | `201` — `{ "profile": <Profile> }` | `400` missing/invalid args, username exists, email exists; `500` invalid/missing UID from Supabase |

### Request

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |
| `username` | string (non-empty) | Yes |
| `bio` | string | No |
| `profile_picture` | string | No |

### Success response

```json
{ "profile": <Profile> }
```

### Error response

```json
{ "error": "<message>" }
```

### Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Refresh token

Exchanges a valid `refresh_token` for a new Supabase session.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/refresh` | `{ "refresh_token": "<string>" }` | `200` — `{ "access_token", "refresh_token", "expires_at" }` | `400` missing refresh_token; `401` invalid or already-used refresh token |

### Request

| Key | Type | Required |
|-----|------|----------|
| `refresh_token` | string | Yes |

### Success response

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<string>",
  "expires_at": 1700000000
}
```

### Error response

```json
{ "error": "<message>" }
```

---

## Get current user (me)

Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|--------|
| GET or POST | `/api/user/me` | `Authorization: Bearer <access_token>` | — | `200` — `{ "profile": <Profile> }` | `401` missing/invalid/expired token; `404` no profile |

### Success response

```json
{ "profile": <Profile> }
```

---

## Update current user (me)

Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|--------|
| PATCH or PUT | `/api/user/me` | `Authorization: Bearer <access_token>` | Optional JSON body | `200` — `{ "profile": <Profile> }` | `400` blank username; `401` invalid token; `404` no profile |

### Request (body optional)

```json
{
  "username": "newname",
  "bio": "new bio",
  "profile_picture": "url"
}
```

| Key | Type | Required |
|-----|------|----------|
| `username` | string (non-empty if present) | No |
| `bio` | string | No |
| `profile_picture` | string | No |

---

## Delete current user

`DELETE /api/user/me` is currently not implemented and returns:

```
405 Method Not Allowed
{ "error": "Invalid method." }
```

---

## Error responses

- **400 Bad Request** — Missing or invalid JSON; missing required fields; blank `username`; username already exists.
- **401 Unauthorized** — Missing, invalid, or expired Bearer token; invalid refresh token; invalid credentials.
- **404 Not Found** — No profile for the authenticated user.
- **500 Server Error** — Unexpected Supabase response (e.g., invalid user id returned).

All error responses use the shape:

```json
{ "error": "<message>" }
```