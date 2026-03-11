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
  getUserEvents,
  getLikedFragrances,
  getWishlist,
  type Profile,
  type FragranceApiItem,
  type CollectionItem,
  type AppEvent,
} from "../../lib/api";

function formatEvent(ev: AppEvent): string {
  const who = ev.username ?? "Someone";
  const target = ev.target_label;
  switch (ev.action) {
    case "COLLECTION_ADD":    return target ? `${who} added ${target} to their collection` : `${who} added a fragrance to their collection`;
    case "COLLECTION_REMOVE": return target ? `${who} removed ${target} from their collection` : `${who} removed a fragrance from their collection`;
    case "DAILY_SCENT_SET":   return target ? `${who} set ${target} as their daily scent` : `${who} set a daily scent`;
    case "DAILY_SCENT_REMOVE":return `${who} removed their daily scent`;
    case "FOLLOW":            return target ? `${who} followed ${target}` : `${who} followed someone`;
    case "UNFOLLOW":          return target ? `${who} unfollowed ${target}` : `${who} unfollowed someone`;
    case "REVIEW_CREATE":     return target ? `${who} reviewed ${target}` : `${who} wrote a review`;
    case "REVIEW_UPDATE":     return target ? `${who} updated their review of ${target}` : `${who} updated a review`;
    case "REVIEW_DELETE":     return target ? `${who} deleted their review of ${target}` : `${who} deleted a review`;
    case "WISHLIST_ADD":      return target ? `${who} wishlisted ${target}` : `${who} added to wishlist`;
    case "WISHLIST_REMOVE":   return target ? `${who} removed ${target} from wishlist` : `${who} removed from wishlist`;
    case "LIKE_FRAGRANCE":    return target ? `${who} liked ${target}` : `${who} liked a fragrance`;
    case "UNLIKE_FRAGRANCE":  return target ? `${who} unliked ${target}` : `${who} unliked a fragrance`;
    case "LIKE_REVIEW":       return target ? `${who} liked a review of ${target}` : `${who} liked a review`;
    case "UNLIKE_REVIEW":     return target ? `${who} unliked a review of ${target}` : `${who} unliked a review`;
    case "LIKE_COMMENT":      return target ? `${who} liked a comment on ${target}` : `${who} liked a comment`;
    case "UNLIKE_COMMENT":    return target ? `${who} unliked a comment on ${target}` : `${who} unliked a comment`;
    default:                  return `${who}: ${ev.action}`;
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

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

  const [events, setEvents] = useState<AppEvent[]>([]);
  const [likedFragrances, setLikedFragrances] = useState<FragranceApiItem[]>([]);
  const [wishlist, setWishlist] = useState<FragranceApiItem[]>([]);

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
        const ownProfile = meRes.profile.supabase_uid === profileUid;
        setIsOwnProfile(ownProfile);
        setIsFollowing(followingRes.following.some((f) => f.uid === profileUid));

        // Load events, liked fragrances and wishlist for this profile's uid
        const [eventsRes, likedRes, wishlistRes] = await Promise.all([
          getUserEvents(profileUid, token).catch(() => ({ count: 0, results: [] })),
          ownProfile ? getLikedFragrances(token).catch(() => ({ liked_fragrances: [] })) : Promise.resolve({ liked_fragrances: [] }),
          ownProfile ? getWishlist(token).catch(() => ({ wishlist: [] })) : Promise.resolve({ wishlist: [] }),
        ]);
        setEvents(eventsRes.results.slice(0, 20));
        setLikedFragrances((likedRes as any).liked_fragrances ?? []);
        setWishlist((wishlistRes as any).wishlist ?? []);
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
            {/* Profile Header */}
            <View style={styles.card}>
              <View style={styles.profileHeader}>
                <View style={styles.profileInfo}>
                  <Row label="Username" value={profile.username} />
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
                    style={[styles.followButton, isFollowing ? styles.followingButton : styles.followButtonSolid]}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color={isFollowing ? "#333" : "#fff"} />
                    ) : isFollowing ? (
                      <>
                        <Ionicons name="checkmark" size={16} color="#333" style={styles.followIcon} />
                        <Text style={styles.followingButtonText}>Following</Text>
                      </>
                    ) : (
                      <Text style={styles.followButtonText}>Follow</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Daily Scent */}
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

            {/* Collection */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Collection</Text>
              {profile.collection && profile.collection.length > 0 ? (
                profile.collection.map((item: CollectionItem) => (
                  <View key={item.id + "-" + item.size} style={styles.fragranceRow}>
                    <Text style={styles.fragranceName}>{item.fragrance}</Text>
                    <Text style={styles.fragranceMeta}>{item.brand} · {item.size}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>No items in collection yet.</Text>
              )}
            </View>

            {/* Liked Fragrances (own profile only) */}
            {isOwnProfile && (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="heart" size={15} color="#e53935" />
                  <Text style={styles.sectionTitle}>Liked Fragrances</Text>
                </View>
                {likedFragrances.length > 0 ? (
                  likedFragrances.map((item) => (
                    <View key={item.id} style={styles.fragranceRow}>
                      <Text style={styles.fragranceName}>{item.fragrance}</Text>
                      <Text style={styles.fragranceMeta}>{item.brand}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.mutedText}>No liked fragrances yet.</Text>
                )}
              </View>
            )}

            {/* Wishlist (own profile only) */}
            {isOwnProfile && (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="bookmark" size={15} color="#111" />
                  <Text style={styles.sectionTitle}>Wishlist</Text>
                </View>
                {wishlist.length > 0 ? (
                  wishlist.map((item) => (
                    <View key={item.id} style={styles.fragranceRow}>
                      <Text style={styles.fragranceName}>{item.fragrance}</Text>
                      <Text style={styles.fragranceMeta}>{item.brand}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.mutedText}>Wishlist is empty.</Text>
                )}
              </View>
            )}

            {/* Activity / Events */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {events.length > 0 ? (
                events.map((ev) => (
                  <View key={ev.id} style={styles.eventRow}>
                    <View style={styles.eventDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventLabel}>{formatEvent(ev)}</Text>
                      <Text style={styles.eventTime}>{formatTime(ev.timestamp)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.mutedText}>No recent activity.</Text>
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
      <Text style={styles.rowValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: "700", color: "#111" },
  title: { fontSize: 20, fontWeight: "900", color: "#111" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 24 },

  card: { marginTop: 12, backgroundColor: "#fafafa", borderRadius: 16, padding: 14 },

  profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  profileInfo: { flex: 1, flexShrink: 1 },
  followButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minWidth: 100, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  followButtonSolid: { backgroundColor: "#111" },
  followingButton: { backgroundColor: "#e8e8e8" },
  followButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  followingButtonText: { fontSize: 14, fontWeight: "700", color: "#333" },
  followIcon: { marginRight: 4 },

  countsRow: { flexDirection: "row", gap: 10, marginTop: 4, marginBottom: 4 },
  countBlock: { alignItems: "center", minWidth: 60 },
  countNumber: { fontSize: 17, fontWeight: "900", color: "#111" },
  countLabel: { fontSize: 12, color: "#555", marginTop: 1 },

  row: { marginBottom: 12 },
  rowLabel: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  rowValue: { marginTop: 4, fontSize: 14, color: "#444" },

  errorText: { fontSize: 14, color: "#b00020" },

  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#111", marginBottom: 6 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },

  dailyScentBox: { marginTop: 4 },
  fragranceName: { fontSize: 14, fontWeight: "700", color: "#111" },
  fragranceMeta: { fontSize: 13, color: "#555", marginTop: 2 },
  fragranceRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  mutedText: { fontSize: 13, color: "#777" },

  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#111", marginTop: 4 },
  eventLabel: { fontSize: 13.5, fontWeight: "700", color: "#111" },
  eventTime: { fontSize: 11.5, color: "#888", marginTop: 2 },
});
