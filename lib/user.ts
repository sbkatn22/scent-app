import { http } from "@/lib/http";

export type Profile = {
  id: number;
  supabase_uid: string;
  username: string;
  bio: string | null;
  profile_picture: string | null;
  created_at: string;
  updated_at: string;
  collection?: { id: number; size: string; added_on: string }[];
};

export async function getMe() {
  // Your backend supports GET or POST for /me
  const res = await http.get<{ profile: Profile }>("/api/user/me");
  return res.data.profile;
}