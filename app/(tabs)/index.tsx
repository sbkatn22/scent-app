import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Profile = {
  id: number;
  supabase_uid: string;
  username: string;
  bio: string | null;
  profile_picture: string | null;
  created_at: string;
  updated_at: string;
  collection_ids: number[];
};

export default function ProfileHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem("profile");
        setProfile(raw ? (JSON.parse(raw) as Profile) : null);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const logout = async () => {
    await AsyncStorage.multiRemove(["access_token", "refresh_token", "profile"]);
    router.replace("/auth/auth");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Account details (from local storage)</Text>

        {loading ? (
          <View style={{ marginTop: 18 }}>
            <ActivityIndicator />
          </View>
        ) : profile ? (
          <View style={styles.card}>
            <Row label="Username" value={profile.username} />
            <Row label="Profile ID" value={String(profile.id)} />
            <Row label="Supabase UID" value={profile.supabase_uid} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No profile found</Text>
            <Text style={styles.emptySubtitle}>
              You may be logged out or storage is empty.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },

  title: { fontSize: 28, fontWeight: "900", color: "#111" },
  subtitle: { marginTop: 6, fontSize: 14, color: "#777" },

  card: {
    marginTop: 18,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
  },

  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  rowValue: { marginTop: 4, fontSize: 14, color: "#444" },

  emptyTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  emptySubtitle: { marginTop: 6, fontSize: 13.5, color: "#666", lineHeight: 18 },

  logoutBtn: {
    marginTop: 18,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },
});