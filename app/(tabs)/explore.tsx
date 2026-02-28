import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Fragrance = {
  id: string;
  name: string;
  brand: string;
  image?: string; // placeholder now, DB later
};

type FriendWear = {
  id: string;
  name: string;
  wearing: {
    fragranceName: string;
    brand: string;
  } | null; // null = not set today
};

const MOCK_ALL_FRAGRANCES: Fragrance[] = [
  {
    id: "1",
    name: "Aventus",
    brand: "Creed",
    image:
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "2",
    name: "Bleu de Chanel",
    brand: "Chanel",
    image:
      "https://images.unsplash.com/photo-1523292562811-8fa7962a78c8?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "3",
    name: "Oud Wood",
    brand: "Tom Ford",
    image:
      "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "4",
    name: "Sauvage",
    brand: "Dior",
    image:
      "https://images.unsplash.com/photo-1619994403073-2cec844b8f90?auto=format&fit=crop&w=800&q=60",
  },
  {
    id: "5",
    name: "One Million",
    brand: "Paco Rabanne",
    image:
      "https://images.unsplash.com/photo-1619994403073-2cec844b8f90?auto=format&fit=crop&w=800&q=60",
  },
];

const MOCK_FRIENDS: FriendWear[] = [
  {
    id: "f1",
    name: "Sam",
    wearing: { fragranceName: "Bleu de Chanel", brand: "Chanel" },
  },
  {
    id: "f2",
    name: "Maya",
    wearing: { fragranceName: "Oud Wood", brand: "Tom Ford" },
  },
  {
    id: "f3",
    name: "Arjun",
    wearing: { fragranceName: "Sauvage", brand: "Dior" },
  },
  {
    id: "f4",
    name: "Nia",
    wearing: null,
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function ExploreScreen() {
  // mock user (replace later with auth user)
  const userName = "Dickshit";

  // mock: user’s collection (store IDs)
  const [collectionIds, setCollectionIds] = useState<string[]>(["1", "2", "5"]);
  const [cologneOfDayId, setCologneOfDayId] = useState<string | null>("5");

  // modals
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [cotdModalOpen, setCotdModalOpen] = useState(false);

  const collection = useMemo(
    () => MOCK_ALL_FRAGRANCES.filter((f) => collectionIds.includes(f.id)),
    [collectionIds]
  );

  const cologneOfDay = useMemo(
    () => MOCK_ALL_FRAGRANCES.find((f) => f.id === cologneOfDayId) ?? null,
    [cologneOfDayId]
  );

  const toggleInCollection = (id: string) => {
    setCollectionIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];

      // if user removed the selected COTD, clear it
      if (exists && cologneOfDayId === id) setCologneOfDayId(null);

      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hi {userName} 👋</Text>
            <Text style={styles.subGreeting}>
              Here’s your collection and today’s pick.
            </Text>
          </View>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(userName)}</Text>
          </View>
        </View>

        {/* Cologne of the Day */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Cologne of the Day</Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => setCotdModalOpen(true)}
          >
            <Ionicons name="sparkles-outline" size={16} color="#111" />
            <Text style={styles.linkBtnText}>Choose</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cotdCard}>
          {cologneOfDay ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.cotdName}>{cologneOfDay.name}</Text>
                <Text style={styles.cotdBrand}>{cologneOfDay.brand}</Text>
                <Text style={styles.cotdHint}>Your pick for today ✅</Text>
              </View>

              <TouchableOpacity
                onPress={() => setCologneOfDayId(null)}
                style={styles.smallIconBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color="#111" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No pick yet</Text>
              <Text style={styles.emptySubtitle}>
                Choose one from your collection to set your vibe for today.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setCotdModalOpen(true)}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  Pick Cologne of the Day
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Collection */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Collection</Text>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => setManageModalOpen(true)}
          >
            <Ionicons name="add-circle-outline" size={16} color="#111" />
            <Text style={styles.linkBtnText}>Add/Remove</Text>
          </TouchableOpacity>
        </View>

        {collection.length === 0 ? (
          <View style={styles.emptyCollection}>
            <Text style={styles.emptyTitle}>Your collection is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add a few fragrances to get started.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setManageModalOpen(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Add to Collection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            horizontal
            data={collection}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 6 }}
            renderItem={({ item }) => {
              const isToday = item.id === cologneOfDayId;
              return (
                <TouchableOpacity
                  style={[
                    styles.collectionCard,
                    isToday && styles.collectionCardActive,
                  ]}
                  onPress={() => setCologneOfDayId(item.id)}
                >
                  <View style={styles.collectionIcon}>
                    <Ionicons name="flask-outline" size={18} color="#111" />
                  </View>
                  <Text style={styles.collectionName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.collectionBrand} numberOfLines={1}>
                    {item.brand}
                  </Text>

                  {isToday && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Today</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ✅ Friends Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="people-outline" size={16} color="#111" />
            <Text style={styles.friendSubText}>Wearing today</Text>
          </View>
        </View>

        <FlatList
          horizontal
          data={MOCK_FRIENDS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 6, paddingBottom: 18 }}
          renderItem={({ item }) => {
            return (
              <View style={styles.friendCard}>
                <View style={styles.friendTopRow}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                      {initials(item.name)}
                    </Text>
                  </View>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>

                {item.wearing ? (
                  <>
                    <Text style={styles.friendLabel}>Wearing Today</Text>
                    <Text style={styles.friendFrag} numberOfLines={1}>
                      {item.wearing.fragranceName}
                    </Text>
                    <Text style={styles.friendBrand} numberOfLines={1}>
                      {item.wearing.brand}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.friendLabel}>No pick yet</Text>
                    <Text style={styles.friendEmpty}>Ask them to set one 👀</Text>
                  </>
                )}
              </View>
            );
          }}
        />

        {/* ===== Manage Collection Modal ===== */}
        <Modal
          visible={manageModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setManageModalOpen(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setManageModalOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Manage Collection</Text>
              <Pressable onPress={() => setManageModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#111" />
              </Pressable>
            </View>

            <Text style={styles.sheetSubtitle}>
              Tap to add/remove fragrances (mock list for now).
            </Text>

            <FlatList
              data={MOCK_ALL_FRAGRANCES}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const inCollection = collectionIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.rowItem}
                    onPress={() => toggleInCollection(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowBrand}>{item.brand}</Text>
                    </View>
                    <View
                      style={[
                        styles.pill,
                        inCollection ? styles.pillOn : styles.pillOff,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          inCollection ? styles.pillTextOn : styles.pillTextOff,
                        ]}
                      >
                        {inCollection ? "In Collection" : "Add"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>

        {/* ===== Choose COTD Modal ===== */}
        <Modal
          visible={cotdModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCotdModalOpen(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setCotdModalOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopRow}>
              <Text style={styles.sheetTitle}>Pick Cologne of the Day</Text>
              <Pressable onPress={() => setCotdModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#111" />
              </Pressable>
            </View>

            {collection.length === 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <Text style={styles.emptyTitle}>No items in your collection</Text>
                <Text style={styles.emptySubtitle}>
                  Add fragrances first, then pick one for today.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { alignSelf: "flex-start", marginTop: 10 },
                  ]}
                  onPress={() => {
                    setCotdModalOpen(false);
                    setManageModalOpen(true);
                  }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Add to Collection</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={collection}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const isSelected = item.id === cologneOfDayId;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.rowItem,
                        isSelected && { borderColor: "#111", borderWidth: 1 },
                      ]}
                      onPress={() => {
                        setCologneOfDayId(item.id);
                        setCotdModalOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.rowBrand}>{item.brand}</Text>
                      </View>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#111"
                        />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="#999" />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 28,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#111" },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#f2f2f2",
  },
  linkBtnText: { fontSize: 13, fontWeight: "700", color: "#111" },

  cotdCard: {
    backgroundColor: "#fafafa",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    gap: 10,
  },
  cotdName: { fontSize: 18, fontWeight: "900", color: "#111" },
  cotdBrand: { fontSize: 14, color: "#666", marginTop: 2 },
  cotdHint: { fontSize: 12.5, color: "#444", marginTop: 8 },

  smallIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  emptySubtitle: { fontSize: 13.5, color: "#666", marginTop: 6, lineHeight: 18 },

  emptyCollection: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
  },

  collectionCard: {
    width: 145,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    marginRight: 14,
    overflow: "hidden",
  },
  collectionCardActive: {
    borderWidth: 1.5,
    borderColor: "#111",
  },
  collectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  collectionName: { fontSize: 15, fontWeight: "900", color: "#111" },
  collectionBrand: { fontSize: 13, color: "#666", marginTop: 3 },

  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#111",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  // Friends
  friendSubText: { fontSize: 13, fontWeight: "700", color: "#111" },
  friendCard: {
    width: 175,
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    marginRight: 14,
  },
  friendTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  friendAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  friendName: { fontSize: 15, fontWeight: "900", color: "#111", flex: 1 },

  friendLabel: { fontSize: 12.5, color: "#666", marginBottom: 6 },
  friendFrag: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  friendBrand: { fontSize: 13.5, color: "#666", marginTop: 4 },
  friendEmpty: { fontSize: 13.5, color: "#333", fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
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
  sheetTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  sheetSubtitle: { fontSize: 13, color: "#666", marginBottom: 10 },

  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowName: { fontSize: 15, fontWeight: "900", color: "#111" },
  rowBrand: { fontSize: 13, color: "#666", marginTop: 3 },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillOn: { backgroundColor: "#111" },
  pillOff: { backgroundColor: "#eaeaea" },
  pillText: { fontWeight: "800", fontSize: 12.5 },
  pillTextOn: { color: "#fff" },
  pillTextOff: { color: "#111" },
});