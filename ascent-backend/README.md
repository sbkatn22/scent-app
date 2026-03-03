# Ascent Backend

Django backend for the scent app. Uses Supabase for auth. Login returns Supabase session tokens (**access_token**, **refresh_token**, **expires_at**) when available. Protected endpoints (`/me`, `/follow`, etc.) require `Authorization: Bearer <access_token>`. Request bodies are JSON where applicable; responses are JSON.

---

## Table of Contents

- [Base URL](#base-url)
- [General](#general)
  - [Health check](#health-check)
- [Fragrance API](#fragrance-api-apifragrances)
  - [Search / list fragrances (GET)](#search--list-fragrances-get)
  - [Get fragrance by ID (GET)](#get-fragrance-by-id-get)
  - [Create fragrance (POST)](#create-fragrance-post)
  - [Toggle collection (POST)](#toggle-collection-post)
  - [Get collection (GET)](#get-collection-get)
  - [Create daily scent (POST)](#create-daily-scent-post)
  - [Get daily scents (GET — all)](#get-daily-scents-get--all)
  - [Get daily scent for a day (GET)](#get-daily-scent-for-a-day-get)
  - [Get recommendations (POST)](#get-recommendations-post)
- [Reviews API](#reviews-api-apireviews)
  - [Review model](#review-model)
  - [Create review (POST)](#create-review-post)
  - [List reviews for a fragrance (GET)](#list-reviews-for-a-fragrance-get)
  - [List reviews for current user (GET)](#list-reviews-for-current-user-get)
- [User API](#user-api-apiuser)
  - [Profile object](#profile-object-returned-by-user-endpoints)
  - [Login](#login)
  - [Register](#register-create-user--profile)
  - [Refresh token](#refresh-token)
  - [Get current user (me)](#get-current-user-me)
  - [Update current user (me)](#update-current-user-me)
  - [Toggle follow](#toggle-follow)
  - [Get following](#get-following)
  - [Get followers](#get-followers)
  - [Delete current user](#delete-current-user)
- [Error responses](#error-responses)

---

## Base URL

- Local: `http://localhost:8000` (or whatever host/port you run the server on)
- All endpoints below are relative to the base URL.

---

## General

### Health check

| Method | Path | Body | Success response | Error |
|--------|------|------|------------------|-------|
| GET | `/api/ping` | — | `200` — `{ "status": "ok", "message": "pong" }` | — |

---

## Fragrance API (`/api/fragrances/`)

Fragrance endpoints for searching/listing perfumes, creating new ones, collections, and daily scents. Request bodies are JSON where applicable; responses are JSON.

---

### Search / list fragrances (GET)

Search fragrances by name or brand with pagination. If no search term is provided, returns all fragrances (paginated).

| Method | Path | Query params | Success | Error |
|--------|------|--------------|---------|-------|
| GET | `/api/fragrances/search/` | `name` (optional), `page` (optional) | `200` — `{ "count", "results" }` | — |

> Note: `count` is currently the number of items returned in `results` for that page (not the total number of matches).

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

#### Success response (200)

```json
{
  "count": 10,
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

### Get fragrance by ID (GET)

Returns a single fragrance by ID. If the fragrance was updated recently (within 3 days), includes aggregated review stats (season, longevity, value, gender counts, etc.).

| Method | Path | Query params | Success | Error |
|--------|------|--------------|---------|-------|
| GET | `/api/fragrances/get/` | `id` (required) | `200` — single fragrance object | `400` missing id; `404` fragrance not found |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | integer | Yes | ID of the fragrance. |

#### Example request

```http
GET /api/fragrances/get/?id=123
```

#### Success response (200)

Returns the fragrance in the same shape as a single item in the search `results` array, plus optional aggregated fields: `summer_count`, `winter_count`, `day_count`, `night_count`, `light_sillage_count`, `moderate_sillage_count`, `strong_sillage_count`, `no_sillage_count`, `h0_2_longevity_count` through `h10_plus_longevity_count`, `super_overpriced_value_count` through `super_value_count`, `gender_female_count` through `gender_male_count`, `maceration_average`.

#### Error responses

**400** — Missing id:

```json
{ "error": "id is required" }
```

**404** — Fragrance not found:

```json
{ "error": "Fragrance not found" }
```

---

### Create fragrance (POST)

Creates a new fragrance. Send a JSON body with required fields and optional fields.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
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

#### Error response (400)

```json
{ "error": "Invalid JSON body" }
{ "error": "Missing required field: <field_name>" }
{ "error": "Required fields cannot be empty" }
{ "error": "Failed to create fragrance", "detail": "<message>" }
```

---

### Toggle collection (POST)

Add a perfume to the authenticated user's collection if not already added, or remove it if it exists. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| POST | `/api/fragrances/collection/toggle/` | `Authorization: Bearer <access_token>` | JSON (see below) | `200` removed / `201` added | `400` invalid JSON, missing perfume_id; `401` invalid token; `404` perfume not found |

#### Request body

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `perfume_id` | integer | Yes | ID of the perfume to add/remove. |
| `size` | string | No | One of: `"SAMPLE"`, `"DECANT"`, `"MINI"`, `"BOTTLE"` (default: `"BOTTLE"`). |

#### Example request

```http
POST /api/fragrances/collection/toggle/
Authorization: Bearer <access_token>
Content-Type: application/json

{ "perfume_id": 123, "size": "BOTTLE" }
```

#### Success response (200 — removed)

```json
{ "message": "Perfume removed from collection", "perfume_id": 123 }
```

#### Success response (201 — added)

```json
{ "message": "Perfume added to collection", "perfume_id": 123 }
```

#### Error responses

**400**:

```json
{ "error": "perfume_id is required" }
{ "error": "Invalid JSON body" }
```

**401** — Missing or invalid token (see [Error responses](#error-responses)).

**404**:

```json
{ "error": "Perfume not found" }
```

---

### Get collection (GET)

Returns the authenticated user's perfume collection. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Success | Error |
|--------|------|---------|---------|-------|
| GET | `/api/fragrances/collection/get/` | `Authorization: Bearer <access_token>` | `200` — `{ "collection" }` | `401` invalid token |

#### Success response (200)

```json
{
  "collection": [
    { "id": 1, "size": "BOTTLE", "added_on": "2026-02-28T12:00:00Z" },
    { "id": 2, "size": "SAMPLE", "added_on": "2026-02-27T10:00:00Z" }
  ]
}
```

---

### Create daily scent (POST)

Creates a daily scent entry for the authenticated user (stores which perfume they wore on a given day). Requires `Authorization: Bearer <access_token>`. Uses Upstash Redis for storage.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| POST | `/api/fragrances/daily_scent/create/` | `Authorization: Bearer <access_token>` | JSON (see below) | `201` — `{ "day", "perfume_id" }` | `400` missing/invalid fields; `401` invalid token; `500` Redis error |

#### Request body

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `perfume_id` | integer | Yes | ID of the perfume. |
| `timestamp` | number or string | Yes | Unix timestamp (number) or ISO 8601 datetime string for the day. |

#### Example request

```http
POST /api/fragrances/daily_scent/create/
Authorization: Bearer <access_token>
Content-Type: application/json

{ "perfume_id": 123, "timestamp": 1709121600 }
```

#### Success response (201)

```json
{ "day": "2024-02-28", "perfume_id": 123 }
```

#### Error responses

**400**:

```json
{ "error": "perfume_id, and timestamp are required" }
{ "error": "Invalid timestamp: <message>" }
{ "error": "Invalid JSON body" }
```

**500**:

```json
{ "error": "Failed to set value in Redis", "detail": "<message>" }
```

---

### Get daily scents (GET)

Returns all daily scent entries for the authenticated user. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Success | Error |
|--------|------|---------|---------|-------|
| GET | `/api/fragrances/daily_scent/get/all/` | `Authorization: Bearer <access_token>` | `200` — `{ "daily_scents" }` | `401` invalid token; `500` Redis error |

#### Success response (200)

```json
{
  "daily_scents": [
    { "day": "2024-02-27", "perfume": { /* fragrance object */ } },
    { "day": "2024-02-28", "perfume": { /* fragrance object */ } }
  ]
}
```

#### Error response (500)

```json
{ "error": "Failed to fetch from Redis", "detail": "<message>" }
```

---

### Get daily scent for a day (GET)

Returns the fragrance worn for a single day for the authenticated user. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Query params | Success | Error |
|--------|------|---------|--------------|---------|-------|
| GET | `/api/fragrances/daily_scent/get/` | `Authorization: Bearer <access_token>` | `timestamp` (required) | `200` — `{ "daily_scent": <fragrance> }` | `401` invalid token; `500` Redis/parse error |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `timestamp` | string | Yes | ISO 8601 datetime string (e.g. `"2026-03-01T00:00:00"`). The server derives the day as `YYYY-MM-DD` (UTC). |

#### Example request

```http
GET /api/fragrances/daily_scent/get/?timestamp=2026-03-01T00:00:00
Authorization: Bearer <access_token>
```

#### Success response (200)

```json
{ "daily_scent": { /* fragrance object */ } }
```

---

### Get recommendations (POST)

Returns weather info plus 3 fragrance recommendations (includes a computed `score` and `in_collection` flag). Requires `Authorization: Bearer <access_token>`.

> Note: the route is currently spelled `/api/fragrances/reccomendations` (double “c”) in the backend URL config.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| POST | `/api/fragrances/reccomendations` | `Authorization: Bearer <access_token>` | JSON (see below) | `200` — `{ "weather", "collection", "recommendations" }` | `400` invalid JSON / missing coordinates; `401` invalid token; `500` weather fetch error |

#### Request body

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `coordinates` | object | Yes | `{ "latitude": <number>, "longitude": <number> }` |

#### Example request

```http
POST /api/fragrances/reccomendations
Authorization: Bearer <access_token>
Content-Type: application/json

{ "coordinates": { "latitude": 40.7128, "longitude": -74.0060 } }
```

#### Success response (200)

```json
{
  "weather": { /* current weather fields */ },
  "collection": [ { /* fragrance object */ } ],
  "recommendations": [
    { /* fragrance object */, "score": 6.123, "in_collection": false }
  ]
}
```

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

Creates a new review for a fragrance. The reviewer is the authenticated user (from `Authorization: Bearer <access_token>`). Send a JSON body with required and optional fields.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| POST | `/api/reviews/create/` | `Authorization: Bearer <access_token>` | JSON (see below) | `201` — single review object | `400` invalid JSON, validation error; `401` invalid token; `404` perfume not found |

#### Request body

**Required fields:**

| Key | Type | Required | Description |
|-----|------|----------|-------------|
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
Authorization: Bearer <access_token>
Content-Type: application/json

{
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

**404** — Perfume not found:

```json
{ "error": "Perfume not found for given fid" }
```

---

### List reviews for a fragrance (GET)

Returns all reviews for a given perfume.

| Method | Path | Query params | Success | Error |
|--------|------|--------------|---------|-------|
| GET | `/api/reviews/` | `fid` (required) | `200` — `{ "count", "results" }` | `400` missing or invalid `fid` |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `fid` | integer | Yes | ID of the perfume. |

#### Example request

```http
GET /api/reviews/?fid=123
```

#### Success response (200)

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

### List reviews for current user (GET)

Returns all reviews written by the authenticated user. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Success | Error |
|--------|------|---------|---------|-------|
| GET | `/api/reviews/by-user/` | `Authorization: Bearer <access_token>` | `200` — `{ "count", "results" }` | `401` invalid token |

#### Success response (200)

Same shape as **List reviews for a fragrance** — `{ "count", "results" }` with review objects.

---

## User API (`/api/user/`)

- **Login** returns `access_token`, `refresh_token`, and `expires_at` (if Supabase returns a session).
- **Register** creates both a Supabase Auth user and a Profile.
- **Refresh** exchanges a `refresh_token` for a new session.
- **Me** (get/update) require `Authorization: Bearer <access_token>`.
- **Follow** endpoints require `Authorization: Bearer <access_token>`.
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
  "collection": [
    { "id": 1, "size": "BOTTLE", "added_on": "2026-02-28T12:00:00Z" }
  ]
}
```

---

### Login

Authenticates against Supabase using email/password. If successful, returns the Profile and session tokens.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
| POST | `/api/user/login` | `{ "email": "<string>", "password": "<string>" }` | `200` — `{ "profile", "access_token", "refresh_token", "expires_at" }` | `400` missing email/password; `401` invalid credentials; `404` no profile for user |

#### Request body

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |

#### Success response (200)

```json
{
  "profile": { ... },
  "access_token": "<jwt>",
  "refresh_token": "<string>",
  "expires_at": 1700000000
}
```

Tokens are returned only if Supabase provides a session.

#### Error responses

**400**:

```json
{ "error": "Email and password are required" }
```

**401**:

```json
{ "error": "Invalid email or password." }
{ "error": "Login failed." }
```

**404** — No profile for user (see [Error responses](#error-responses)).

---

### Register (create user + profile)

Creates the user in **Supabase Auth**, then creates a local **Profile** using the returned UID. The client does not send `supabase_uid`.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
| POST | `/api/user/register` | `{ "email", "password", "username" }` + optional fields | `201` — `{ "profile" }` | `400` missing/invalid args, username exists, email exists; `500` invalid/missing UID from Supabase |

#### Request body

| Key | Type | Required |
|-----|------|----------|
| `email` | string (non-empty) | Yes |
| `password` | string (non-empty) | Yes |
| `username` | string (non-empty) | Yes |
| `bio` | string | No |
| `profile_picture` | string | No |

#### Success response (201)

```json
{ "profile": <Profile> }
```

#### Error responses

**400**:

```json
{ "error": "Email, password, and username are required" }
{ "error": "Username already exists." }
{ "error": "A user with this email already exists." }
{ "error": "Could not create auth user." }
{ "error": "Profile already exists for this user." }
```

**500**:

```json
{ "error": "Auth user created but no user id returned." }
{ "error": "Invalid user object." }
{ "error": "Invalid user id from auth." }
```

#### Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

### Refresh token

Exchanges a valid `refresh_token` for a new Supabase session.

| Method | Path | Body | Success | Error |
|--------|------|------|---------|-------|
| POST | `/api/user/refresh` | `{ "refresh_token": "<string>" }` | `200` — `{ "access_token", "refresh_token", "expires_at" }` | `400` missing refresh_token; `401` invalid or already-used refresh token |

#### Request body

| Key | Type | Required |
|-----|------|----------|
| `refresh_token` | string | Yes |

#### Success response (200)

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<string>",
  "expires_at": 1700000000
}
```

#### Error responses

**400**:

```json
{ "error": "refresh_token is required" }
```

**401**:

```json
{ "error": "Invalid or already used refresh token." }
```

**500**:

```json
{ "error": "No session returned." }
```

---

### Get current user (me)

Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| GET or POST | `/api/user/me` | `Authorization: Bearer <access_token>` | — | `200` — `{ "profile" }` | `401` missing/invalid/expired token; `404` no profile |

#### Success response (200)

```json
{ "profile": <Profile> }
```

#### Error responses

**401**:

```json
{ "error": "Authorization header with Bearer token is required." }
{ "error": "Bearer token is required." }
{ "error": "Invalid or expired token." }
```

---

### Update current user (me)

Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Body | Success | Error |
|--------|------|---------|------|---------|-------|
| PATCH or PUT | `/api/user/me` | `Authorization: Bearer <access_token>` | Optional JSON body | `200` — `{ "profile" }` | `400` blank username; `401` invalid token; `404` no profile |

#### Request body (optional)

| Key | Type | Required |
|-----|------|----------|
| `username` | string (non-empty if present) | No |
| `bio` | string | No |
| `profile_picture` | string | No |

#### Success response (200)

```json
{ "profile": <Profile> }
```

#### Error responses

**400**:

```json
{ "error": "username cannot be blank" }
```

---

### Toggle follow

Follow or unfollow another user. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Query params | Success | Error |
|--------|------|---------|---------------|---------|-------|
| POST | `/api/user/follow` | `Authorization: Bearer <access_token>` | `uid` (required) | `200` — `{ "following" }` | `400` cannot follow self; `401` invalid token; `404` profile not found |

#### Query parameters

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `uid` | string (UUID) | Yes | Supabase user ID of the profile to follow/unfollow. |

#### Example request

```http
POST /api/user/follow?uid=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

#### Success response (200)

```json
{
  "following": [
    { "uid": "550e8400-e29b-41d4-a716-446655440000", "profile_picture": "url", "username": "user1" }
  ]
}
```

#### Error responses

**400**:

```json
{ "error": "Cannot follow yourself" }
```

**404**:

```json
{ "error": "User not found." }
```

---

### Get following

Returns the list of profiles the authenticated user follows. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Success | Error |
|--------|------|---------|---------|-------|
| GET | `/api/user/following` | `Authorization: Bearer <access_token>` | `200` — `{ "following" }` | `401` invalid token; `404` no profile |

#### Success response (200)

```json
{
  "following": [
    { "uid": "550e8400-e29b-41d4-a716-446655440000", "profile_picture": "url", "username": "user1" }
  ]
}
```

---

### Get followers

Returns the list of profiles that follow the authenticated user. Requires `Authorization: Bearer <access_token>`.

| Method | Path | Headers | Success | Error |
|--------|------|---------|---------|-------|
| GET | `/api/user/followers` | `Authorization: Bearer <access_token>` | `200` — `{ "followers" }` | `401` invalid token; `404` no profile |

#### Success response (200)

```json
{
  "followers": [
    { "uid": "550e8400-e29b-41d4-a716-446655440000", "profile_picture": "url", "username": "user2" }
  ]
}
```

---

### Delete current user

`DELETE /api/user/me` is currently not implemented and returns:

```json
405 Method Not Allowed
{ "error": "Invalid method." }
```

---

## Error responses

- **400 Bad Request** — Missing or invalid JSON; missing required fields; blank `username`; username already exists; review validation (rating range, description length, invalid gender/longevity/value choices); cannot follow self.
- **401 Unauthorized** — Missing, invalid, or expired Bearer token; invalid refresh token; invalid credentials.
- **404 Not Found** — No profile for the authenticated user; profile not found for follow `uid`; perfume not found for review `fid` or collection.
- **405 Method Not Allowed** — Invalid HTTP method (e.g. DELETE on `/me`).
- **500 Server Error** — Unexpected Supabase response; Redis failure; invalid user id returned.

All error responses use the shape:

```json
{ "error": "<message>" }
```

Some errors include an extra `"detail"` or `"allowed"` field (e.g. for Redis failures or invalid enum values).
