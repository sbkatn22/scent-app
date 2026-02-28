import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Review = {
  id: string;
  username: string;
  rating: number; // 1-5
  text: string;
};

type Fragrance = {
  id: string;
  name: string;
  brand: string;
  notes?: string; // mock: "pineapple, birch, musk"
  avgRating?: number; // mock
  reviewCount?: number; // mock
  reviews?: Review[]; // mock
};

function Stars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < full ? "star" : "star-outline"}
          size={16}
          color="#111"
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Fragrance | null>(null);

  // 🔥 Mock Data
  const mockData: Fragrance[] = [
    {
      id: "1",
      name: "Aventus",
      brand: "Creed",
      notes: "Pineapple • Birch • Musk",
      avgRating: 4.6,
      reviewCount: 128,
      reviews: [
        { id: "r1", username: "parthivi", rating: 5, text: "Fresh, loud, confident. Perfect for nights out." },
        { id: "r2", username: "sam", rating: 4, text: "Great DNA, but performance varies by batch." },
      ],
    },
    {
      id: "2",
      name: "Bleu de Chanel",
      brand: "Chanel",
      notes: "Citrus • Incense • Woods",
      avgRating: 4.4,
      reviewCount: 203,
      reviews: [
        { id: "r3", username: "maya", rating: 5, text: "Clean + versatile. Office-safe, date-safe." },
        { id: "r4", username: "dev", rating: 4, text: "Classic. Not unique, but always works." },
      ],
    },
    {
      id: "3",
      name: "Oud Wood",
      brand: "Tom Ford",
      notes: "Oud • Amber • Vanilla",
      avgRating: 4.2,
      reviewCount: 84,
      reviews: [
        { id: "r5", username: "arjun", rating: 4, text: "Smooth, cozy oud. Expensive, but beautiful." },
      ],
    },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockData;
    return mockData.filter(
      (x) => x.name.toLowerCase().includes(q) || x.brand.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔍 Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          placeholder="Search fragrances..."
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          placeholderTextColor="#999"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </Pressable>
        )}
      </View>

      {/* 🧴 Results */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.brand}>{item.brand}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
        )}
      />

      {/* 📌 Popup Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        {/* Dark backdrop */}
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />

        {/* Bottom sheet */}
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{selected?.name}</Text>
              <Text style={styles.detailBrand}>{selected?.brand}</Text>
              {!!selected?.notes && <Text style={styles.detailNotes}>{selected.notes}</Text>}
            </View>

            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Ionicons name="close" size={22} color="#111" />
            </Pressable>
          </View>

          {/* Rating row */}
          <View style={styles.ratingRow}>
            <Stars rating={selected?.avgRating ?? 0} />
            <Text style={styles.ratingText}>
              {selected?.avgRating?.toFixed(1)} • {selected?.reviewCount} reviews
            </Text>
          </View>

          {/* Add Review */}
          <TouchableOpacity style={styles.addReviewBtn} onPress={() => {}}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.addReviewText}>Add your review</Text>
          </TouchableOpacity>

          {/* Reviews list */}
          <Text style={styles.sectionTitle}>Reviews</Text>
          <FlatList
            data={selected?.reviews ?? []}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <View style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <Text style={styles.reviewUser}>@{item.username}</Text>
                  <Stars rating={item.rating} />
                </View>
                <Text style={styles.reviewBody}>{item.text}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: "700", color: "#111" },
  brand: { fontSize: 14, color: "#666", marginTop: 4 },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "78%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#ddd",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailName: { fontSize: 22, fontWeight: "800", color: "#111" },
  detailBrand: { fontSize: 15, color: "#666", marginTop: 3 },
  detailNotes: { fontSize: 13, color: "#888", marginTop: 6 },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 14,
  },
  ratingText: { color: "#444", fontSize: 13 },

  addReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  addReviewText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 10 },

  reviewCard: {
    backgroundColor: "#f7f7f7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  reviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewUser: { fontWeight: "700", color: "#111" },
  reviewBody: { color: "#333", lineHeight: 18 },
});