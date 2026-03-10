import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  getPublicProfileByUsername,
  getFollowing,
  getMe,
  toggleFollow,
  type Profile,
  type FragranceApiItem,
  type CollectionItem,
} from "../../lib/api";

export default function OtherUserProfileScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyScent, setDailyScent] = useState<FragranceApiItem | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!username || typeof username !== "string") {
        setError("No username provided.");
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const token = await AsyncStorage.getItem("access_token");
        if (!token) {
          setError("You must be logged in to view profiles.");
          return;
        }
        const data = await getPublicProfileByUsername(username, token);
        setProfile(data.profile);
        setDailyScent(data.daily_scent);
        setFollowerCount(data.profile.followers_count ?? 0);
        setFollowingCount(data.profile.following_count ?? 0);

        const [meRes, followingRes] = await Promise.all([
          getMe(token),
          getFollowing(token),
        ]);
        const profileUid = data.profile.supabase_uid;
        setIsOwnProfile(meRes.profile.supabase_uid === profileUid);
        setIsFollowing(
          followingRes.following.some((f) => f.uid === profileUid)
        );
      } catch (e) {
        setError("Could not load profile.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [username]);

  const handleFollowPress = async () => {
    if (!profile || followLoading) return;
    const token = await AsyncStorage.getItem("access_token");
    if (!token) return;
    try {
      setFollowLoading(true);
      const res = await toggleFollow(profile.supabase_uid, token);
      const nowFollowing = res.following.some((f) => f.uid === profile.supabase_uid);
      setIsFollowing(nowFollowing);
      if (res.target_followers_count !== undefined) {
        setFollowerCount(res.target_followers_count);
      } else {
        setFollowerCount((prev) => nowFollowing ? prev + 1 : Math.max(0, prev - 1));
      }
    } catch (_e) {
      // Error already logged in request(); optionally show toast
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>User Profile</Text>
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
        ) : !profile ? (
          <View style={styles.card}>
            <Text style={styles.errorText}>Profile not found.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <View style={styles.profileHeader}>
                <View style={styles.profileInfo}>
                  <Row label="Username" value={profile.username} />
                  <Row label="Profile ID" value={String(profile.id)} />
                  <Row label="Supabase UID" value={profile.supabase_uid} />
                  {profile.bio ? <Row label="Bio" value={profile.bio} /> : null}
                  <View style={styles.countsRow}>
                    <View style={styles.countBlock}>
                      <Text style={styles.countNumber}>{followerCount}</Text>
                      <Text style={styles.countLabel}>Followers</Text>
                    </View>
                    <View style={styles.countBlock}>
                      <Text style={styles.countNumber}>{followingCount}</Text>
                      <Text style={styles.countLabel}>Following</Text>
                    </View>
                  </View>
                </View>
                {!isOwnProfile && (
                  <TouchableOpacity
                    onPress={handleFollowPress}
                    disabled={followLoading}
                    style={[
                      styles.followButton,
                      isFollowing ? styles.followingButton : styles.followButtonSolid,
                    ]}
                  >
                    {followLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowing ? "#333" : "#fff"}
                      />
                    ) : isFollowing ? (
                      <>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#333"
                          style={styles.followIcon}
                        />
                        <Text style={styles.followingButtonText}>Following</Text>
                      </>
                    ) : (
                      <Text style={styles.followButtonText}>Follow</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Daily scent</Text>
              {dailyScent ? (
                <View style={styles.dailyScentBox}>
                  <Text style={styles.fragranceName}>{dailyScent.fragrance}</Text>
                  <Text style={styles.fragranceMeta}>{dailyScent.brand}</Text>
                </View>
              ) : (
                <Text style={styles.mutedText}>No daily scent set for this day.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Collection</Text>
              {profile.collection && profile.collection.length > 0 ? (
                profile.collection.map((item: CollectionItem) => (
                  <View key={item.id + "-" + item.size} style={styles.collectionRow}>
                    <Text style={styles.fragranceName}>{item.fragrance}</Text>
                    <Text style={styles.fragranceMeta}>
                      {item.brand} · {item.size}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>This user has no items in their collection yet.</Text>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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

  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  profileInfo: {
    flex: 1,
    flexShrink: 1,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  followButtonSolid: {
    backgroundColor: "#111",
  },
  followingButton: {
    backgroundColor: "#e8e8e8",
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  followingButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  followIcon: {
    marginRight: 4,
  },
  countsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  countBlock: {
    alignItems: "center",
    minWidth: 60,
  },
  countNumber: { fontSize: 17, fontWeight: "900", color: "#111" },
  countLabel: { fontSize: 12, color: "#555", marginTop: 1 },
  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  rowValue: { marginTop: 4, fontSize: 14, color: "#444" },

  errorText: { fontSize: 14, color: "#b00020" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#111", marginBottom: 6 },
  dailyScentBox: { marginTop: 4 },
  fragranceName: { fontSize: 14, fontWeight: "700", color: "#111" },
  fragranceMeta: { fontSize: 13, color: "#555", marginTop: 2 },
  mutedText: { fontSize: 13, color: "#777" },
  collectionRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
});

