// lib/api.ts
export const API_BASE_URL = "http://192.168.4.54:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  collection_ids: number[];
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

// ===== Fragrance Search (GET) =====

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

  // Your existing request() works fine for GET too
  return request<FragranceSearchResponse>(path, { method: "GET" });
}