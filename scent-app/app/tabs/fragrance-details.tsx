// app/tabs/fragrance-details.tsx

import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { useCollection } from "@/contexts/collection-context";
import type { FragranceApiItem } from "@/lib/api";
import { toggleFragranceLike, toggleWishlist } from "@/lib/api";
import { FragranceStats } from "@/components/fragrance-stats";
import { createReview, updateReview, getReviewsForFragrance, toggleReviewLike, getComments, createComment, toggleCommentLike, type Review, type Comment } from "@/lib/reviews";

type FragranceItem = FragranceApiItem & { size?: string };

const PERFUME_SIZES = [
  { value: "SAMPLE", label: "Sample" },
  { value: "DECANT", label: "Decant" },
  { value: "MINI", label: "Mini" },
  { value: "BOTTLE", label: "Bottle" },
] as const;

const OCCASIONS = [
  { key: "winter", label: "Winter", icon: "snow-outline" },
  { key: "spring", label: "Spring", icon: "flower-outline" },
  { key: "summer", label: "Summer", icon: "umbrella-outline" },
  { key: "autumn", label: "Autumn", icon: "leaf-outline" },
  { key: "day",    label: "Day",    icon: "sunny-outline" },
  { key: "night",  label: "Night",  icon: "moon-outline" },
] as const;

function prettyList(arr?: string[]) {
  if (!arr || arr.length === 0) return "—";
  return arr.filter(Boolean).join(" • ");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

export default function FragranceDetailsScreen() {
  const router = useRouter();
  const { data, from } = useLocalSearchParams<{ data: string; from?: string }>();

  const fragrance: FragranceItem | null = useMemo(() => {
    if (!data) return null;
    try {
      return JSON.parse(data as string);
    } catch {
      return null;
    }
  }, [data]);

  const { collection, dailyScent, toggleCollection: toggleCollectionContext, setTodayScent } = useCollection();

  const collectionIds = useMemo(() => collection.map((c) => c.id), [collection]);
  const dailyScentId = dailyScent?.id ?? null;

  // ===== Reviews =====
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [myUid, setMyUid] = useState<string | null>(null);

  const userHasReviewed = useMemo(
    () => !!myUid && reviews.some((r) => r.uid === myUid),
    [reviews, myUid]
  );

  const fetchReviews = async (fid: number) => {
    setReviewsError(null);
    setReviewsLoading(true);
    try {
      const [res, profileRaw] = await Promise.all([
        getReviewsForFragrance(fid),
        AsyncStorage.getItem("profile"),
      ]);
      setReviews(res.results ?? []);
      setReviewsCount(res.count ?? 0);
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        setMyUid(profile?.supabase_uid ?? null);
      }
    } catch (e: any) {
      setReviews([]);
      setReviewsCount(0);
      setReviewsError(e?.message ?? "Failed to load reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!fragrance?.id) return;
    fetchReviews(fragrance.id);
  }, [fragrance?.id]);

  // ===== Write Review =====
  const [writeReviewOpen, setWriteReviewOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewDescription, setReviewDescription] = useState("");
  const [reviewRating, setReviewRating] = useState("");
  const [reviewGender, setReviewGender] = useState<
    "Female" | "Slightly Female" | "Unisex" | "Slightly Male" | "Male"
  >("Unisex");
  const [reviewLongevity, setReviewLongevity] = useState<
    "0 - 2 hours" | "2 - 4 hours" | "4 - 6 hours" | "6 - 8 hours" | "8-10 hours" | "10+ hours"
  >("6 - 8 hours");
  const [reviewValue, setReviewValue] = useState<
    "Super Overpriced" | "Overpriced" | "Alright" | "Good Value" | "Super Value"
  >("Alright");
  const [reviewOccasion, setReviewOccasion] = useState({
    winter: false,
    spring: false,
    summer: false,
    autumn: false,
    day: false,
    night: false,
  });

  const toggleOccasion = (key: keyof typeof reviewOccasion) =>
    setReviewOccasion((prev) => ({ ...prev, [key]: !prev[key] }));

  function resetReviewForm() {
    setEditingReviewId(null);
    setReviewDescription("");
    setReviewRating("");
    setReviewGender("Unisex");
    setReviewLongevity("6 - 8 hours");
    setReviewValue("Alright");
    setReviewOccasion({ winter: false, spring: false, summer: false, autumn: false, day: false, night: false });
    setReviewError(null);
  }

  function openEditReview(review: Review) {
    setEditingReviewId(review.id);
    setReviewDescription(review.description);
    setReviewRating(String(review.rating));
    setReviewGender(review.gender);
    setReviewLongevity(review.longevity);
    setReviewValue(review.value);
    setReviewOccasion({
      winter: review.winter,
      spring: review.spring,
      summer: review.summer,
      autumn: review.autumn,
      day: review.day,
      night: review.night,
    });
    setReviewError(null);
    setWriteReviewOpen(true);
  }

  const submitReview = async () => {
    if (!fragrance?.id) return;
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
        description: reviewDescription.trim(),
        rating: Number(ratingNum.toFixed(1)),
        gender: reviewGender,
        longevity: reviewLongevity,
        value: reviewValue,
        ...reviewOccasion,
      };

      if (editingReviewId !== null) {
        await updateReview(editingReviewId, payload);
      } else {
        await createReview({ fid: fragrance.id, ...payload });
      }

      setWriteReviewOpen(false);
      resetReviewForm();
      await fetchReviews(fragrance.id);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Failed to submit review.";
      if (e?.response?.status === 409) {
        setWriteReviewOpen(false);
        resetReviewForm();
        await fetchReviews(fragrance.id);
      } else {
        setReviewError(msg);
      }
    } finally {
      setReviewLoading(false);
    }
  };

  const ratingNum = useMemo(() => {
    const val = fragrance?.rating_value;
    const n = val ? Number(val) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [fragrance?.rating_value]);

  // ===== Collection / Today Actions =====
  const [actionLoading, setActionLoading] = useState(false);
  const [addToCollectionVisible, setAddToCollectionVisible] = useState(false);
  const [addToCollectionSize, setAddToCollectionSize] = useState<string>("BOTTLE");
  const inCollection = fragrance ? collectionIds.includes(fragrance.id) : false;
  const isTodayScent = fragrance ? dailyScentId === fragrance.id : false;

  const openAddToCollectionPopup = () => {
    setAddToCollectionSize("BOTTLE");
    setAddToCollectionVisible(true);
  };

  const confirmAddToCollection = async () => {
    if (!fragrance?.id) return;
    setActionLoading(true);
    setAddToCollectionVisible(false);
    try {
      await toggleCollectionContext(fragrance.id, addToCollectionSize);
    } catch (err) {
      console.log("toggleCollection failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleCollection = async () => {
    if (!fragrance?.id) return;
    if (inCollection) {
      setActionLoading(true);
      try {
        await toggleCollectionContext(fragrance.id, fragrance.size);
      } catch (err) {
        console.log("toggleCollection failed", err);
      } finally {
        setActionLoading(false);
      }
    } else {
      openAddToCollectionPopup();
    }
  };

  const setToday = async () => {
    if (!fragrance) return;
    setActionLoading(true);
    try {
      await setTodayScent(fragrance.id);
    } catch (err) {
      console.log("setTodayScent failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  // ===== Fragrance like / wishlist =====
  const [fragranceLiked, setFragranceLiked] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const handleFragranceLike = async () => {
    if (!fragrance?.id || likeLoading) return;
    setLikeLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      const res = await toggleFragranceLike(fragrance.id, token);
      setFragranceLiked(res.liked);
    } catch (_) {} finally {
      setLikeLoading(false);
    }
  };

  const handleWishlist = async () => {
    if (!fragrance?.id || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      const res = await toggleWishlist(fragrance.id, token);
      const msg = res.message.toLowerCase();
      setWishlisted(msg.includes("added") || (msg.includes("wishlist") && !msg.includes("removed")));
    } catch (_) {} finally {
      setWishlistLoading(false);
    }
  };

  // ===== Review likes =====
  const handleReviewLike = async (reviewId: number) => {
    try {
      const res = await toggleReviewLike(reviewId);
      setReviews((prev) =>
        prev.map((r) => r.id === reviewId ? { ...r, like_count: res.like_count, liked: res.liked } : r)
      );
    } catch (_) {}
  };

  // ===== Comments =====
  const [openCommentsForReview, setOpenCommentsForReview] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [commentsLoadingSet, setCommentsLoadingSet] = useState<Set<number>>(new Set());
  const [commentInput, setCommentInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ commentId: number; username: string } | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadComments = async (reviewId: number) => {
    setCommentsLoadingSet((prev) => new Set(prev).add(reviewId));
    try {
      const data = await getComments(reviewId);
      setCommentsMap((prev) => ({ ...prev, [reviewId]: data.comments }));
    } catch (_) {} finally {
      setCommentsLoadingSet((prev) => { const s = new Set(prev); s.delete(reviewId); return s; });
    }
  };

  const toggleCommentsSectionForReview = (reviewId: number) => {
    if (openCommentsForReview === reviewId) {
      setOpenCommentsForReview(null);
    } else {
      setOpenCommentsForReview(reviewId);
      setReplyingTo(null);
      setCommentInput("");
      if (!commentsMap[reviewId]) loadComments(reviewId);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    try {
      const res = await toggleCommentLike(commentId);
      setCommentsMap((prev) => {
        const updated = { ...prev };
        for (const [rid, comments] of Object.entries(updated)) {
          updated[Number(rid)] = updateCommentLikeInTree(comments, commentId, res.like_count, res.liked);
        }
        return updated;
      });
    } catch (_) {}
  };

  const handleReply = (commentId: number, username: string) => {
    setReplyingTo({ commentId, username });
    setCommentInput(`@${username} `);
  };

  const submitComment = async (reviewId: number) => {
    if (!commentInput.trim()) return;
    setCommentSubmitting(true);
    try {
      await createComment(reviewId, commentInput.trim(), replyingTo?.commentId);
      setCommentInput("");
      setReplyingTo(null);
      await loadComments(reviewId);
    } catch (_) {} finally {
      setCommentSubmitting(false);
    }
  };

  if (!fragrance) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Fragrance not found.</Text>
          <TouchableOpacity onPress={() => router.push(from === "explore" ? "/tabs/explore" : "/tabs/search")} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push(from === "explore" ? "/tabs/explore" : "/tabs/search")} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color="#111" />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fragrance Name / Brand / Meta */}
        <Text style={styles.detailName}>{fragrance.fragrance?.replaceAll("-", " ")}</Text>
        <Text style={styles.detailBrand}>{fragrance.brand?.replaceAll("-", " ")}</Text>
        <Text style={styles.detailMeta}>
          {(fragrance.gender || "—").toUpperCase()} • {fragrance.country || "—"}
          {fragrance.year ? ` • ${fragrance.year}` : ""}
        </Text>
        {fragrance.size && (
          <Text style={styles.detailMeta}>{`OWNED: ${fragrance.size}`}</Text>
        )}

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

        {/* Like + Wishlist row */}
        <View style={styles.likeWishlistRow}>
          <TouchableOpacity
            style={[styles.iconActionBtn, fragranceLiked && styles.iconActionBtnActive]}
            onPress={handleFragranceLike}
            disabled={likeLoading}
          >
            <Ionicons name={fragranceLiked ? "heart" : "heart-outline"} size={18} color={fragranceLiked ? "#fff" : "#111"} />
            <Text style={[styles.iconActionText, fragranceLiked && styles.iconActionTextActive]}>
              {fragranceLiked ? "Liked" : "Like"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconActionBtn, wishlisted && styles.iconActionBtnWishlist]}
            onPress={handleWishlist}
            disabled={wishlistLoading}
          >
            <Ionicons name={wishlisted ? "bookmark" : "bookmark-outline"} size={18} color={wishlisted ? "#fff" : "#111"} />
            <Text style={[styles.iconActionText, wishlisted && styles.iconActionTextActive]}>
              {wishlisted ? "Wishlisted" : "Wishlist"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Top</Text>
          <Text style={styles.infoValue}>{prettyList(fragrance.top_note)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Middle</Text>
          <Text style={styles.infoValue}>{prettyList(fragrance.middle_note)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Base</Text>
          <Text style={styles.infoValue}>{prettyList(fragrance.base_note)}</Text>
        </View>

        {/* Details */}
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Details</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Accords</Text>
          <Text style={styles.infoValue}>
            {[
              fragrance.mainaccord1,
              fragrance.mainaccord2,
              fragrance.mainaccord3,
              fragrance.mainaccord4,
              fragrance.mainaccord5,
            ]
              .filter(Boolean)
              .join(" • ") || "—"}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Perfumer</Text>
          <Text style={styles.infoValue}>
            {[fragrance.perfumer1, fragrance.perfumer2].filter(Boolean).join(" • ") || "—"}
          </Text>
        </View>
        <View style={[styles.infoCard, { marginBottom: 6 }]}>
          <Text style={styles.infoLabel}>Link</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {fragrance.url || "—"}
          </Text>
        </View>

        {/* Community Stats */}
        <FragranceStats item={fragrance} />

        {/* Reviews Header */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Reviews</Text>

        {userHasReviewed ? (
          <TouchableOpacity
            style={[styles.createReviewBtn, styles.editReviewBtn]}
            onPress={() => {
              const myReview = reviews.find((r) => r.uid === myUid);
              if (myReview) openEditReview(myReview);
            }}
          >
            <Ionicons name="pencil-outline" size={16} color="#111" />
            <Text style={[styles.createReviewBtnText, styles.editReviewBtnText]}>Edit Your Review</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.createReviewBtn}
            onPress={() => {
              resetReviewForm();
              setWriteReviewOpen(true);
            }}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.createReviewBtnText}>Create a Review</Text>
          </TouchableOpacity>
        )}

        {/* Write Review inline form */}
        {writeReviewOpen && (
          <View style={styles.writeReviewForm}>
            <TextInput
              style={[styles.textField, { marginBottom: 10 }]}
              placeholder="Rating (0–10)"
              placeholderTextColor="#999"
              value={reviewRating}
              onChangeText={setReviewRating}
              keyboardType="decimal-pad"
            />
            
            <TextInput
              style={[styles.textField, { marginBottom: 10 }]}
              placeholder="Your review..."
              placeholderTextColor="#999"
              value={reviewDescription}
              onChangeText={setReviewDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.infoLabel}>Gender</Text>
            <View style={styles.chipRow}>
              {(["Female", "Slightly Female", "Unisex", "Slightly Male", "Male"] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, reviewGender === g && styles.chipActive]}
                  onPress={() => setReviewGender(g)}
                >
                  <Text style={[styles.chipText, reviewGender === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.infoLabel, { marginTop: 10 }]}>Occasion</Text>
            <View style={styles.occasionRow}>
              {OCCASIONS.map(({ key, label, icon }) => {
                const active = reviewOccasion[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.occasionItem}
                    onPress={() => toggleOccasion(key)}
                  >
                    <Ionicons
                      name={icon as any}
                      size={22}
                      color={active ? "#111" : "#ccc"}
                    />
                    <Text style={[styles.occasionLabel, active && styles.occasionLabelActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.infoLabel, { marginTop: 10 }]}>Longevity</Text>
            <View style={styles.chipRow}>
              {(["0 - 2 hours", "2 - 4 hours", "4 - 6 hours", "6 - 8 hours", "8-10 hours", "10+ hours"] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.chip, reviewLongevity === l && styles.chipActive]}
                  onPress={() => setReviewLongevity(l)}
                >
                  <Text style={[styles.chipText, reviewLongevity === l && styles.chipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.infoLabel, { marginTop: 10 }]}>Value</Text>
            <View style={styles.chipRow}>
              {(["Super Overpriced", "Overpriced", "Alright", "Good Value", "Super Value"] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, reviewValue === v && styles.chipActive]}
                  onPress={() => setReviewValue(v)}
                >
                  <Text style={[styles.chipText, reviewValue === v && styles.chipTextActive]}>
                    {v === "Alright" ? "Perfectly Priced" : v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {reviewError && (
              <Text style={[styles.errorText, { marginTop: 8 }]}>{reviewError}</Text>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => { setWriteReviewOpen(false); resetReviewForm(); }}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, reviewLoading && { opacity: 0.6 }]}
                onPress={submitReview}
                disabled={reviewLoading}
              >
                {reviewLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {editingReviewId !== null ? "Save Changes" : "Submit"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reviews List */}
        {reviewsLoading ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : reviewsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{reviewsError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => fragrance?.id && fetchReviews(fragrance.id)}
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
              <View key={String(r.id)} style={[styles.reviewCard, r.uid === myUid && styles.reviewCardOwn]}>
                <View style={styles.reviewCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewUsernameText}>{r.username}</Text>
                    <Text style={styles.reviewDateText}>{formatDate(r.created_at)}</Text>
                  </View>
                  <View style={styles.reviewRatingBadge}>
                    <Ionicons name="star" size={12} color="#fff" />
                    <Text style={styles.reviewRatingText}>{Number(r.rating).toFixed(1)}</Text>
                  </View>
                </View>

                <Text style={styles.reviewBody} numberOfLines={3}>{r.description}</Text>

                <View style={styles.reviewOccasionRow}>
                  {OCCASIONS.map(({ key, label, icon }) => {
                    const active = r[key as keyof typeof r] as boolean;
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
                  <Text style={styles.reviewMetaText}>{r.gender}</Text>
                  <Text style={styles.reviewMetaDot}>·</Text>
                  <Text style={styles.reviewMetaText}>{r.longevity}</Text>
                  <Text style={styles.reviewMetaDot}>·</Text>
                  <Text style={styles.reviewMetaText}>
                    {r.value === "Alright" ? "Perfectly Priced" : r.value}
                  </Text>
                </View>

                {/* Like + Comments actions */}
                <View style={styles.reviewActionRow}>
                  <TouchableOpacity style={styles.reviewLikeBtn} onPress={() => handleReviewLike(r.id)}>
                    <Ionicons name={r.liked ? "heart" : "heart-outline"} size={15} color={r.liked ? "#e53935" : "#888"} />
                    <Text style={[styles.reviewLikeText, r.liked && { color: "#e53935" }]}>
                      {r.like_count > 0 ? `${r.like_count} ` : ""}{r.liked ? "Liked" : "Like"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reviewCommentBtn} onPress={() => toggleCommentsSectionForReview(r.id)}>
                    <Ionicons name="chatbubble-outline" size={15} color="#888" />
                    <Text style={styles.reviewCommentText}>{openCommentsForReview === r.id ? "Hide" : "Comments"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Comments section */}
                {openCommentsForReview === r.id && (
                  <View style={styles.commentsSection}>
                    {commentsLoadingSet.has(r.id) ? (
                      <ActivityIndicator size="small" />
                    ) : (commentsMap[r.id] ?? []).length === 0 ? (
                      <Text style={styles.noCommentsText}>No comments yet.</Text>
                    ) : (
                      (commentsMap[r.id] ?? []).map((c) => (
                        <CommentItem key={String(c.id)} comment={c} onLike={handleCommentLike} onReply={handleReply} />
                      ))
                    )}
                    {replyingTo && (
                      <View style={styles.replyingToBar}>
                        <Text style={styles.replyingToText}>Replying to @{replyingTo.username}</Text>
                        <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentInput(""); }}>
                          <Ionicons name="close" size={14} color="#666" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentInput}
                        value={commentInput}
                        onChangeText={setCommentInput}
                        placeholder="Write a comment..."
                        placeholderTextColor="#aaa"
                        multiline
                      />
                      <TouchableOpacity
                        style={[styles.commentSendBtn, commentSubmitting && { opacity: 0.6 }]}
                        onPress={() => submitComment(r.id)}
                        disabled={commentSubmitting}
                      >
                        {commentSubmitting
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Ionicons name="send" size={16} color="#fff" />}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add to collection popup */}
      <Modal
        visible={addToCollectionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddToCollectionVisible(false)}
      >
        <Pressable
          style={styles.addPopupBackdrop}
          onPress={() => setAddToCollectionVisible(false)}
        >
          <Pressable style={styles.addPopupCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.addPopupTitle}>Add to collection</Text>
            <Text style={styles.addPopupLabel}>Size</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={addToCollectionSize}
                onValueChange={(v) => setAddToCollectionSize(v as string)}
                style={styles.picker}
                itemStyle={Platform.OS === "ios" ? styles.pickerItem : undefined}
                mode="dropdown"
              >
                {PERFUME_SIZES.map(({ value, label }) => (
                  <Picker.Item key={value} label={label} value={value} />
                ))}
              </Picker>
            </View>
            <View style={styles.addPopupActions}>
              <TouchableOpacity
                style={styles.addPopupCancel}
                onPress={() => setAddToCollectionVisible(false)}
              >
                <Text style={styles.addPopupCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addPopupConfirm}
                onPress={confirmAddToCollection}
                disabled={actionLoading}
              >
                <Text style={styles.addPopupConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function CommentItem({
  comment,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  onLike: (id: number) => void;
  onReply: (id: number, username: string) => void;
  depth?: number;
}) {
  return (
    <View style={[commentStyles.card, depth > 0 && commentStyles.reply]}>
      <View style={commentStyles.header}>
        <View style={commentStyles.avatar}>
          <Text style={commentStyles.avatarText}>{comment.author.username?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={commentStyles.username}>{comment.author.username}</Text>
          <Text style={commentStyles.date}>{new Date(comment.created_at).toLocaleDateString()}</Text>
        </View>
        <TouchableOpacity style={commentStyles.likeBtn} onPress={() => onLike(comment.id)}>
          <Ionicons name={comment.liked ? "heart" : "heart-outline"} size={14} color={comment.liked ? "#e53935" : "#888"} />
          {comment.like_count > 0 && (
            <Text style={[commentStyles.likeCount, comment.liked && { color: "#e53935" }]}>{comment.like_count}</Text>
          )}
        </TouchableOpacity>
      </View>
      <Text style={commentStyles.content}>{comment.content}</Text>
      <TouchableOpacity onPress={() => onReply(comment.id, comment.author.username)}>
        <Text style={commentStyles.replyText}>Reply</Text>
      </TouchableOpacity>
      {comment.replies.length > 0 && (
        <View style={{ marginTop: 6 }}>
          {comment.replies.map((reply) => (
            <CommentItem key={String(reply.id)} comment={reply} onLike={onLike} onReply={onReply} depth={depth + 1} />
          ))}
        </View>
      )}
    </View>
  );
}

function updateCommentLikeInTree(comments: Comment[], targetId: number, likeCount: number, liked: boolean): Comment[] {
  return comments.map((c) => {
    if (c.id === targetId) return { ...c, like_count: likeCount, liked };
    if (c.replies.length > 0) return { ...c, replies: updateCommentLikeInTree(c.replies, targetId, likeCount, liked) };
    return c;
  });
}

const commentStyles = StyleSheet.create({
  card: { backgroundColor: "#f2f2f2", borderRadius: 10, padding: 10, marginBottom: 8 },
  reply: { marginLeft: 16, backgroundColor: "#ececec" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  avatar: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#555", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  username: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  date: { fontSize: 11, color: "#999" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" },
  likeCount: { fontSize: 11, color: "#888", fontWeight: "700" },
  content: { fontSize: 13, color: "#333", lineHeight: 17, marginBottom: 4 },
  replyText: { fontSize: 12, color: "#666", fontWeight: "700" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backBtnText: { fontSize: 16, fontWeight: "700", color: "#111" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },

  detailName: { fontSize: 22, fontWeight: "800", color: "#111" },
  detailBrand: { fontSize: 15, color: "#666", marginTop: 3 },
  detailMeta: { fontSize: 12.5, color: "#888", marginTop: 6 },

  imagePlaceholder: {
    marginTop: 16,
    height: 130,
    borderRadius: 14,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imagePlaceholderText: { color: "#666", fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  actionButtonSecondary: {
    backgroundColor: "#f2f2f2",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  actionButtonTextSecondary: { color: "#111" },
  actionButtonActive: { backgroundColor: "#1c1c1c" },
  actionButtonTextActive: { color: "#fff" },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 12 },
  ratingText: { color: "#444", fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 10 },

  infoCard: { backgroundColor: "#f7f7f7", padding: 12, borderRadius: 12, marginBottom: 10 },
  infoLabel: { fontSize: 12, color: "#666", fontWeight: "800", marginBottom: 6 },
  infoValue: { color: "#111", fontWeight: "700", lineHeight: 18 },

  editReviewBtn: {
    backgroundColor: "#f2f2f2",
  },
  editReviewBtnText: {
    color: "#111",
  },

  createReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  createReviewBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  writeReviewForm: {
    backgroundColor: "#fafafa",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  textField: {
    backgroundColor: "#f2f2f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111",
  },

  occasionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 2,
  },
  occasionItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
  },
  occasionLabel: { fontSize: 10, color: "#ccc", fontWeight: "700" },
  occasionLabelActive: { color: "#111" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { backgroundColor: "#f2f2f2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: "#111" },
  chipText: { color: "#111", fontWeight: "800", fontSize: 12.5 },
  chipTextActive: { color: "#fff" },

  emptyReviews: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14 },
  emptyReviewsTitle: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  emptyReviewsSubtitle: { fontSize: 13, color: "#666", marginTop: 6 },

  reviewsCountText: { color: "#777", marginBottom: 8, fontWeight: "700" },
  reviewCard: {
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  reviewCardOwn: {
    borderWidth: 1.5,
    borderColor: "#111",
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  reviewDateText: { fontSize: 12, color: "#777", fontWeight: "600" },
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
  reviewUsernameText: { fontSize: 13, fontWeight: "800", color: "#111", marginBottom: 1 },
  reviewMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  reviewMetaText: { fontSize: 12, color: "#777", fontWeight: "600" },
  reviewMetaDot: { fontSize: 12, color: "#bbb" },

  likeWishlistRow: { flexDirection: "row", gap: 10, marginTop: 10, marginBottom: 4 },
  iconActionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: "#f2f2f2" },
  iconActionBtnActive: { backgroundColor: "#e53935" },
  iconActionBtnWishlist: { backgroundColor: "#111" },
  iconActionText: { color: "#111", fontWeight: "700", fontSize: 13 },
  iconActionTextActive: { color: "#fff" },

  reviewActionRow: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 8 },
  reviewLikeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewLikeText: { fontSize: 12.5, color: "#888", fontWeight: "700" },
  reviewCommentBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewCommentText: { fontSize: 12.5, color: "#888", fontWeight: "700" },

  commentsSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  noCommentsText: { color: "#aaa", fontSize: 13, marginBottom: 8 },
  replyingToBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f0f0f0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  replyingToText: { fontSize: 12, color: "#555", fontWeight: "700" },
  commentInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  commentInput: { flex: 1, backgroundColor: "#f2f2f2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5, color: "#111", maxHeight: 80 },
  commentSendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },

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
  retryBtn: { backgroundColor: "#111", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "800" },

  addPopupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  addPopupCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },
  addPopupTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 16 },
  addPopupLabel: { fontSize: 13, fontWeight: "700", color: "#666", marginBottom: 8 },
  pickerWrapper: {
    backgroundColor: "#f2f2f2",
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
    justifyContent: "center",
  },
  picker: {
    height: Platform.OS === "android" ? 48 : 120,
    color: "#111",
    justifyContent: "center",
    ...(Platform.OS === "android" && { width: "100%" }),
  },
  pickerItem: { fontSize: 16, color: "#111" },
  addPopupActions: { flexDirection: "row", gap: 12 },
  addPopupCancel: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  addPopupCancelText: { color: "#111", fontWeight: "700", fontSize: 15 },
  addPopupConfirm: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  addPopupConfirmText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
