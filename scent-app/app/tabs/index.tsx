import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  searchUsers,
  getFollowing,
  getFollowers,
  getFragranceById,
  getUserEvents,
  getLikedFragrances,
  getWishlist,
  type UserSummary,
  type FragranceApiItem,
  type AppEvent,
} from "../../lib/api";
import { getMyReviews, deleteReview, type Review } from "../../lib/reviews";

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

const OCCASIONS = [
  { key: "winter", label: "Winter", icon: "snow-outline" },
  { key: "spring", label: "Spring", icon: "flower-outline" },
  { key: "summer", label: "Summer", icon: "umbrella-outline" },
  { key: "autumn", label: "Autumn", icon: "leaf-outline" },
  { key: "day",    label: "Day",    icon: "sunny-outline" },
  { key: "night",  label: "Night",  icon: "moon-outline" },
] as const;

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
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [fragranceNames, setFragranceNames] = useState<Record<number, FragranceApiItem>>({});
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const [events, setEvents] = useState<AppEvent[]>([]);
  const [likedFragrances, setLikedFragrances] = useState<FragranceApiItem[]>([]);
  const [wishlist, setWishlist] = useState<FragranceApiItem[]>([]);

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

  useFocusEffect(
    useCallback(() => {
      const loadAll = async () => {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) return;

        try {
          const [followingRes, followersRes] = await Promise.all([
            getFollowing(token),
            getFollowers(token),
          ]);
          setFollowingCount(followingRes.following.length);
          setFollowersCount(followersRes.followers.length);
        } catch {
          // ignore; counts stay 0
        }

        try {
          const profileRaw = await AsyncStorage.getItem("profile");
          if (profileRaw) {
            const profile = JSON.parse(profileRaw);
            const uid = profile?.supabase_uid;
            if (uid) {
              const [eventsRes, likedRes, wishlistRes] = await Promise.all([
                getUserEvents(uid, token).catch(() => ({ count: 0, results: [] })),
                getLikedFragrances(token).catch(() => ({ liked_fragrances: [] })),
                getWishlist(token).catch(() => ({ wishlist: [] })),
              ]);
              setEvents(eventsRes.results.slice(0, 20));
              setLikedFragrances(likedRes.liked_fragrances ?? []);
              setWishlist(wishlistRes.wishlist ?? []);
            }
          }
        } catch {
          // ignore
        }

        setReviewsLoading(true);
        try {
          const reviewsRes = await getMyReviews();
          const reviews = reviewsRes.results ?? [];
          setMyReviews(reviews);

          const uniqueFids = [...new Set(reviews.map((r) => r.fid))];
          const fragranceEntries = await Promise.all(
            uniqueFids.map((fid) =>
              getFragranceById(fid)
                .then((f) => [fid, f] as const)
                .catch(() => [fid, null] as const)
            )
          );
          const nameMap: Record<number, FragranceApiItem> = {};
          for (const [fid, fragrance] of fragranceEntries) {
            if (fragrance) nameMap[fid] = fragrance;
          }
          setFragranceNames(nameMap);
        } catch {
          // ignore; reviews stay empty
        } finally {
          setReviewsLoading(false);
        }
      };

      loadAll();
    }, [])
  );

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

  const handleDeleteReview = async (reviewId: number) => {
    setDeletingReviewId(reviewId);
    try {
      await deleteReview(reviewId);
      setMyReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {
      // silently ignore; review stays in the list
    } finally {
      setDeletingReviewId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Account details (from local storage)</Text>

        <View style={styles.countsRow}>
          <TouchableOpacity
            style={styles.countBlock}
            onPress={() => router.push("/following" as never)}
          >
            <Text style={styles.countNumber}>{followingCount}</Text>
            <Text style={styles.countLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.countBlock}
            onPress={() => router.push("/followers" as never)}
          >
            <Text style={styles.countNumber}>{followersCount}</Text>
            <Text style={styles.countLabel}>Followers</Text>
          </TouchableOpacity>
        </View>

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

        {/* Your Reviews */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Your Reviews</Text>

        {reviewsLoading ? (
          <View style={{ marginTop: 12 }}>
            <ActivityIndicator />
          </View>
        ) : myReviews.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptySubtitle}>
              Head to the Search tab to find a fragrance and write your first review.
            </Text>
          </View>
        ) : (
          myReviews.map((review) => {
            const fragrance = fragranceNames[review.fid];
            return (
              <TouchableOpacity
                key={review.id}
                style={styles.reviewCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (fragrance) router.push({ pathname: "/tabs/fragrance-details", params: { data: JSON.stringify(fragrance) } });
                }}
              >
                <View style={styles.reviewCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewFragranceName} numberOfLines={1}>
                      {fragrance ? fragrance.fragrance.replaceAll("-", " ") : `Fragrance #${review.fid}`}
                    </Text>
                    {fragrance && (
                      <Text style={styles.reviewFragranceBrand} numberOfLines={1}>
                        {fragrance.brand.replaceAll("-", " ")}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.reviewRatingBadge}>
                      <Ionicons name="star" size={12} color="#fff" />
                      <Text style={styles.reviewRatingText}>{Number(review.rating).toFixed(1)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.reviewDeleteBtn}
                      onPress={() => handleDeleteReview(review.id)}
                      disabled={deletingReviewId === review.id}
                    >
                      {deletingReviewId === review.id ? (
                        <ActivityIndicator size="small" color="#b00020" />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color="#b00020" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.reviewBody} numberOfLines={3}>{review.description}</Text>

                <View style={styles.reviewOccasionRow}>
                  {OCCASIONS.map(({ key, label, icon }) => {
                    const active = review[key as keyof Review] as boolean;
                    return (
                      <View key={key} style={styles.reviewOccasionItem}>
                        <Ionicons
                          name={icon as any}
                          size={16}
                          color={active ? "#111" : "#ddd"}
                        />
                        <Text style={[styles.reviewOccasionLabel, active && styles.reviewOccasionLabelActive]}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewMetaText}>{review.gender}</Text>
                  <Text style={styles.reviewMetaDot}>·</Text>
                  <Text style={styles.reviewMetaText}>{review.longevity}</Text>
                  <Text style={styles.reviewMetaDot}>·</Text>
                  <Text style={styles.reviewMetaText}>
                    {review.value === "Alright" ? "Perfectly Priced" : review.value}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Liked Fragrances */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Liked Fragrances</Text>
        {likedFragrances.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptySubtitle}>No liked fragrances yet.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {likedFragrances.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.fragranceCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/tabs/fragrance-details", params: { data: JSON.stringify(item) } })}
              >
                <Text style={styles.fragranceCardName} numberOfLines={2}>{item.fragrance?.replaceAll("-", " ")}</Text>
                <Text style={styles.fragranceCardBrand} numberOfLines={1}>{item.brand?.replaceAll("-", " ")}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Wishlist */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Wishlist</Text>
        {wishlist.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptySubtitle}>Wishlist is empty.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {wishlist.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.fragranceCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/tabs/fragrance-details", params: { data: JSON.stringify(item) } })}
              >
                <Text style={styles.fragranceCardName} numberOfLines={2}>{item.fragrance?.replaceAll("-", " ")}</Text>
                <Text style={styles.fragranceCardBrand} numberOfLines={1}>{item.brand?.replaceAll("-", " ")}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Recent Activity */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Activity</Text>
        {events.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptySubtitle}>No recent activity.</Text>
          </View>
        ) : (
          events.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              <View style={styles.eventDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.eventLabel}>{formatEvent(ev)}</Text>
                <Text style={styles.eventTime}>{new Date(ev.timestamp).toLocaleString()}</Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scroll: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 40 },

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

  countsRow: {
    flexDirection: "row",
    marginTop: 18,
    gap: 12,
  },
  countBlock: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  countNumber: { fontSize: 20, fontWeight: "900", color: "#111" },
  countLabel: { fontSize: 13, color: "#555", marginTop: 2 },

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

  reviewCard: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  reviewFragranceName: { fontSize: 15, fontWeight: "800", color: "#111" },
  reviewFragranceBrand: { fontSize: 13, color: "#666", marginTop: 2 },
  reviewDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fde7ea",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#111",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewRatingText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  reviewBody: { fontSize: 13.5, color: "#333", lineHeight: 19, marginBottom: 10 },
  reviewOccasionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  reviewOccasionItem: { alignItems: "center", gap: 3 },
  reviewOccasionLabel: { fontSize: 9, color: "#ddd", fontWeight: "700" },
  reviewOccasionLabelActive: { color: "#555" },

  reviewMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  reviewMetaText: { fontSize: 12, color: "#777", fontWeight: "600" },
  reviewMetaDot: { fontSize: 12, color: "#bbb" },

  horizontalList: { paddingVertical: 8 },
  fragranceCard: { width: 160, backgroundColor: "#fafafa", borderRadius: 16, padding: 14, marginRight: 12 },
  fragranceCardName: { fontSize: 14, fontWeight: "900", color: "#111", lineHeight: 18 },
  fragranceCardBrand: { fontSize: 12, color: "#666", marginTop: 4 },

  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10, backgroundColor: "#fafafa", borderRadius: 12, paddingHorizontal: 12, marginTop: 8 },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#111", marginTop: 4 },
  eventLabel: { fontSize: 13.5, fontWeight: "700", color: "#111" },
  eventTime: { fontSize: 11.5, color: "#888", marginTop: 2 },

  logoutBtn: {
    marginTop: 24,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },
});