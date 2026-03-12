// components/fragrance-detail-modal.tsx

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import { useCollection } from "@/contexts/collection-context";
import type { FragranceApiItem } from "@/lib/api";
import { toggleFragranceLike, toggleWishlist } from "@/lib/api";
import { FragranceStats } from "@/components/fragrance-stats";
import {
  createComment,
  createReview,
  getComments,
  getReviewsForFragrance,
  toggleCommentLike,
  toggleReviewLike,
  type Comment,
  type Review,
} from "@/lib/reviews";

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

const PERFUME_SIZES = [
  { value: "SAMPLE", label: "Sample" },
  { value: "DECANT", label: "Decant" },
  { value: "MINI", label: "Mini" },
  { value: "BOTTLE", label: "Bottle" },
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

// Renders a single comment and its nested replies
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
    <View style={[styles.commentCard, depth > 0 && styles.commentReply]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarText}>
            {comment.author.username?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.commentUsername}>{comment.author.username}</Text>
          <Text style={styles.commentDate}>{formatDate(comment.created_at)}</Text>
        </View>
        <TouchableOpacity style={styles.commentLikeBtn} onPress={() => onLike(comment.id)}>
          <Ionicons
            name={comment.liked ? "heart" : "heart-outline"}
            size={14}
            color={comment.liked ? "#e53935" : "#888"}
          />
          {comment.like_count > 0 && (
            <Text style={[styles.commentLikeCount, comment.liked && { color: "#e53935" }]}>
              {comment.like_count}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.commentContent}>{comment.content}</Text>
      <TouchableOpacity onPress={() => onReply(comment.id, comment.author.username)}>
        <Text style={styles.replyText}>Reply</Text>
      </TouchableOpacity>
      {comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={String(reply.id)}
              comment={reply}
              onLike={onLike}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
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
  const [reviewRating, setReviewRating] = useState("");
  const [reviewGender, setReviewGender] = useState<Review["gender"]>("Unisex");
  const [reviewLongevity, setReviewLongevity] = useState<Review["longevity"]>("6 - 8 hours");
  const [reviewValue, setReviewValue] = useState<Review["value"]>("Alright");
  const [reviewSillage, setReviewSillage] = useState<Review["sillage"]>(null);
  const [reviewMaceration, setReviewMaceration] = useState("");
  const [reviewSpring, setReviewSpring] = useState(false);
  const [reviewSummer, setReviewSummer] = useState(false);
  const [reviewAutumn, setReviewAutumn] = useState(false);
  const [reviewWinter, setReviewWinter] = useState(false);
  const [reviewDay, setReviewDay] = useState(false);
  const [reviewNight, setReviewNight] = useState(false);

  function resetReviewForm() {
    setReviewDescription("");
    setReviewRating("");
    setReviewGender("Unisex");
    setReviewLongevity("6 - 8 hours");
    setReviewValue("Alright");
    setReviewSillage(null);
    setReviewMaceration("");
    setReviewSpring(false);
    setReviewSummer(false);
    setReviewAutumn(false);
    setReviewWinter(false);
    setReviewDay(false);
    setReviewNight(false);
    setReviewError(null);
  }

  const submitReview = async () => {
    if (!selected?.id) return;
    setReviewError(null);
    const ratingNum = Number(reviewRating);
    if (!reviewDescription.trim()) { setReviewError("Description is required."); return; }
    if (!Number.isFinite(ratingNum)) { setReviewError("Rating must be a number."); return; }
    if (ratingNum < 0 || ratingNum > 10) { setReviewError("Rating must be between 0 and 10."); return; }
    const macNum = reviewMaceration.trim() ? Number(reviewMaceration.trim()) : null;
    if (macNum !== null && (!Number.isInteger(macNum) || macNum < 0)) {
      setReviewError("Maceration must be a non-negative whole number."); return;
    }
    setReviewLoading(true);
    try {
      await createReview({
        fid: selected.id,
        description: reviewDescription.trim(),
        rating: Number(ratingNum.toFixed(1)),
        gender: reviewGender,
        longevity: reviewLongevity,
        value: reviewValue,
        sillage: reviewSillage,
        maceration: macNum,
        spring: reviewSpring,
        summer: reviewSummer,
        autumn: reviewAutumn,
        winter: reviewWinter,
        day: reviewDay,
        night: reviewNight,
      });
      setWriteReviewOpen(false);
      resetReviewForm();
      await fetchReviews(selected.id);
    } catch (e: any) {
      setReviewError(e?.message ?? "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  // ===== Review likes =====
  const handleReviewLike = async (reviewId: number) => {
    try {
      const res = await toggleReviewLike(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, like_count: res.like_count, liked: res.liked } : r
        )
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

  const toggleComments = (reviewId: number) => {
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
      // Update comment in-place (flat scan through all loaded comment trees)
      setCommentsMap((prev) => {
        const updated = { ...prev };
        for (const [rid, comments] of Object.entries(updated)) {
          updated[Number(rid)] = updateCommentLike(comments, commentId, res.like_count, res.liked);
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

  const ratingNum = useMemo(() => {
    const val = selected?.rating_value;
    const n = val ? Number(val) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [selected?.rating_value]);

  // ===== Fragrance like / wishlist =====
  const [fragranceLiked, setFragranceLiked] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const handleFragranceLike = async () => {
    if (!selected?.id || likeLoading) return;
    setLikeLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      const res = await toggleFragranceLike(selected.id, token);
      setFragranceLiked(res.liked);
    } catch (_) {} finally {
      setLikeLoading(false);
    }
  };

  const handleWishlist = async () => {
    if (!selected?.id || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) return;
      const res = await toggleWishlist(selected.id, token);
      setWishlisted(res.message.includes("added") || res.message.toLowerCase().includes("wishlist") && !res.message.includes("removed"));
    } catch (_) {} finally {
      setWishlistLoading(false);
    }
  };

  // Reset like/wishlist state when modal opens with new fragrance
  useEffect(() => {
    setFragranceLiked(false);
    setWishlisted(false);
    setOpenCommentsForReview(null);
    setCommentInput("");
    setReplyingTo(null);
  }, [selected?.id]);

  // ===== Perfume Card Actions =====
  const [actionLoading, setActionLoading] = useState(false);
  const [addToCollectionVisible, setAddToCollectionVisible] = useState(false);
  const [addToCollectionSize, setAddToCollectionSize] = useState<string>("BOTTLE");
  const inCollection = selected ? collectionIds.includes(selected.id) : false;
  const isTodayScent = selected ? dailyScentId === selected.id : false;

  const confirmAddToCollection = async () => {
    if (!selected?.id) return;
    setActionLoading(true);
    setAddToCollectionVisible(false);
    try {
      await toggleCollectionContext(selected.id, addToCollectionSize);
    } catch (err) {
      console.log("🟥 toggleCollection failed", err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleCollection = async () => {
    if (!selected?.id) return;
    if (inCollection) {
      setActionLoading(true);
      try {
        await toggleCollectionContext(selected.id, selected.size);
      } catch (err) {
        console.log("🟥 toggleCollection failed", err);
      } finally {
        setActionLoading(false);
      }
    } else {
      setAddToCollectionSize("BOTTLE");
      setAddToCollectionVisible(true);
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
              {selected?.size && (
                <Text style={styles.detailMeta}>{`OWNED: ${selected?.size}`}</Text>
              )}
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
              style={[styles.actionButton, inCollection && styles.actionButtonSecondary, actionLoading && { opacity: 0.6 }]}
              onPress={toggleCollection}
              disabled={actionLoading}
            >
              <Text style={[styles.actionButtonText, inCollection && styles.actionButtonTextSecondary]}>
                {inCollection ? "Remove from Collection" : "Add to Collection"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, isTodayScent && styles.actionButtonActive, actionLoading && { opacity: 0.6 }]}
              onPress={setToday}
              disabled={actionLoading}
            >
              <Text style={[styles.actionButtonText, isTodayScent && styles.actionButtonTextActive]}>
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
              <Ionicons
                name={fragranceLiked ? "heart" : "heart-outline"}
                size={18}
                color={fragranceLiked ? "#fff" : "#111"}
              />
              <Text style={[styles.iconActionText, fragranceLiked && styles.iconActionTextActive]}>
                {fragranceLiked ? "Liked" : "Like"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconActionBtn, wishlisted && styles.iconActionBtnWishlist]}
              onPress={handleWishlist}
              disabled={wishlistLoading}
            >
              <Ionicons
                name={wishlisted ? "bookmark" : "bookmark-outline"}
                size={18}
                color={wishlisted ? "#fff" : "#111"}
              />
              <Text style={[styles.iconActionText, wishlisted && styles.iconActionTextActive]}>
                {wishlisted ? "Wishlisted" : "Wishlist"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Community Stats */}
          {selected && <FragranceStats item={selected as FragranceApiItem} />}

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
                .filter(Boolean).join(" • ") || "—"}
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
            <Text style={styles.infoValue} numberOfLines={1}>{selected?.url || "—"}</Text>
          </View>

          {/* Reviews Header */}
          <View style={styles.reviewsHeaderRow}>
            <Text style={styles.sectionTitle}>Reviews</Text>
            <TouchableOpacity
              style={styles.writeReviewBtn}
              onPress={() => { resetReviewForm(); setWriteReviewOpen(true); }}
            >
              <Ionicons name="create-outline" size={16} color="#111" />
              <Text style={styles.writeReviewText}>Write a review</Text>
            </TouchableOpacity>
          </View>

          {/* Write Review Form */}
          {writeReviewOpen && (
            <View style={styles.writeReviewForm}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.textField, { minHeight: 80, textAlignVertical: "top" }]}
                value={reviewDescription}
                onChangeText={setReviewDescription}
                multiline
                placeholder="Share your thoughts..."
                placeholderTextColor="#aaa"
              />
              <Text style={styles.formLabel}>Rating (0–10)</Text>
              <TextInput
                style={styles.textField}
                value={reviewRating}
                onChangeText={setReviewRating}
                keyboardType="decimal-pad"
                placeholder="e.g. 8.5"
                placeholderTextColor="#aaa"
              />
              <Text style={styles.formLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {(["Female", "Slightly Female", "Unisex", "Slightly Male", "Male"] as Review["gender"][]).map((g) => (
                  <TouchableOpacity key={g} style={[styles.chip, reviewGender === g && styles.chipActive]} onPress={() => setReviewGender(g)}>
                    <Text style={[styles.chipText, reviewGender === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Longevity</Text>
              <View style={styles.chipRow}>
                {(["0 - 2 hours", "2 - 4 hours", "4 - 6 hours", "6 - 8 hours", "8-10 hours", "10+ hours"] as Review["longevity"][]).map((l) => (
                  <TouchableOpacity key={l} style={[styles.chip, reviewLongevity === l && styles.chipActive]} onPress={() => setReviewLongevity(l)}>
                    <Text style={[styles.chipText, reviewLongevity === l && styles.chipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Value</Text>
              <View style={styles.chipRow}>
                {(["Super Overpriced", "Overpriced", "Alright", "Good Value", "Super Value"] as Review["value"][]).map((v) => (
                  <TouchableOpacity key={v} style={[styles.chip, reviewValue === v && styles.chipActive]} onPress={() => setReviewValue(v)}>
                    <Text style={[styles.chipText, reviewValue === v && styles.chipTextActive]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Sillage</Text>
              <View style={styles.chipRow}>
                {(["No Sillage", "Light Sillage", "Moderate Sillage", "Strong Sillage"] as NonNullable<Review["sillage"]>[]).map((s) => (
                  <TouchableOpacity key={s} style={[styles.chip, reviewSillage === s && styles.chipActive]} onPress={() => setReviewSillage(reviewSillage === s ? null : s)}>
                    <Text style={[styles.chipText, reviewSillage === s && styles.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Maceration (weeks, optional)</Text>
              <TextInput
                style={styles.textField}
                value={reviewMaceration}
                onChangeText={setReviewMaceration}
                keyboardType="number-pad"
                placeholder="e.g. 4"
                placeholderTextColor="#aaa"
              />
              <Text style={styles.formLabel}>Season</Text>
              <View style={styles.chipRow}>
                {([["🌸 Spring", reviewSpring, setReviewSpring], ["☀️ Summer", reviewSummer, setReviewSummer], ["🍂 Autumn", reviewAutumn, setReviewAutumn], ["❄️ Winter", reviewWinter, setReviewWinter]] as [string, boolean, (v: boolean) => void][]).map(([label, active, setter]) => (
                  <TouchableOpacity key={label} style={[styles.chip, active && styles.chipActive]} onPress={() => setter(!active)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.formLabel}>Occasion</Text>
              <View style={styles.chipRow}>
                {([["🌞 Day", reviewDay, setReviewDay], ["🌙 Night", reviewNight, setReviewNight]] as [string, boolean, (v: boolean) => void][]).map(([label, active, setter]) => (
                  <TouchableOpacity key={label} style={[styles.chip, active && styles.chipActive]} onPress={() => setter(!active)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {reviewError && <Text style={styles.errorText}>{reviewError}</Text>}
              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setWriteReviewOpen(false); resetReviewForm(); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.submitBtn, reviewLoading && { opacity: 0.6 }]} onPress={submitReview} disabled={reviewLoading}>
                  {reviewLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Reviews List */}
          {reviewsLoading ? (
            <ActivityIndicator />
          ) : reviewsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTextBox}>{reviewsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => selected?.id && fetchReviews(selected.id)}>
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
              <Text style={styles.reviewsCountText}>Showing {reviews.length} of {reviewsCount}</Text>

              {reviews.map((r) => (
                <View key={String(r.id)} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>
                          {r.username?.[0]?.toUpperCase() ?? r.gender?.[0] ?? "U"}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewUsernameText}>{r.username}</Text>
                        <Text style={styles.reviewMetaText}>
                          {r.gender} • {r.longevity} • {r.value}
                          {r.sillage ? ` • ${r.sillage}` : ""}
                          {r.maceration != null ? ` • ${r.maceration}wk mac` : ""}
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

                  {/* Review action row: like + comments */}
                  <View style={styles.reviewActionRow}>
                    <TouchableOpacity style={styles.reviewLikeBtn} onPress={() => handleReviewLike(r.id)}>
                      <Ionicons
                        name={r.liked ? "heart" : "heart-outline"}
                        size={15}
                        color={r.liked ? "#e53935" : "#888"}
                      />
                      <Text style={[styles.reviewLikeText, r.liked && { color: "#e53935" }]}>
                        {r.like_count > 0 ? r.like_count : ""}{r.like_count > 0 ? " " : ""}{r.liked ? "Liked" : "Like"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reviewCommentBtn}
                      onPress={() => toggleComments(r.id)}
                    >
                      <Ionicons name="chatbubble-outline" size={15} color="#888" />
                      <Text style={styles.reviewCommentText}>
                        {openCommentsForReview === r.id ? "Hide" : "Comments"}
                      </Text>
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
                          <CommentItem
                            key={String(c.id)}
                            comment={c}
                            onLike={handleCommentLike}
                            onReply={handleReply}
                          />
                        ))
                      )}

                      {/* Comment input */}
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
                          {commentSubmitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="send" size={16} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>

      {/* Add to collection – size picker popup */}
      <Modal visible={addToCollectionVisible} transparent animationType="fade" onRequestClose={() => setAddToCollectionVisible(false)}>
        <Pressable style={styles.addPopupBackdrop} onPress={() => setAddToCollectionVisible(false)}>
          <Pressable style={styles.addPopupCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.addPopupTitle}>Add to collection</Text>
            <Text style={styles.addPopupLabel}>Size</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={addToCollectionSize}
                onValueChange={(v) => setAddToCollectionSize(v as string)}
                style={styles.picker}
                itemStyle={Platform.OS === "ios" ? styles.pickerItem : undefined}
                color="#111"
                mode="dropdown"
              >
                {PERFUME_SIZES.map(({ value, label }) => (
                  <Picker.Item key={value} label={label} value={value} />
                ))}
              </Picker>
            </View>
            <View style={styles.addPopupActions}>
              <TouchableOpacity style={styles.addPopupCancel} onPress={() => setAddToCollectionVisible(false)}>
                <Text style={styles.addPopupCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPopupConfirm} onPress={confirmAddToCollection} disabled={actionLoading}>
                <Text style={styles.addPopupConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

// Helper to recursively update a comment's like state
function updateCommentLike(comments: Comment[], targetId: number, likeCount: number, liked: boolean): Comment[] {
  return comments.map((c) => {
    if (c.id === targetId) return { ...c, like_count: likeCount, liked };
    if (c.replies.length > 0) return { ...c, replies: updateCommentLike(c.replies, targetId, likeCount, liked) };
    return c;
  });
}

const styles = StyleSheet.create({
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionButton: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  actionButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  actionButtonSecondary: { backgroundColor: "#f2f2f2", borderWidth: 1, borderColor: "#e0e0e0" },
  actionButtonTextSecondary: { color: "#111" },
  actionButtonActive: { backgroundColor: "#1c1c1c" },
  actionButtonTextActive: { color: "#fff" },

  likeWishlistRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  iconActionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: "#f2f2f2" },
  iconActionBtnActive: { backgroundColor: "#e53935" },
  iconActionBtnWishlist: { backgroundColor: "#111" },
  iconActionText: { color: "#111", fontWeight: "700", fontSize: 13 },
  iconActionTextActive: { color: "#fff" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, height: "85%", backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 10 },
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

  reviewsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },
  writeReviewBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "#f2f2f2" },
  writeReviewText: { fontSize: 13, fontWeight: "800", color: "#111" },

  writeReviewForm: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14, marginBottom: 14 },
  formLabel: { fontSize: 12.5, fontWeight: "800", color: "#555", marginTop: 10, marginBottom: 4 },
  textField: { backgroundColor: "#f2f2f2", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { backgroundColor: "#f2f2f2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: "#111" },
  chipText: { color: "#111", fontWeight: "800", fontSize: 12.5 },
  chipTextActive: { color: "#fff" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center" },
  cancelBtnText: { color: "#111", fontWeight: "700" },
  submitBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontWeight: "800" },

  emptyReviews: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14 },
  emptyReviewsTitle: { fontSize: 14.5, fontWeight: "900", color: "#111" },
  emptyReviewsSubtitle: { fontSize: 13, color: "#666", marginTop: 6 },

  reviewsCountText: { color: "#777", marginBottom: 8, fontWeight: "700" },

  reviewCard: { backgroundColor: "#fafafa", borderRadius: 14, padding: 14, marginBottom: 10 },
  reviewTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  reviewAvatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  reviewUsernameText: { color: "#111", fontWeight: "900", fontSize: 13 },
  reviewMetaText: { color: "#555", fontWeight: "700", fontSize: 11.5, marginTop: 1 },
  reviewDateText: { color: "#777", fontSize: 11, marginTop: 1 },
  reviewRatingText: { color: "#111", fontWeight: "900" },
  reviewBodyText: { color: "#111", fontWeight: "700", lineHeight: 18, marginBottom: 8 },

  reviewActionRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  reviewLikeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewLikeText: { fontSize: 12.5, color: "#888", fontWeight: "700" },
  reviewCommentBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewCommentText: { fontSize: 12.5, color: "#888", fontWeight: "700" },

  commentsSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eeeeee" },
  noCommentsText: { color: "#aaa", fontSize: 13, marginBottom: 8 },
  commentCard: { backgroundColor: "#f2f2f2", borderRadius: 10, padding: 10, marginBottom: 8 },
  commentReply: { marginLeft: 16, backgroundColor: "#ececec" },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  commentAvatar: { width: 24, height: 24, borderRadius: 999, backgroundColor: "#555", alignItems: "center", justifyContent: "center" },
  commentAvatarText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  commentUsername: { fontSize: 12.5, fontWeight: "800", color: "#111" },
  commentDate: { fontSize: 11, color: "#999" },
  commentLikeBtn: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" },
  commentLikeCount: { fontSize: 11, color: "#888", fontWeight: "700" },
  commentContent: { fontSize: 13, color: "#333", lineHeight: 17, marginBottom: 4 },
  replyText: { fontSize: 12, color: "#666", fontWeight: "700" },
  repliesContainer: { marginTop: 6 },

  replyingToBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f0f0f0", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  replyingToText: { fontSize: 12, color: "#555", fontWeight: "700" },
  commentInputRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  commentInput: { flex: 1, backgroundColor: "#f2f2f2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13.5, color: "#111", maxHeight: 80 },
  commentSendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },

  errorBox: { backgroundColor: "#fde7ea", borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  errorText: { color: "#b00020", fontWeight: "800", fontSize: 13 },
  errorTextBox: { color: "#b00020", fontWeight: "800", flex: 1 },
  retryBtn: { backgroundColor: "#111", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "800" },

  addPopupBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 24 },
  addPopupCard: { width: "100%", maxWidth: 320, backgroundColor: "#fff", borderRadius: 18, padding: 20 },
  addPopupTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 16 },
  addPopupLabel: { fontSize: 13, fontWeight: "700", color: "#666", marginBottom: 8 },
  pickerWrapper: { backgroundColor: "#f2f2f2", borderRadius: 12, marginBottom: 20, overflow: "hidden", justifyContent: "center" },
  picker: { height: Platform.OS === "android" ? 48 : 120, color: "#111", justifyContent: "center", ...(Platform.OS === "android" && { width: "100%" }) },
  pickerItem: { fontSize: 16, color: "#111" },
  addPopupActions: { flexDirection: "row", gap: 12 },
  addPopupCancel: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#f2f2f2", alignItems: "center", justifyContent: "center" },
  addPopupCancelText: { color: "#111", fontWeight: "700", fontSize: 15 },
  addPopupConfirm: { flex: 1, height: 48, borderRadius: 14, backgroundColor: "#111", alignItems: "center", justifyContent: "center" },
  addPopupConfirmText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
