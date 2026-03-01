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

## Fragrance API (`/api/fragrances/`)

Fragrance endpoints for searching/listing perfumes and creating new ones. Request bodies are JSON where applicable; responses are JSON.

---

### Search / list fragrances (GET)

Search fragrances by name or brand with pagination. If no search term is provided, returns all fragrances (paginated).

| Method | Path | Query params | Success | Error |
|--------|------|--------------|---------|--------|
| GET | `/api/fragrances/search/` | `name` (optional), `page` (optional) | `200` — `{ "count", "pagination", "results" }` | — |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | No | Search term; case-insensitive partial match on fragrance name or brand. Omit to return all fragrances. |
| `page` | integer | No | Page number (default: 1). Each page returns up to 10 results. |

#### Example requests

```http
GET /api/fragrances/search/
GET /api/fragrances/search/?name=rose
GET /api/fragrances/search/?name=rose&page=1
```

#### Success response

```json
{
  "count": 10,
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total_count": 42,
    "total_pages": 5,
    "has_next": true,
    "has_previous": false
  },
  "results": [
    {
      "id": 1,
      "url": "https://...",
      "fragrance": "Fragrance Name",
      "brand": "Brand Name",
      "country": "France",
      "gender": "unisex",
      "rating_value": "4.25",
      "rating_count": 1500,
      "year": 2020,
      "top_note": ["Rose", "Bergamot"],
      "middle_note": ["Jasmine", "Iris"],
      "base_note": ["Musk", "Sandalwood"],
      "perfumer1": "Perfumer Name",
      "perfumer2": "",
      "mainaccord1": "Floral",
      "mainaccord2": "Woody",
      "mainaccord3": "",
      "mainaccord4": "",
      "mainaccord5": ""
    }
  ]
}
```

---

### Create fragrance (POST)

Creates a new fragrance. Send a JSON body with required fields and optional fields.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/fragrances/create/` | JSON (see below) | `201` — single fragrance object | `400` invalid JSON, missing required field, or creation failed |

#### Request body

**Required fields** (all must be non-empty strings):

| Key | Type | Required |
|-----|------|----------|
| `url` | string | Yes |
| `fragrance` | string | Yes |
| `brand` | string | Yes |
| `country` | string | Yes |
| `gender` | string | Yes |

**Optional fields:**

| Key | Type | Description |
|-----|------|-------------|
| `rating_value` | number or string | Decimal (e.g. 4.25) |
| `rating_count` | integer | Positive integer |
| `year` | integer | Release year |
| `top_note` | array of strings | List of top notes |
| `middle_note` | array of strings | List of middle notes |
| `base_note` | array of strings | List of base notes |
| `perfumer1` | string | Perfumer name |
| `perfumer2` | string | Second perfumer |
| `mainaccord1` … `mainaccord5` | string | Main accord labels |

#### Example request

```http
POST /api/fragrances/create/
Content-Type: application/json

{
  "url": "https://www.fragrantica.com/perfume/Brand/Name.html",
  "fragrance": "Fragrance Name",
  "brand": "Brand Name",
  "country": "France",
  "gender": "unisex",
  "rating_value": 4.25,
  "rating_count": 100,
  "year": 2020,
  "top_note": ["Rose", "Bergamot"],
  "middle_note": ["Jasmine"],
  "base_note": ["Musk"]
}
```

#### Success response (201)

Returns the created fragrance in the same shape as a single item in the search `results` array (see **Search / list fragrances** above).

```json
{
  "id": 123,
  "url": "https://...",
  "fragrance": "Fragrance Name",
  "brand": "Brand Name",
  "country": "France",
  "gender": "unisex",
  "rating_value": "4.25",
  "rating_count": 100,
  "year": 2020,
  "top_note": ["Rose", "Bergamot"],
  "middle_note": ["Jasmine"],
  "base_note": ["Musk"],
  "perfumer1": "",
  "perfumer2": "",
  "mainaccord1": "",
  "mainaccord2": "",
  "mainaccord3": "",
  "mainaccord4": "",
  "mainaccord5": ""
}
```

#### Error response (400)

```json
{ "error": "Invalid JSON body" }
{ "error": "Missing required field: <field_name>" }
{ "error": "Required fields cannot be empty" }
{ "error": "Failed to create fragrance", "detail": "<message>" }
```

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