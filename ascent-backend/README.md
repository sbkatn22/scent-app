# Ascent Backend

Django backend for the scent app. Uses Supabase for auth. Login and register return JWT **access_token** and **refresh_token**; protected endpoints (get/update/delete me) require `Authorization: Bearer <access_token>`. Request bodies are JSON where applicable; responses are JSON.

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

- **Login** and **register** return `access_token` (JWT) and `refresh_token`; the client should send `Authorization: Bearer <access_token>` on protected calls.
- **Refresh** exchanges a `refresh_token` for a new token pair.
- **Me** (get/update/delete) require `Authorization: Bearer <access_token>`; no `supabase_uid` in the body.
- Send JSON where a body is required (`Content-Type: application/json`).

### Profile object (returned by user endpoints)

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

### Login

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/login` | `{ "email": "<string>", "password": "<string>" }` | `200` — `{ "profile": <Profile> }` | `400` missing email/password; `401` invalid credentials; `404` no profile for user; `503` Supabase not configured |

**Request**

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |

**Success response:** `{ "profile": <Profile>, "access_token": "<jwt>", "refresh_token": "<string>", "expires_at": <number> }` — Supabase session tokens so the client can call Supabase APIs and/or send `Authorization: Bearer <access_token>` to your backend.  
**Error response:** `{ "error": "<message>" }`

---

### Register (create user + profile)

The backend creates the user in **Supabase Auth** (email/password), then creates the **Profile** using the UID returned by Supabase. No `supabase_uid` is sent by the client.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/register` | `{ "email": "<string>", "password": "<string>", "username": "<string>" }` + optional fields | `201` — `{ "profile": <Profile> }` | `400` missing/invalid args, email already exists; `503` Supabase env not configured |

**Request**

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |
| `username` | string (non-empty) | Yes |
| `bio` | string | No |
| `profile_picture` | string (URL) | No |

**Success response:** `{ "profile": <Profile> }` (profile includes the `supabase_uid` returned from Supabase).  
**Error response:** `{ "error": "<message>" }`

**Environment (required for register):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase project settings → API). JWT verification uses the project’s **JWKS** (`SUPABASE_URL` + `/auth/v1/.well-known/jwks.json`) and supports **ES256** (ECC P-256); no JWT secret needed.

---

### Refresh token

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/user/refresh` | `{ "refresh_token": "<string>" }` | `200` — `{ "access_token", "refresh_token", "expires_at" }` | `400` missing refresh_token; `401` invalid/used refresh token; `503` Supabase not configured |

**Request**

| Key | Type | Required |
|-----|------|----------|
| `refresh_token` | string (from login response) | Yes |

**Success response:** `{ "access_token": "<jwt>", "refresh_token": "<string>", "expires_at": <number> }` — use the new tokens for subsequent requests.  
**Error response:** `{ "error": "<message>" }`

---

### Get current user (me)

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|--------|
| GET or POST | `/api/user/me` | `Authorization: Bearer <access_token>` | — | `200` — `{ "profile": <Profile> }` | `401` missing/invalid/expired token; `404` no profile |

**Success response:** `{ "profile": <Profile> }`  
**Error response:** `{ "error": "<message>" }`

---

### Update current user (me)

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|--------|
| PATCH or PUT | `/api/user/me` | `Authorization: Bearer <access_token>` | `{ "username"?: "<string>", "bio"?: "<string>", "profile_picture"?: "<string>" }` | `200` — `{ "profile": <Profile> }` | `400` blank username; `401` missing/invalid token; `404` no profile |

**Request (body optional)**

| Key | Type | Required |
|-----|------|----------|
| `username` | string (non-empty) | No (if present, cannot be blank) |
| `bio` | string | No |
| `profile_picture` | string | No |

**Success response:** `{ "profile": <Profile> }`  
**Error response:** `{ "error": "<message>" }`

---

### Delete current user (me)

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|--------|
| DELETE | `/api/user/me` | `Authorization: Bearer <access_token>` | — | `200` — `{ "ok": true }` | `401` missing/invalid token; `404` no profile |

**Success response:** `{ "ok": true }`  
**Error response:** `{ "error": "<message>" }`

---

## Error responses

- **400 Bad Request** — Missing or invalid body/fields (e.g. invalid JSON, missing required fields, email already exists, blank `username`).
- **401 Unauthorized** — Missing, invalid, or expired Bearer token; invalid refresh token.
- **404 Not Found** — No profile for the authenticated user.
- **500 Server Error** — Auth user created but no UID returned (unexpected).
- **503 Service Unavailable** — `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set (register/refresh); `SUPABASE_URL` not set (me endpoints use JWKS for JWT verification).

All error responses use the shape: `{ "error": "<message>" }`.
