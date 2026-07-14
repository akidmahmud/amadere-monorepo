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
