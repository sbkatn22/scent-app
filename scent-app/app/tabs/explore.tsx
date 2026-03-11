// app/(tabs)/explore.tsx

import { useCollection } from "@/contexts/collection-context";
import { http } from "@/lib/http";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { FragranceForModal, FragranceDetailModal } from "@/components/fragrance-detail-modal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFollowingDailyScents, type FollowingWithScent } from "@/lib/api";

// -------------------------
// TYPES
// -------------------------
type Profile = any;

export type Perfume = FragranceForModal & {
  id: number;
  name?: string;
  image_url?: string;
  score?: number;
  size?: string;
  added_on?: string;
  brand?: string;
};

type Recommendation = Perfume & { score: number };
type Weather = { temperature: number; condition: string };

// -------------------------
// UTILS
// -------------------------
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

// -------------------------
// COMPONENT
// -------------------------
export default function ExploreScreen() {
  const router = useRouter();
  const {
    collection,
    dailyScent,
    setCollection,
    setDailyScent,
    toggleCollection,
    setTodayScent,
  } = useCollection();

  // STATE (profile, recommendations, weather stay local)
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingScents, setFollowingScents] = useState<FollowingWithScent[]>([]);
  const [selectedFragrance, setSelectedFragrance] = useState<FollowingWithScent["daily_scent"] | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // -------------------------
  // FETCH PROFILE & COLLECTION
  // -------------------------
  const loadProfile = async () => {
    try {
      const { data } = await http.get("/api/user/me");
      setProfile(data.profile);
      setCollection(data.profile.collection || []);
    } catch (err) {
      console.log("🟥 loadProfile failed", err);
    }
  };

  // -------------------------
  // FETCH DAILY SCENT (writes to shared context)
  // -------------------------
  const loadDailyScent = async () => {
    try {
      const now = new Date().toISOString();
      const { data } = await http.get("/api/fragrances/daily_scent/get/", {
        params: { timestamp: now },
      });
      setDailyScent(data.daily_scent ?? null);
    } catch (err) {
      console.log("🟥 loadDailyScent failed", err);
    }
  };

  // -------------------------
  // FETCH FOLLOWING DAILY SCENTS
  // -------------------------
  const loadFollowingScents = async () => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      const { following } = await getFollowingDailyScents(token);
      setFollowingScents(following.filter((f) => f.daily_scent !== null));
    } catch (err) {
      console.log("🟥 loadFollowingScents failed", err);
    }
  };

  // -------------------------
  // FETCH WEATHER & RECOMMENDATIONS
  // -------------------------
  const loadRecommendations = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({});
      const { data } = await http.post("/api/fragrances/reccomendations", {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
      });

      setWeather(data.weather);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.log("🟥 loadRecommendations failed", err);
    }
  };

  // -------------------------
  // INITIAL LOAD
  // -------------------------
  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadProfile(), loadDailyScent(), loadRecommendations(), loadFollowingScents()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  const collectionIds = useMemo(() => collection.map((c) => c.id), [collection]);
  const isInCollection = (id: number) => collectionIds.includes(id);
  const isToday = (id: number) => dailyScent?.id === id;

  const userName = profile?.username ?? "—";

  // -------------------------
  // RENDER PERFUME CARD
  // -------------------------
  const renderPerfumeCard = ({ item }: { item: Perfume }) => {
    const today = isToday(item.id);
    const inCollection = isInCollection(item.id);

    return (
      <TouchableOpacity
        style={[styles.collectionCard, today && styles.collectionCardActive]}
        activeOpacity={0.9}
        onPress={() =>
          router.push({
            pathname: "/tabs/fragrance-details",
            params: { data: JSON.stringify(item), from: "explore" },
          })
        }
      >
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={{ height: 100, borderRadius: 12, marginBottom: 8 }}
          />
        )}
        <Text style={styles.collectionName}>
          {(item.fragrance ?? item.name ?? "").replaceAll("-", " ")}
        </Text>
        <Text style={styles.collectionBrand}>
          {(item.brand ?? "").replaceAll("-", " ")}
        </Text>
        {item.size && <Text style={styles.collectionBrand}>{item.size}</Text>}
      </TouchableOpacity>
    );
  };

  // -------------------------
  // RENDER ADD CARD
  // -------------------------
  const renderAddCard = (onPress: () => void) => (
    <TouchableOpacity
      style={[styles.collectionCard, { justifyContent: "center", alignItems: "center" }]}
      onPress={onPress}
    >
      <Text style={{ fontSize: 32, fontWeight: "900", color: "#111" }}>+</Text>
      <Text style={{ marginTop: 6, fontSize: 13, color: "#666", fontWeight: "700" }}>
        Add Perfume
      </Text>
    </TouchableOpacity>
  );

  // -------------------------
  // LOADING
  // -------------------------
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // -------------------------
  // RENDER
  // -------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.greeting}>Hi {userName} 👋</Text>
            <Text style={styles.subGreeting}>Explore your collection and daily picks.</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(userName)}</Text>
          </View>
        </View>

        {/* Cologne of the Day */}
        <View style={{ marginHorizontal: 14, marginTop: 22, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.sectionTitle}>Cologne of the Day</Text>
          {dailyScent && (
            <TouchableOpacity
              onPress={() => setTodayScent(null)}
              style={{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: "#eee", borderRadius: 12 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#111" }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={dailyScent ? [dailyScent] : []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 18 }}
          renderItem={renderPerfumeCard}
          ListEmptyComponent={renderAddCard(() => router.push("/tabs/search"))}
        />

        {/* Following Scents */}
        <View style={{ marginHorizontal: 14, marginTop: 22, marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Friends' Scents</Text>
          <Text style={styles.friendSubText}>What the people you follow are wearing today</Text>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={followingScents}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 18 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.collectionCard}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedFragrance(item.daily_scent);
                setModalVisible(true);
              }}
            >
              <Text style={styles.collectionName}>
                {(item.daily_scent!.fragrance ?? "").replaceAll("-", " ")}
              </Text>
              <Text style={styles.collectionBrand}>
                {(item.daily_scent!.brand ?? "").replaceAll("-", " ")}
              </Text>
              <View style={styles.friendBadge}>
                <Text style={styles.friendBadgeText}>{item.username}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={[styles.collectionCard, { justifyContent: "center", alignItems: "center" }]}>
              <Text style={styles.emptyTitle}>No scents yet</Text>
              <Text style={[styles.emptySubtitle, { textAlign: "center" }]}>
                No one you follow has set their scent today.
              </Text>
            </View>
          }
        />

        {/* Collection */}
        <View style={{ marginHorizontal: 14, marginTop: 22, marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Your Collection</Text>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[...collection, { id: -1, name: "", image_url: "", brand: "" }]} // Add card at the end
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 18 }}
          renderItem={({ item }) =>
            item.id === -1
              ? renderAddCard(() => router.push("/tabs/search"))
              : renderPerfumeCard({ item })
          }
        />

        {/* Daily Recommendations */}
        <View style={{ marginHorizontal: 14, marginTop: 22, marginBottom: 4 }}>
          <Text style={styles.sectionTitle}>Daily Recommendations</Text>
          <Text style={styles.friendSubText}>Based on your weather</Text>
        </View>
        {recommendations.length === 0 ? (
          <View style={[styles.collectionCard, { justifyContent: "center", alignItems: "center", marginHorizontal: 14 }]}>
            <Text style={styles.emptyTitle}>No recommendations yet</Text>
            <Text style={styles.emptySubtitle}>Check back later or refresh to get your daily picks.</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={recommendations}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 18 }}
            renderItem={renderPerfumeCard}
          />
        )}
      </ScrollView>

      <FragranceDetailModal
        fragrance={selectedFragrance}
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setSelectedFragrance(null); }}
      />
    </SafeAreaView>
  );
}

// -------------------------
// STYLES
// -------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 16,
  },
  greeting: { fontSize: 24, fontWeight: "800", color: "#111" },
  subGreeting: { fontSize: 14, color: "#777", marginTop: 6 },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },

  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#111" },
  friendSubText: { fontSize: 14, color: "#555", marginTop: 2 },

  collectionCard: {
    width: 180,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    marginRight: 14,
  },
  collectionCardActive: { borderWidth: 1.5, borderColor: "#111" },
  collectionName: { fontSize: 15, fontWeight: "900", color: "#111" },
  collectionBrand: { fontSize: 13, color: "#666", marginTop: 3 },

  primaryBtn: {
    marginTop: 6,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  emptySubtitle: { fontSize: 13.5, color: "#666", marginTop: 6, lineHeight: 18 },

  friendBadge: { marginTop: 8, backgroundColor: "#111", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  friendBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});