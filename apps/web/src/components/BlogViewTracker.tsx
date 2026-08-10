"use client";

import { useEffect } from "react";
import { useRecordBlogPostView } from "@/hooks/useBlogPostView";
import { hasViewedBlogPost, markBlogPostViewed } from "@/lib/blog-views";

// Renders nothing — dropped into the blog detail Server Component page just
// to fire the view beacon on mount. Deliberately NOT counted server-side on
// the page's own data fetch (blog-posts.service.ts publicGetBySlug used to
// do that, but that route is ISR-cached with revalidate=3600, so it only
// fired on whatever cadence the cache happened to revalidate — nowhere close
// to real visitor counts). This fires once per real browser render instead,
// gated by a 30-day cookie so repeat visits/refreshes don't inflate it.
export function BlogViewTracker({ postId, slug }: { postId: number; slug: string }) {
  const recordView = useRecordBlogPostView();

  useEffect(() => {
    if (hasViewedBlogPost(postId)) return;
    markBlogPostViewed(postId);
    recordView.mutate(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, slug]);

  return null;
}
