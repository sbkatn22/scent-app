// lib/reviews.ts
import { http } from "@/lib/http";

export type Review = {
  id: number;
  uid: string;
  username: string;
  profile_picture: string;
  fid: number;
  description: string;
  rating: number;
  gender: "Female" | "Slightly Female" | "Unisex" | "Slightly Male" | "Male";
  winter: boolean;
  spring: boolean;
  summer: boolean;
  autumn: boolean;
  day: boolean;
  night: boolean;
  longevity:
    | "0 - 2 hours"
    | "2 - 4 hours"
    | "4 - 6 hours"
    | "6 - 8 hours"
    | "8-10 hours"
    | "10+ hours";
  value: "Super Overpriced" | "Overpriced" | "Alright" | "Good Value" | "Super Value";
  maceration: number | null;
  sillage: "No Sillage" | "Light Sillage" | "Moderate Sillage" | "Strong Sillage" | null;
  like_count: number;
  liked: boolean;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: number;
  review_id: number;
  parent_id: number | null;
  content: string;
  author: { uid: string; username: string; profile_picture: string };
  like_count: number;
  liked: boolean;
  created_at: string;
  updated_at: string;
  replies: Comment[];
};

export type ReviewsListResponse = {
  count: number;
  results: Review[];
};

export type CreateReviewPayload = {
  fid: number;
  description: string;
  rating: number;
  gender: Review["gender"];
  longevity: Review["longevity"];
  value: Review["value"];
  winter?: boolean;
  spring?: boolean;
  summer?: boolean;
  autumn?: boolean;
  day?: boolean;
  night?: boolean;
  maceration?: number | null;
  sillage?: Review["sillage"];
};

export async function createReview(payload: CreateReviewPayload): Promise<Review> {
  const res = await http.post("/api/reviews/create/", payload);
  return res.data as Review;
}

export async function getReviewsForFragrance(fid: number): Promise<ReviewsListResponse> {
  const res = await http.get("/api/reviews/", { params: { fid } });
  return res.data as ReviewsListResponse;
}

export async function getMyReviews(): Promise<ReviewsListResponse> {
  const res = await http.get("/api/reviews/by-user/");
  return res.data as ReviewsListResponse;
}

export type UpdateReviewPayload = Partial<Omit<CreateReviewPayload, "fid">>;

export async function updateReview(reviewId: number, payload: UpdateReviewPayload): Promise<Review> {
  const res = await http.patch(`/api/reviews/update/${reviewId}/`, payload);
  return res.data as Review;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await http.delete(`/api/reviews/delete/${reviewId}/`);
}

export async function toggleReviewLike(reviewId: number): Promise<{ review_id: number; like_count: number; liked: boolean }> {
  const res = await http.post("/api/reviews/likes/toggle/", { review_id: reviewId });
  return res.data;
}

export async function getComments(reviewId: number): Promise<{ comments: Comment[] }> {
  const res = await http.get("/api/reviews/comments/", { params: { review_id: reviewId } });
  return res.data;
}

export async function createComment(reviewId: number, content: string, parentId?: number): Promise<Comment> {
  const body: { review_id: number; content: string; parent_id?: number } = { review_id: reviewId, content };
  if (parentId != null) body.parent_id = parentId;
  const res = await http.post("/api/reviews/comments/create/", body);
  return res.data;
}

export async function toggleCommentLike(commentId: number): Promise<{ comment_id: number; like_count: number; liked: boolean }> {
  const res = await http.post("/api/reviews/comments/likes/toggle/", { comment_id: commentId });
  return res.data;
}