import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { searchUsers, type UserSummary } from "../../lib/api";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  useEffect(() => {
    const runSearch = async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchError(null);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
          setSearchResults([]);
          setSearchError("You must be logged in to search users.");
          return;
        }
        const data = await searchUsers(trimmed, token);
        setSearchResults(data.results);
        setSearchError(null);
      } catch {
        setSearchResults([]);
        setSearchError("Could not search users. Please try again.");
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(runSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const logout = async () => {
    await AsyncStorage.multiRemove(["access_token", "refresh_token", "profile"]);
    router.replace("/auth/auth");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Account details (from local storage)</Text>

        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Find other users</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchLoading && (
            <View style={{ marginTop: 8 }}>
              <ActivityIndicator size="small" />
            </View>
          )}
          {searchError && !searchLoading && (
            <Text style={styles.searchErrorText}>{searchError}</Text>
          )}
          {!searchLoading && !searchError && searchQuery.trim().length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.length === 0 ? (
                <Text style={styles.searchEmptyText}>No users found.</Text>
              ) : (
                searchResults.map((user) => (
                  <TouchableOpacity
                    key={user.uid}
                    style={styles.searchResultRow}
                    onPress={() => {
                      router.push({
                        pathname: "/user/[username]",
                        params: { username: user.username },
                      });
                    }}
                  >
                    <Text style={styles.searchResultName}>{user.username}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

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

  searchSection: { marginTop: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fafafa",
  },
  searchResults: { marginTop: 10, borderRadius: 12 },
  searchResultRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchResultName: { fontSize: 14, color: "#111", fontWeight: "600" },
  searchEmptyText: { fontSize: 13, color: "#777" },
  searchErrorText: { marginTop: 8, fontSize: 13, color: "#b00020" },

  logoutBtn: {
    marginTop: 18,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },
});