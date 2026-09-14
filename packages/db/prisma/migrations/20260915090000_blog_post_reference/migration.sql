-- Optional "Reference" section on blog posts (sources/citations), rendered
-- after the FAQ. Nullable: existing posts simply have none.
ALTER TABLE "blog_post_translations" ADD COLUMN "reference" TEXT;
