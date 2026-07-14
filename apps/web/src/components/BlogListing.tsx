import { BlogCard, SectionHeading } from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { BlogPager } from "@/components/BlogPager";
import { toBlogCardData } from "@/lib/blog-mapper";
import type { components } from "@/lib/api/schema";

export interface BlogListingProps {
  posts: components["schemas"]["PublicBlogPostSummaryDto"][];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  heading?: string;
  description?: string | null;
}

export function BlogListing({ posts, total, page, pageSize, basePath, heading, description }: BlogListingProps) {
  return (
    <div className="mx-auto max-w-[1180px] px-5 py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      {description && <p className="mx-auto -mt-4 mb-6 max-w-2xl text-center font-body text-sm text-muted">{description}</p>}

      {posts.length === 0 ? (
        <p className="py-16 text-center font-body text-sm text-muted">No posts here yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {posts.map((post) => (
              <BlogCard key={post.id} post={toBlogCardData(post)} linkComponent={AppLink} />
            ))}
          </div>
          <BlogPager basePath={basePath} page={page} totalPages={Math.ceil(total / pageSize)} />
        </>
      )}
    </div>
  );
}
