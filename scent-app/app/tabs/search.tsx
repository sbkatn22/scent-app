// app/(tabs)/search.tsx

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { FragranceDetailModal } from "@/components/fragrance-detail-modal";
import { FragranceApiItem, searchFragrances } from "@/lib/api";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  const [results, setResults] = useState<FragranceApiItem[]>([]);
  const [count, setCount] = useState(0);

  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FragranceApiItem | null>(null);

  // debounce typing
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const canLoadMore = results.length < count;

  // Prevent out-of-order responses from overwriting newer searches
  const requestSeq = useRef(0);

  const load = async (opts: { q: string; page: number; append: boolean }) => {
    const seq = ++requestSeq.current;

    try {
      setError(null);
      if (opts.append) setLoadingMore(true);
      else setLoadingInitial(true);

      const data = await searchFragrances(opts.q || undefined, opts.page);

      // Ignore stale responses
      if (seq !== requestSeq.current) return;

      setCount(data.count ?? 0);
      setPage(opts.page);
      setResults((prev) => (opts.append ? [...prev, ...(data.results ?? [])] : data.results ?? []));
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      setError(e?.message ?? "Failed to load fragrances.");
      if (!opts.append) {
        setResults([]);
        setCount(0);
      }
    } finally {
      if (seq !== requestSeq.current) return;
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  };

  // initial + whenever debounced query changes
  useEffect(() => {
    load({ q: debounced, page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const onClear = () => setQuery("");

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
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={onClear} hitSlop={10}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </Pressable>
        )}
      </View>

      {/* Status */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => load({ q: debounced, page: 1, append: false })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Results */}
      {loadingInitial ? (
        <View style={{ paddingTop: 18 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.fragrance.replaceAll("-", " ")}</Text>
                <Text style={styles.brand}>{item.brand.replaceAll("-", " ")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#999" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 24 }}>
              <Text style={{ color: "#666", textAlign: "center" }}>
                No results{debounced ? ` for "${debounced}"` : ""}.
              </Text>
            </View>
          }
          ListFooterComponent={
            canLoadMore ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, loadingMore && { opacity: 0.7 }]}
                onPress={() => {
                  if (!loadingMore) load({ q: debounced, page: page + 1, append: true });
                }}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </TouchableOpacity>
            ) : results.length > 0 ? (
              <Text style={styles.footerHint}>
                Showing {results.length} of {count}
              </Text>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <FragranceDetailModal
        fragrance={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 16 },

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
  input: { flex: 1, fontSize: 16 },

  errorBox: {
    backgroundColor: "#fde7ea",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  errorText: { color: "#b00020", fontWeight: "800", flex: 1 },
  retryBtn: {
    backgroundColor: "#111",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "800" },

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

  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 10,
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  loadMoreText: { fontWeight: "800", color: "#111" },
  footerHint: { textAlign: "center", marginTop: 14, color: "#777" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "82%",
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
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  detailName: { fontSize: 22, fontWeight: "800", color: "#111" },
  detailBrand: { fontSize: 15, color: "#666", marginTop: 3 },
  detailMeta: { fontSize: 12.5, color: "#888", marginTop: 6 },

  imagePlaceholder: {
    marginTop: 12,
    height: 130,
    borderRadius: 14,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePlaceholderText: { color: "#666", fontWeight: "700" },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  ratingText: { color: "#444", fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 10 },

  infoCard: {
    backgroundColor: "#f7f7f7",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  infoLabel: { fontSize: 12, color: "#666", fontWeight: "800", marginBottom: 6 },
  infoValue: { color: "#111", fontWeight: "700", lineHeight: 18 },

  mutedHint: { color: "#888", textAlign: "center", marginTop: 6, fontWeight: "700" },

  // ===== Reviews UI =====
  reviewsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#f2f2f2",
  },
  writeReviewText: { fontSize: 13, fontWeight: "800", color: "#111" },

  emptyReviews: {
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 14,
  },
  emptyReviewsTitle: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  emptyReviewsSubtitle: { fontSize: 13, color: "#666", marginTop: 6 },

  reviewsCountText: { color: "#777", marginBottom: 8, fontWeight: "700" },

  reviewCard: {
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  reviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  reviewMetaText: { color: "#111", fontWeight: "900", fontSize: 12.5 },
  reviewDateText: { color: "#777", fontSize: 12, marginTop: 2 },
  reviewRatingText: { color: "#111", fontWeight: "900" },
  reviewBodyText: { color: "#111", fontWeight: "700", lineHeight: 18 },

  textField: {
    backgroundColor: "#f2f2f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: "#111",
  },
  chipText: { color: "#111", fontWeight: "800", fontSize: 12.5 },
  chipTextActive: { color: "#fff" },

  primaryBtnModal: {
    marginTop: 18,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },
});