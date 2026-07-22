"use client";

import { useState } from "react";
import Link from "next/link";
import { useBlogPosts, useBlogPostStats, useDeleteBlogPost, type BlogPostFilters } from "@/hooks/useBlogPosts";
import { useBlogCategories } from "@/hooks/useBlogCategories";
import { PUBLISH_STATUSES, type PublishStatus } from "@/hooks/useBrands";
import { BlogStatsStrip } from "@/components/blog/BlogStatsStrip";

const selectClass =
  "h-[38px] appearance-none rounded-inner border border-border bg-surface px-2.5 pr-7 text-[0.75rem] font-semibold text-secondary outline-none focus:border-brand-500";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-[#e3f7ee] text-[#16a06d]",
  DRAFT: "bg-[#f1eafe] text-[#8b5cf6]",
  ARCHIVED: "bg-[#eef1f6] text-[#7a879b]",
  PENDING: "bg-[#fdf1dc] text-[#e0821c]",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-[6px] px-2.5 py-1 text-[0.68rem] font-bold ${className}`}>{children}</span>;
}

const DEFAULT_FILTERS: BlogPostFilters = { page: 1, pageSize: 10 };

export default function BlogPostsPage() {
  const [filters, setFilters] = useState<BlogPostFilters>(DEFAULT_FILTERS);
  const { data: stats } = useBlogPostStats();
  const { data, isLoading } = useBlogPosts(filters);
  const { data: categories } = useBlogCategories();
  const categoryName = new Map((categories ?? []).map((c) => [c.id, c.translations[0]?.name ?? c.slug]));
  const deletePost = useDeleteBlogPost();

  const posts = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function set(patch: Partial<BlogPostFilters>) {
    setFilters((f) => ({ ...f, ...patch, page: 1 }));
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <BlogStatsStrip stats={stats} />

      <div className="rounded-card border border-border bg-surface p-[18px_18px_14px] shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search posts..."
            defaultValue={filters.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
          <select className={selectClass} value={filters.categoryId ?? ""} onChange={(e) => set({ categoryId: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">All Categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.translations[0]?.name ?? c.slug}
              </option>
            ))}
          </select>
          <select className={selectClass} value={filters.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as PublishStatus | undefined })}>
            <option value="">All Status</option>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.isFeatured === true ? "featured" : ""}
            onChange={(e) => set({ isFeatured: e.target.value === "featured" ? true : undefined })}
          >
            <option value="">All Posts</option>
            <option value="featured">Featured only</option>
          </select>
          <Link
            href="/blog-posts/new"
            className="ml-auto inline-flex h-[38px] items-center gap-1.5 rounded-inner bg-brand-500 px-[15px] text-[0.8rem] font-bold text-white hover:bg-brand-600"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Blog Post
          </Link>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Post", "Category", "Tags", "Status", "Featured", "Date", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap bg-[#f7f9fc] px-2.5 py-[11px] text-left text-[0.73rem] font-bold text-secondary ${i === 0 ? "rounded-l-[8px]" : ""} ${i === 6 ? "rounded-r-[8px]" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-8 text-center text-sm text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && posts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2.5 py-8 text-center text-sm text-muted">
                    No posts match these filters.
                  </td>
                </tr>
              )}
              {posts.map((p) => {
                const title = p.translations[0]?.title ?? p.slug;
                const categoryLabel = p.categoryIds.map((id) => categoryName.get(id)).filter(Boolean)[0];
                return (
                  <tr key={p.id} className="border-b border-[#f1f5fa] last:border-b-0 hover:bg-[#fafcfe]">
                    <td className="px-2.5 py-3.5 align-middle">
                      <div className="flex min-w-[240px] items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-[42px] w-[56px] flex-none rounded-[8px] border border-border object-cover" />
                        ) : (
                          <div className="grid h-[42px] w-[56px] flex-none place-items-center rounded-[8px] border border-border bg-surface-2 text-base">📝</div>
                        )}
                        <div>
                          <div className="line-clamp-2 max-w-[250px] font-bold text-text">{title}</div>
                          <div className="mt-0.5 text-[0.68rem] font-medium text-muted">/blog/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap">
                      {categoryLabel ? <span className="inline-flex rounded-[6px] bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-500">{categoryLabel}</span> : "—"}
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap text-[0.72rem] text-secondary">{p.tagIds.length} tags</td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap">
                      <Pill className={STATUS_PILL[p.status] ?? "bg-surface-2 text-secondary"}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</Pill>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill={p.isFeatured ? "#f5a623" : "#dfe5ee"}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </td>
                    <td className="px-2.5 py-3.5 align-middle whitespace-nowrap text-[0.78rem] font-semibold text-text">
                      {new Date(p.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-2.5 py-3.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/blog-posts/${p.id}`} aria-label="Edit" className="grid h-[30px] w-[30px] place-items-center rounded-[8px] bg-brand-50 text-brand-500 hover:bg-brand-100">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </Link>
                        {p.status === "PUBLISHED" && (
                          <a
                            href={`${process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3001"}/blog/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View"
                            className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-surface-2"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => confirm(`Delete "${title}"?`) && deletePost.mutate(p.id)}
                          className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-muted hover:bg-surface-2"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5">
          <div className="text-[0.76rem] font-semibold text-secondary">{total === 0 ? "No posts" : `Showing ${start} to ${end} of ${total} posts`}</div>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={page <= 1} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))} className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<number[]>((acc, n) => {
                if (acc.length && n - acc[acc.length - 1] > 1) acc.push(-1);
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === -1 ? (
                  <span key={`dots-${i}`} className="px-1 text-[0.74rem] text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, page: n }))}
                    className={`h-[30px] min-w-[30px] rounded-[8px] border px-2 text-[0.74rem] font-bold ${n === page ? "border-brand-500 bg-brand-500 text-white" : "border-border text-text hover:bg-surface-2"}`}
                  >
                    {n}
                  </button>
                ),
              )}
            <button type="button" disabled={page >= totalPages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))} className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-border text-text disabled:opacity-40">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <select
              value={pageSize}
              onChange={(e) => setFilters((f) => ({ ...f, pageSize: Number(e.target.value), page: 1 }))}
              className="h-[30px] rounded-[8px] border border-border bg-surface px-2 text-[0.72rem] font-semibold text-secondary outline-none"
            >
              {[10, 25, 50].map((s) => (
                <option key={s} value={s}>
                  {s} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
