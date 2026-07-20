import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginatedResult } from "@amader/shared";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";

type CustomerProfileDto = components["schemas"]["CustomerProfileDto"];
type AddressDto = components["schemas"]["AddressDto"];
type WishlistItemDto = components["schemas"]["WishlistItemDto"];
type OrderDto = components["schemas"]["OrderDto"];
type ReviewDto = components["schemas"]["ReviewDto"];

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { firstName?: string; lastName?: string; dob?: string }) =>
      proxyFetch<CustomerProfileDto>("/customers/me", { method: "PATCH", body: JSON.stringify(args) }),
    onSuccess: (profile) => queryClient.setQueryData(["me"], profile),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (args: { currentPassword: string; newPassword: string }) =>
      proxyFetch("/customers/me/password", { method: "PATCH", body: JSON.stringify(args) }),
  });
}

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: ["my-orders", page],
    queryFn: () => proxyFetch<PaginatedResult<OrderDto>>(`/orders?page=${page}&pageSize=10`),
  });
}

export function useWishlist(locale: string, enabled = true) {
  return useQuery({
    queryKey: ["wishlist", locale],
    queryFn: () => proxyFetch<WishlistItemDto[]>(`/customers/me/wishlist?locale=${locale}`),
    enabled,
  });
}

export function useAddToWishlist(locale: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) => proxyFetch(`/customers/me/wishlist/${productId}`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", locale] }),
  });
}

export function useRemoveFromWishlist(locale: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) => proxyFetch(`/customers/me/wishlist/${productId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", locale] }),
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: () => proxyFetch<AddressDto[]>("/customers/me/addresses"),
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: Omit<AddressDto, "id">) =>
      proxyFetch<AddressDto>("/customers/me/addresses", { method: "POST", body: JSON.stringify(args) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number } & Partial<Omit<AddressDto, "id">>) =>
      proxyFetch<AddressDto>(`/customers/me/addresses/${args.id}`, { method: "PATCH", body: JSON.stringify(args) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => proxyFetch(`/customers/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });
}

export function useMyReviews(page: number) {
  return useQuery({
    queryKey: ["my-reviews", page],
    queryFn: () => proxyFetch<PaginatedResult<ReviewDto>>(`/reviews/mine?page=${page}&pageSize=10`),
  });
}

export interface CreateReviewInput {
  productId: number;
  rating: number;
  comment?: string;
  images?: string[];
}

// Customer-authenticated (goes through proxyFetch, JSON body) — the actual
// verified-purchase check happens backend-side (ForbiddenException if no
// completed order for this product, ConflictException if already reviewed).
export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      proxyFetch<ReviewDto>("/reviews", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-reviews"] }),
  });
}

const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// Public/unauthenticated upload (no Review row created here, see
// reviews.controller.ts) — plain fetch straight to the backend, same reason
// as useUploadPaymentScreenshot: multipart bodies aren't modeled by the
// typed api client, and this proxy route only forwards JSON anyway.
export function useUploadReviewImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${backendBaseUrl}/api/v1/reviews/upload`, { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Upload failed");
      return body.data as { url: string };
    },
  });
}
