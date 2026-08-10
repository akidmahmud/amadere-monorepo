import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

// Anonymous, unauthenticated — fired once per visitor per post by
// BlogViewTracker (client-side, cookie-gated so repeat visits/refreshes
// don't recount). Throttled server-side too (10/min per IP) since this is
// a public write endpoint with no auth.
export function useRecordBlogPostView() {
  return useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await api.POST("/api/v1/blog-posts/{slug}/view", { params: { path: { slug } } });
      if (error) throw error;
    },
  });
}
