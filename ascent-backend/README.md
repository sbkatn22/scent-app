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

## Reviews API (`/api/reviews/`)

Review endpoints for creating and listing user reviews of fragrances. Request bodies are JSON; responses are JSON. The **reviews** app owns the `Review` model and these endpoints.

---

### Review model

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key (auto). |
| `uid` | UUID (string) | User ID of the reviewer (Supabase UID; maps to `Profile.supabase_uid`). |
| `fid` | integer | Fragrance ID of the perfume being reviewed (`Perfume.id`). |
| `description` | string | Review text; max 500 characters. |
| `rating` | float | 0.0–10.0, one decimal place. |
| `gender` | string | Typical wearer: `"Female"`, `"Slightly Female"`, `"Unisex"`, `"Slightly Male"`, `"Male"`. |
| `winter` | boolean | Good in winter. |
| `spring` | boolean | Good in spring. |
| `summer` | boolean | Good in summer. |
| `autumn` | boolean | Good in autumn. |
| `day` | boolean | Good for day wear. |
| `night` | boolean | Good for night wear. |
| `longevity` | string | How long it lasts: `"0 - 2 hours"`, `"2 - 4 hours"`, `"4 - 6 hours"`, `"6 - 8 hours"`, `"8-10 hours"`, `"10+ hours"`. |
| `value` | string | Value rating: `"Super Overpriced"`, `"Overpriced"`, `"Alright"`, `"Good Value"`, `"Super Value"`. |
| `maceration` | integer or null | Optional: days to let the scent develop after bottling. |
| `created_at` | ISO 8601 datetime | When the review was created. |
| `updated_at` | ISO 8601 datetime | When the review was last updated. |

---

### Create review (POST)

Creates a new review for a fragrance. Send a JSON body with required and optional fields.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|--------|
| POST | `/api/reviews/create/` | JSON (see below) | `201` — single review object | `400` invalid JSON, validation error; `404` profile or perfume not found |

#### Request body

**Required fields:**

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `uid` | string (UUID) | Yes | Supabase user ID of the reviewer (must match a Profile). |
| `fid` | integer | Yes | ID of the perfume being reviewed. |
| `description` | string | Yes | Review text; 1–500 characters. |
| `rating` | number | Yes | 0.0–10.0; stored with one decimal place. |
| `gender` | string | Yes | One of: `"Female"`, `"Slightly Female"`, `"Unisex"`, `"Slightly Male"`, `"Male"`. |
| `longevity` | string | Yes | One of: `"0 - 2 hours"`, `"2 - 4 hours"`, `"4 - 6 hours"`, `"6 - 8 hours"`, `"8-10 hours"`, `"10+ hours"`. |
| `value` | string | Yes | One of: `"Super Overpriced"`, `"Overpriced"`, `"Alright"`, `"Good Value"`, `"Super Value"`. |

**Optional fields (all default to `false` if omitted):**

| Key | Type | Description |
|-----|------|-------------|
| `winter` | boolean | Good in winter. |
| `spring` | boolean | Good in spring. |
| `summer` | boolean | Good in summer. |
| `autumn` | boolean | Good in autumn. |
| `day` | boolean | Good for day. |
| `night` | boolean | Good for night. |
| `maceration` | integer | Non-negative; days for maceration. |

#### Example request

```http
POST /api/reviews/create/
Content-Type: application/json

{
  "uid": "550e8400-e29b-41d4-a716-446655440000",
  "fid": 123,
  "description": "Great projection and longevity, perfect for winter nights.",
  "rating": 8.7,
  "gender": "Unisex",
  "winter": true,
  "spring": false,
  "summer": false,
  "autumn": true,
  "day": false,
  "night": true,
  "longevity": "8-10 hours",
  "value": "Good Value",
  "maceration": 30
}
```

#### Success response (201)

Returns the created review in the shape below.

```json
{
  "id": 1,
  "uid": "550e8400-e29b-41d4-a716-446655440000",
  "fid": 123,
  "description": "Great projection and longevity, perfect for winter nights.",
  "rating": 8.7,
  "gender": "Unisex",
  "winter": true,
  "spring": false,
  "summer": false,
  "autumn": true,
  "day": false,
  "night": true,
  "longevity": "8-10 hours",
  "value": "Good Value",
  "maceration": 30,
  "created_at": "2026-02-28T12:00:00Z",
  "updated_at": "2026-02-28T12:00:00Z"
}
```

#### Error responses

**400** — Validation or invalid JSON:

```json
{ "error": "Invalid JSON body" }
{ "error": "Missing required field: <field_name>" }
{ "error": "Description cannot be empty" }
{ "error": "Description exceeds 500 characters" }
{ "error": "Invalid rating value" }
{ "error": "Rating must be between 0.0 and 10.0" }
{ "error": "Invalid gender value", "allowed": ["Female", "Slightly Female", "Unisex", "Slightly Male", "Male"] }
{ "error": "Invalid longevity value", "allowed": ["0 - 2 hours", ...] }
{ "error": "Invalid value rating", "allowed": ["Super Overpriced", ...] }
{ "error": "Maceration must be a non-negative integer if provided" }
```

**404** — Profile or perfume not found:

```json
{ "error": "Profile not found for given uid" }
{ "error": "Perfume not found for given fid" }
```

---

### List reviews for a fragrance (GET)

Returns all reviews for a given perfume.

| Method | Path | Query params | Success | Error |
|--------|------|--------------|---------|--------|
| GET | `/api/reviews/` | `fid` (required) | `200` — `{ "count", "results" }` | `400` missing or invalid `fid` |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `fid` | integer | Yes | ID of the perfume. |

#### Example request

```http
GET /api/reviews/?fid=123
```

#### Success response

```json
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "uid": "550e8400-e29b-41d4-a716-446655440000",
      "fid": 123,
      "description": "Great projection and longevity.",
      "rating": 8.7,
      "gender": "Unisex",
      "winter": true,
      "spring": false,
      "summer": false,
      "autumn": true,
      "day": false,
      "night": true,
      "longevity": "8-10 hours",
      "value": "Good Value",
      "maceration": 30,
      "created_at": "2026-02-28T12:00:00Z",
      "updated_at": "2026-02-28T12:00:00Z"
    }
  ]
}
```

#### Error response (400)

```json
{ "error": "Missing required query parameter: fid" }
{ "error": "Invalid fid; must be an integer" }
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

- **400 Bad Request** — Missing or invalid JSON; missing required fields; blank `username`; username already exists; review validation (rating range, description length, invalid gender/longevity/value choices, invalid `fid`).
- **401 Unauthorized** — Missing, invalid, or expired Bearer token; invalid refresh token; invalid credentials.
- **404 Not Found** — No profile for the authenticated user; profile not found for review `uid`; perfume not found for review `fid`.
- **500 Server Error** — Unexpected Supabase response (e.g., invalid user id returned).

All error responses use the shape:

```json
{ "error": "<message>" }
```

Review validation errors may include an extra `"allowed"` array (e.g. for invalid `gender`, `longevity`, or `value`).