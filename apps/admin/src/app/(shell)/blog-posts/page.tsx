"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";
import { useBlogPosts, useDeleteBlogPost } from "@/hooks/useBlogPosts";

export default function BlogPostsPage() {
  const [status, setStatus] = useState<PublishStatus | undefined>();
  const { data: posts, isLoading } = useBlogPosts(status);
  const deletePost = useDeleteBlogPost();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{posts?.length ?? 0} posts</p>
        <div className="flex gap-3">
          <select
            value={status ?? ""}
            onChange={(e) => setStatus(e.target.value ? (e.target.value as PublishStatus) : undefined)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            <option value="">All statuses</option>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Link href="/blog-posts/new">
            <Button variant="primary">Add post</Button>
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {posts && posts.length === 0 && <p className="text-sm text-muted">No posts.</p>}

      <div className="flex flex-col gap-3">
        {posts?.map((post) => (
          <Card key={post.id} className="flex items-center gap-3">
            {post.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.imageUrl} alt="" className="h-10 w-10 rounded-inner border border-border object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {post.translations[0]?.title ?? post.slug}
              </div>
              <div className="text-xs text-muted">
                {post.slug} · {post.status} · {post.viewCount} views
                {post.publishedAt && ` · published ${new Date(post.publishedAt).toLocaleDateString()}`}
              </div>
            </div>
            <Link href={`/blog-posts/${post.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${post.translations[0]?.title ?? post.slug}"?`)) deletePost.mutate(post.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
