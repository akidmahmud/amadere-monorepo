import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// The receiving end of "ISR + on-demand revalidation" (AGENTS.web.md §7):
// the backend emits domain events (product.updated, blog_post.published,
// homepage_section.updated, ...) and should call this route so an edit shows
// up immediately instead of waiting for the page's own `revalidate` window.
//
// ⚠ Real gap, stated plainly: nothing on the backend calls this yet — no
// event-to-webhook dispatcher exists there (confirmed by reading the
// EventEmitter2 usage across the backend; every domain event stays in-process
// today). This route is real and independently testable (see AGENTS.web.md
// §14 for the live curl proof), but the automatic trigger is a backend
// feature still to be built, not a frontend gap.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid secret" } }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { path?: string; paths?: string[] };
  const paths = body.paths ?? (body.path ? [body.path] : []);
  if (paths.length === 0) {
    return NextResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "path or paths is required" } }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path, "page");
  }

  return NextResponse.json({ success: true, data: { revalidated: paths } });
}
