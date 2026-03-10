// lib/api.ts
export const API_BASE_URL = "http://10.184.24.77:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  console.log(`${API_BASE_URL}${path}`)
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.log("API ERROR:", path, res.status, data);
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export type Profile = {
  id: number;
  supabase_uid: string;
  username: string;
  bio: string | null;
  profile_picture: string | null;
  created_at: string;
  updated_at: string;
  followers_count?: number;
  following_count?: number;
  // For some endpoints (e.g. login) this may be omitted.
  // For public profile, the backend returns a full collection array.
  collection?: CollectionItem[];
  // Older code may still rely on collection_ids; keep it for compatibility.
  collection_ids?: number[];
};

export type LoginResponse = {
  profile: Profile;
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export async function login(email: string, password: string) {
  return request<LoginResponse>("/api/user/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, username: string) {
  return request<{ profile: Profile }>("/api/user/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });
}

// ===== Fragrance types (shared) =====

export type FragranceApiItem = {
  id: number;
  url: string;
  fragrance: string;
  brand: string;
  country?: string;
  gender?: string;
  rating_value?: string; // API returns string like "4.25"
  rating_count?: number;
  year?: number;

  top_note?: string[];
  middle_note?: string[];
  base_note?: string[];

  perfumer1?: string;
  perfumer2?: string;

  mainaccord1?: string;
  mainaccord2?: string;
  mainaccord3?: string;
  mainaccord4?: string;
  mainaccord5?: string;
};

export type CollectionItem = FragranceApiItem & {
  size: string;
  added_on: string;
};

// ===== User Search By Username (GET) =====

export type UserSummary = {
  uid: string;
  username: string;
  profile_picture: string | null;
};

export type PublicUserSearchResponse = {
  profile: Profile;
  daily_scent: FragranceApiItem | null;
};

export type UserSearchResponse = {
  results: UserSummary[];
};

export async function searchUsers(
  query: string,
  accessToken: string
): Promise<UserSearchResponse> {
  const params = new URLSearchParams();
  if (query && query.trim()) {
    params.set("q", query.trim());
  }
  const qs = params.toString();
  const path = `/api/user/search${qs ? `?${qs}` : ""}`;

  return request<UserSearchResponse>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getPublicProfileByUsername(
  username: string,
  accessToken: string
): Promise<PublicUserSearchResponse> {
  const params = new URLSearchParams();
  params.set("username", username);
  const path = `/api/user/profile?${params.toString()}`;

  return request<PublicUserSearchResponse>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ===== Current user (me) =====

export async function getMe(accessToken: string): Promise<{ profile: Profile }> {
  return request<{ profile: Profile }>("/api/user/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ===== Follow =====

export type FollowingItem = {
  uid: string;
  username: string;
  profile_picture: string | null;
};

export type FollowingResponse = {
  following: FollowingItem[];
  target_followers_count?: number;
};

export async function getFollowing(
  accessToken: string
): Promise<FollowingResponse> {
  return request<FollowingResponse>("/api/user/following", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export type FollowersResponse = {
  followers: FollowingItem[];
};

export async function getFollowers(
  accessToken: string
): Promise<FollowersResponse> {
  return request<FollowersResponse>("/api/user/followers", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function toggleFollow(
  uid: string,
  accessToken: string
): Promise<FollowingResponse> {
  const path = `/api/user/follow?${new URLSearchParams({ uid }).toString()}`;
  return request<FollowingResponse>(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ===== Fragrance Search (GET) =====

export type FragranceSearchResponse = {
  count: number;
  results: FragranceApiItem[];
};

export async function searchFragrances(name?: string, page: number = 1) {
  const params = new URLSearchParams();
  if (name && name.trim()) params.set("name", name.trim());
  if (page) params.set("page", String(page));

  const qs = params.toString();
  const path = `/api/fragrances/search/${qs ? `?${qs}` : ""}`;

  return request<FragranceSearchResponse>(path, { method: "GET" });
}

export async function getFragranceById(id: number): Promise<FragranceApiItem> {
  return request<FragranceApiItem>(`/api/fragrances/get/?id=${id}`, { method: "GET" });
}