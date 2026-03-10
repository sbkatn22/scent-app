import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getFollowing, type FollowingItem } from "../lib/api";

export default function FollowingScreen() {
  const router = useRouter();
  const [list, setList] = useState<FollowingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
          setError("You must be logged in.");
          return;
        }
        const res = await getFollowing(token);
        setList(res.following);
        setError(null);
      } catch {
        setError("Could not load following.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Following</Text>
          <View style={{ width: 48 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.mutedText}>You are not following anyone yet.</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {list.map((user) => (
              <TouchableOpacity
                key={user.uid}
                style={styles.userCard}
                onPress={() =>
                  router.push({
                    pathname: "/user/[username]",
                    params: { username: user.username },
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.username}>{user.username}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backText: { fontSize: 14, fontWeight: "700", color: "#111" },
  title: { fontSize: 20, fontWeight: "900", color: "#111" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 24 },

  card: {
    marginTop: 12,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
  },
  userCard: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  username: { fontSize: 16, fontWeight: "700", color: "#111" },
  errorText: { fontSize: 14, color: "#b00020" },
  mutedText: { fontSize: 14, color: "#777" },
});
