// lib/http.ts
import { API_BASE_URL } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, {
    AxiosError,
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
} from "axios";

/**
 * ✅ What this file does:
 * - Uses ONE axios instance (`http`) for all API calls
 * - Automatically attaches `Authorization: Bearer <access_token>`
 * - If a protected request returns 401, it will:
 *    1) call /api/user/refresh with refresh_token
 *    2) store new tokens
 *    3) retry the original request (once)
 * - If refresh fails or exceeds retries:
 *    - clears tokens/profile from AsyncStorage
 *    - throws "Session expired..." so UI can route to /auth
 */

const MAX_REFRESH_TRIES = 1; // set to 2 if you want extra safety

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

// Shared refresh promise so multiple 401s don't spam refresh endpoint
let refreshPromise: Promise<string> | null = null;

// Create axios instance
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

function tokenPreview(token?: string | null) {
  if (!token) return "none";
  return `${token.slice(0, 12)}…(${token.length})`;
}

async function clearSession() {
  await AsyncStorage.multiRemove(["access_token", "refresh_token", "profile"]);
}

async function doRefreshToken(): Promise<string> {
  const refresh_token = await AsyncStorage.getItem("refresh_token");
  console.log("🔁 REFRESH START. refresh_token:", tokenPreview(refresh_token));

  if (!refresh_token) throw new Error("No refresh token found.");

  // IMPORTANT: use plain axios here (NOT `http`) to avoid interceptor loops
  const res = await axios.post<RefreshResponse>(
    `${API_BASE_URL}/api/user/refresh`,
    { refresh_token },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  const { access_token, refresh_token: new_refresh_token, expires_at } = res.data;

  console.log("✅ REFRESH SUCCESS. new access:", tokenPreview(access_token));
  console.log("✅ REFRESH SUCCESS. new refresh:", tokenPreview(new_refresh_token));
  console.log("✅ expires_at:", expires_at);

  await AsyncStorage.multiSet([
    ["access_token", access_token],
    ["refresh_token", new_refresh_token],
    ["expires_at", String(expires_at)], // optional: can help debugging
  ]);

  return access_token;
}

async function refreshAccessTokenOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Attach Authorization header on every request
http.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("access_token");

    // debug
    console.log("➡️ REQUEST:", config.method?.toUpperCase(), config.url, "token:", tokenPreview(token));

    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 -> refresh -> retry
http.interceptors.response.use(
  (response: AxiosResponse) => {
    // debug
    console.log("✅ RESPONSE:", response.status, response.config.url);
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & {
      _retryCount?: number;
      _skipAuthRefresh?: boolean;
    });

    // Network error (no response)
    if (!error.response) {
      console.log("🌐 NETWORK ERROR:", error.message);
      throw error;
    }

    const status = error.response.status;
    console.log("🟥 ERROR RESPONSE:", status, original?.url);

    // If we explicitly skip refresh on this request, just throw
    if (original?._skipAuthRefresh) throw error;

    // Only handle 401
    if (status !== 401 || !original) throw error;

    // Prevent infinite loops
    original._retryCount = original._retryCount ?? 0;

    if (original._retryCount >= MAX_REFRESH_TRIES) {
      console.log("⛔️ MAX REFRESH TRIES HIT. Clearing session.");
      await clearSession();
      throw new Error("Session expired. Please sign in again.");
    }

    original._retryCount += 1;

    try {
      console.log("🔄 401 HIT. Attempting refresh then retry:", original.url);

      const newAccess = await refreshAccessTokenOnce();

      // Update header for retry
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;

      console.log("🔁 RETRYING REQUEST:", original.url);

      return http.request(original);
    } catch (refreshErr: any) {
      console.log("❌ REFRESH FAILED:", refreshErr?.message ?? refreshErr);
      await clearSession();
      throw new Error("Session expired. Please sign in again.");
    }
  }
);

/**
 * OPTIONAL helper for quick testing:
 * Use this anywhere to force a protected call and confirm refresh works.
 *
 * Example:
 *   await AsyncStorage.setItem("access_token", "fake");
 *   await pingMe();
 */
export async function pingMe() {
  const res = await http.get("/api/user/me");
  return res.data;
}