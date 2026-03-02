// app/(tabs)/search.tsx

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { FragranceApiItem, searchFragrances } from "@/lib/api";
import { createReview, getReviewsForFragrance, Review } from "@/lib/reviews";

function toStars(rating: number) {
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

function prettyList(arr?: string[]) {
  if (!arr || arr.length === 0) return "—";
  return arr.filter(Boolean).join(" • ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

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

  // ===== Reviews: list state =====
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const fetchReviews = async (fid: number) => {
    setReviewsError(null);
    setReviewsLoading(true);
    try {
      const data = await getReviewsForFragrance(fid);
      setReviews(data.results ?? []);
      setReviewsCount(data.count ?? 0);
      console.log("🟣 GET REVIEWS success:", data);
    } catch (e: any) {
      console.log("🔴 GET REVIEWS error:", e?.message ?? e);
      setReviews([]);
      setReviewsCount(0);
      setReviewsError(e?.message ?? "Failed to load reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  // when a fragrance is selected, fetch reviews
  useEffect(() => {
    if (!selected?.id) return;
    fetchReviews(Number(selected.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // ===== Reviews: Write Review modal state =====
  const [writeReviewOpen, setWriteReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [reviewDescription, setReviewDescription] = useState("");
  const [reviewRating, setReviewRating] = useState(""); // string for TextInput

  const [reviewGender, setReviewGender] = useState<
    "Female" | "Slightly Female" | "Unisex" | "Slightly Male" | "Male"
  >("Unisex");

  const [reviewLongevity, setReviewLongevity] = useState<
    "0 - 2 hours" | "2 - 4 hours" | "4 - 6 hours" | "6 - 8 hours" | "8-10 hours" | "10+ hours"
  >("6 - 8 hours");

  const [reviewValue, setReviewValue] = useState<
    "Super Overpriced" | "Overpriced" | "Alright" | "Good Value" | "Super Value"
  >("Alright");

  function resetReviewForm() {
    setReviewDescription("");
    setReviewRating("");
    setReviewGender("Unisex");
    setReviewLongevity("6 - 8 hours");
    setReviewValue("Alright");
    setReviewError(null);
  }

  const submitReview = async () => {
    if (!selected?.id) return;

    setReviewError(null);

    const ratingNum = Number(reviewRating);

    if (!reviewDescription.trim()) {
      setReviewError("Description is required.");
      return;
    }

    if (!Number.isFinite(ratingNum)) {
      setReviewError("Rating must be a number.");
      return;
    }

    if (ratingNum < 0 || ratingNum > 10) {
      setReviewError("Rating must be between 0 and 10.");
      return;
    }

    setReviewLoading(true);

    try {
      const payload = {
        fid: Number(selected.id),
        description: reviewDescription.trim(),
        rating: Number(ratingNum.toFixed(1)),
        gender: reviewGender,
        longevity: reviewLongevity,
        value: reviewValue,
      };

      console.log("🟦 CREATE REVIEW payload:", payload);

      const created = await createReview(payload);

      console.log("🟢 CREATE REVIEW success:", created);

      // close modal + reset
      setWriteReviewOpen(false);
      resetReviewForm();

      // ✅ refresh the list
      await fetchReviews(Number(selected.id));
    } catch (e: any) {
      console.log("🔴 CREATE REVIEW error:", e?.message ?? e);
      setReviewError(e?.message ?? "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

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

  const ratingNum = useMemo(() => {
    const val = selected?.rating_value;
    const n = val ? Number(val) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [selected?.rating_value]);

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
                <Text style={styles.name}>{item.fragrance}</Text>
                <Text style={styles.brand}>{item.brand}</Text>
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

      {/* 📌 Popup Detail Modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)} />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selected?.fragrance}</Text>
                <Text style={styles.detailBrand}>{selected?.brand}</Text>

                <Text style={styles.detailMeta}>
                  {(selected?.gender || "—").toUpperCase()} • {selected?.country || "—"}
                  {selected?.year ? ` • ${selected.year}` : ""}
                </Text>
              </View>

              <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#111" />
              </Pressable>
            </View>

            {/* Placeholder Image */}
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={26} color="#666" />
              <Text style={styles.imagePlaceholderText}>Image placeholder</Text>
            </View>

            {/* Rating row */}
            <View style={styles.ratingRow}>
              {toStars(ratingNum)}
              <Text style={styles.ratingText}>
                {(ratingNum ? ratingNum.toFixed(2) : "—")} • {selected?.rating_count ?? 0} ratings
              </Text>
            </View>

            {/* Notes */}
            <Text style={styles.sectionTitle}>Notes</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Top</Text>
              <Text style={styles.infoValue}>{prettyList(selected?.top_note)}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Middle</Text>
              <Text style={styles.infoValue}>{prettyList(selected?.middle_note)}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Base</Text>
              <Text style={styles.infoValue}>{prettyList(selected?.base_note)}</Text>
            </View>

            {/* Details */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Details</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Accords</Text>
              <Text style={styles.infoValue}>
                {[
                  selected?.mainaccord1,
                  selected?.mainaccord2,
                  selected?.mainaccord3,
                  selected?.mainaccord4,
                  selected?.mainaccord5,
                ]
                  .filter(Boolean)
                  .join(" • ") || "—"}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Perfumer</Text>
              <Text style={styles.infoValue}>
                {[selected?.perfumer1, selected?.perfumer2].filter(Boolean).join(" • ") || "—"}
              </Text>
            </View>

            <View style={[styles.infoCard, { marginBottom: 6 }]}>
              <Text style={styles.infoLabel}>Link</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {selected?.url || "—"}
              </Text>
            </View>

            {/* ===== Reviews section header + button ===== */}
            <View style={styles.reviewsHeaderRow}>
              <Text style={styles.sectionTitle}>Reviews</Text>

              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => {
                  resetReviewForm();
                  setWriteReviewOpen(true);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#111" />
                <Text style={styles.writeReviewText}>Write a review</Text>
              </TouchableOpacity>
            </View>

            {/* ===== Reviews list ===== */}
            {reviewsLoading ? (
              <View style={{ paddingVertical: 10 }}>
                <ActivityIndicator />
              </View>
            ) : reviewsError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{reviewsError}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => selected?.id && fetchReviews(Number(selected.id))}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyReviewsTitle}>No reviews yet</Text>
                <Text style={styles.emptyReviewsSubtitle}>Be the first to write one.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.reviewsCountText}>
                  Showing {reviews.length} of {reviewsCount}
                </Text>

                {reviews.map((r) => (
                  <View key={String(r.id)} style={styles.reviewCard}>
                    <View style={styles.reviewTopRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={styles.reviewAvatar}>
                          <Text style={styles.reviewAvatarText}>{r.gender?.[0] ?? "U"}</Text>
                        </View>
                        <View>
                          <Text style={styles.reviewMetaText}>
                            {r.gender} • {r.longevity} • {r.value}
                          </Text>
                          <Text style={styles.reviewDateText}>{formatDate(r.created_at)}</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="star" size={14} color="#111" />
                        <Text style={styles.reviewRatingText}>{Number(r.rating).toFixed(1)}</Text>
                      </View>
                    </View>

                    <Text style={styles.reviewBodyText}>{r.description}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>

        {/* ✍️ Write Review Modal */}
        <Modal
          visible={writeReviewOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setWriteReviewOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setWriteReviewOpen(false)} />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>Write a Review</Text>
                <Text style={styles.detailBrand}>
                  {selected?.fragrance} • {selected?.brand}
                </Text>
              </View>

              <Pressable onPress={() => setWriteReviewOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#111" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
              {reviewError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{reviewError}</Text>
                </View>
              ) : null}

              {/* Rating */}
              <Text style={styles.infoLabel}>Rating (0–10)</Text>
              <TextInput
                value={reviewRating}
                onChangeText={setReviewRating}
                placeholder="e.g. 8.7"
                keyboardType="decimal-pad"
                style={styles.textField}
                placeholderTextColor="#999"
              />

              {/* Description */}
              <Text style={[styles.infoLabel, { marginTop: 10 }]}>Description</Text>
              <TextInput
                value={reviewDescription}
                onChangeText={setReviewDescription}
                placeholder="Write your thoughts…"
                style={[styles.textField, { height: 110, textAlignVertical: "top" }]}
                placeholderTextColor="#999"
                multiline
                maxLength={500}
              />
              <Text style={{ color: "#888", fontSize: 12, marginTop: 6 }}>
                {reviewDescription.length}/500
              </Text>

              {/* Gender */}
              <Text style={[styles.infoLabel, { marginTop: 14 }]}>Typical wearer</Text>
              <View style={styles.chipRow}>
                {(["Female", "Slightly Female", "Unisex", "Slightly Male", "Male"] as const).map((g) => {
                  const active = reviewGender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setReviewGender(g)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Longevity */}
              <Text style={[styles.infoLabel, { marginTop: 14 }]}>Longevity</Text>
              <View style={styles.chipRow}>
                {(
                  ["0 - 2 hours", "2 - 4 hours", "4 - 6 hours", "6 - 8 hours", "8-10 hours", "10+ hours"] as const
                ).map((l) => {
                  const active = reviewLongevity === l;
                  return (
                    <TouchableOpacity
                      key={l}
                      onPress={() => setReviewLongevity(l)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Value */}
              <Text style={[styles.infoLabel, { marginTop: 14 }]}>Value</Text>
              <View style={styles.chipRow}>
                {(["Super Overpriced", "Overpriced", "Alright", "Good Value", "Super Value"] as const).map((v) => {
                  const active = reviewValue === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => setReviewValue(v)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.primaryBtnModal, reviewLoading && { opacity: 0.7 }]}
                onPress={submitReview}
                disabled={reviewLoading}
              >
                {reviewLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit review</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      </Modal>
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