// components/fragrance-detail-modal.tsx

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import { useCollection } from "@/contexts/collection-context";
import type { FragranceApiItem } from "@/lib/api";
import { createReview, getReviewsForFragrance, Review } from "@/lib/reviews";

export type FragranceForModal = Partial<FragranceApiItem> & {
  id: number;
  fragrance?: string;
  brand?: string;
};

type FragranceDetailModalProps = {
  fragrance: FragranceForModal | null;
  visible: boolean;
  onClose: () => void;
};

function prettyList(arr?: string[]) {
  if (!arr || arr.length === 0) return "—";
  return arr.filter(Boolean).join(" • ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export function FragranceDetailModal({
  fragrance,
  visible,
  onClose,
}: FragranceDetailModalProps) {
  const selected = fragrance;
  const { collection, dailyScent, toggleCollection: toggleCollectionContext, setTodayScent } = useCollection();

  const collectionIds = useMemo(() => collection.map((c) => c.id), [collection]);
  const dailyScentId = dailyScent?.id ?? null;

  // ===== Reviews =====
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
    } catch (e: any) {
      setReviews([]);
      setReviewsCount(0);
      setReviewsError(e?.message ?? "Failed to load reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!selected?.id) return;
    fetchReviews(selected.id);
  }, [selected?.id]);

  // ===== Write Review state =====
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
        fid: selected.id,
        description: reviewDescription.trim(),
        rating: Number(ratingNum.toFixed(1)),
        gender: reviewGender,
        longevity: reviewLongevity,
        value: reviewValue,
      };

      await createReview(payload);
      setWriteReviewOpen(false);
      resetReviewForm();
      await fetchReviews(selected.id);
    } catch (e: any) {
      setReviewError(e?.message ?? "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const ratingNum = useMemo(() => {
    const val = selected?.rating_value;
    const n = val ? Number(val) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [selected?.rating_value]);

  // ===== Perfume Card Actions =====
  const [actionLoading, setActionLoading] = useState(false);
  const inCollection = selected ? collectionIds.includes(selected.id) : false;
  const isTodayScent = selected ? dailyScentId === selected.id : false;

  const toggleCollection = async () => {
    if (!selected?.id) return;
    setActionLoading(true);
    try {
      await toggleCollectionContext(selected.id);
    } catch (err) {
      console.log("🟥 toggleCollection failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  const setToday = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await setTodayScent(selected.id);
    } catch (err) {
      console.log("🟥 setTodayScent failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{selected?.fragrance?.replaceAll("-", " ")}</Text>
              <Text style={styles.detailBrand}>{selected?.brand?.replaceAll("-", " ")}</Text>

              <Text style={styles.detailMeta}>
                {(selected?.gender || "—").toUpperCase()} • {selected?.country || "—"}
                {selected?.year ? ` • ${selected.year}` : ""}
              </Text>
            </View>

            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#111" />
            </Pressable>
          </View>

          {/* Placeholder Image */}
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={26} color="#666" />
            <Text style={styles.imagePlaceholderText}>Image placeholder</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                inCollection && styles.actionButtonSecondary,
                actionLoading && { opacity: 0.6 },
              ]}
              onPress={toggleCollection}
              disabled={actionLoading}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  inCollection && styles.actionButtonTextSecondary,
                ]}
              >
                {inCollection ? "Remove from Collection" : "Add to Collection"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                isTodayScent && styles.actionButtonActive,
                actionLoading && { opacity: 0.6 },
              ]}
              onPress={setToday}
              disabled={actionLoading}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  isTodayScent && styles.actionButtonTextActive,
                ]}
              >
                {isTodayScent ? "Today's Scent ✓" : "Set as Today"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rating row */}
          <View style={styles.ratingRow}>
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
              {[selected?.mainaccord1, selected?.mainaccord2, selected?.mainaccord3, selected?.mainaccord4, selected?.mainaccord5]
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

          {/* Reviews Header */}
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

          {/* Reviews List */}
          {reviewsLoading ? (
            <ActivityIndicator />
          ) : reviewsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{reviewsError}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => selected?.id && fetchReviews(selected.id)}
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
    </Modal>
  );
}

// Styles remain mostly unchanged
const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  
  // Secondary (Remove state)
  actionButtonSecondary: {
    backgroundColor: "#f2f2f2",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  
  actionButtonTextSecondary: {
    color: "#111",
  },
  
  // Active Today state
  actionButtonActive: {
    backgroundColor: "#1c1c1c",
  },
  
  actionButtonTextActive: {
    color: "#fff",
  },
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
  sheetHandle: { width: 44, height: 5, borderRadius: 999, backgroundColor: "#ddd", alignSelf: "center", marginBottom: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  detailName: { fontSize: 22, fontWeight: "800", color: "#111" },
  detailBrand: { fontSize: 15, color: "#666", marginTop: 3 },
  detailMeta: { fontSize: 12.5, color: "#888", marginTop: 6 },

  imagePlaceholder: { marginTop: 12, height: 130, borderRadius: 14, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center", gap: 6 },
  imagePlaceholderText: { color: "#666", fontWeight: "700" },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 12 },
  ratingText: { color: "#444", fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 10 },

  infoCard: { backgroundColor: "#f7f7f7", padding: 12, borderRadius: 12, marginBottom: 10 },
  infoLabel: { fontSize: 12, color: "#666", fontWeight: "800", marginBottom: 6 },
  infoValue: { color: "#111", fontWeight: "700", lineHeight: 18 },

  primaryBtnModal: { marginTop: 10, backgroundColor: "#111", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15.5 },

  writeReviewBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f2f2f2" },
  writeReviewText: { fontSize: 13, fontWeight: "800", color: "#111" },

  reviewsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },

  textField: { backgroundColor: "#f2f2f2", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { backgroundColor: "#f2f2f2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: "#111" },
  chipText: { color: "#111", fontWeight: "800", fontSize: 12.5 },
  chipTextActive: { color: "#fff" },

  emptyReviews: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14 },
  emptyReviewsTitle: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  emptyReviewsSubtitle: { fontSize: 13, color: "#666", marginTop: 6 },

  reviewsCountText: { color: "#777", marginBottom: 8, fontWeight: "700" },

  reviewCard: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14, marginBottom: 10 },
  reviewTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  reviewAvatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  reviewMetaText: { color: "#111", fontWeight: "900", fontSize: 12.5 },
  reviewDateText: { color: "#777", fontSize: 12, marginTop: 2 },
  reviewRatingText: { color: "#111", fontWeight: "900" },
  reviewBodyText: { color: "#111", fontWeight: "700", lineHeight: 18 },

  errorBox: { backgroundColor: "#fde7ea", borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  errorText: { color: "#b00020", fontWeight: "800", flex: 1 },
  retryBtn: { backgroundColor: "#111", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "800" },
});