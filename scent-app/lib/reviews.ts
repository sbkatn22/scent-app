// lib/reviews.ts
import { http } from "@/lib/http";

export type Review = {
  id: number;
  uid: string;
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
  created_at: string;
  updated_at: string;
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