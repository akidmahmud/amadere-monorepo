import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Closes the gap apps/web's api/revalidate/route.ts flags: on-demand ISR
// revalidation exists and works (curl-tested), but nothing on this side
// called it — admin edits only showed up once the page's own timed
// `revalidate` window (5-60 min) rolled over. Callers fire-and-forget this
// right after a successful write; a revalidation hiccup must never fail the
// actual admin save, since the timed window still catches up eventually.
@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);

  constructor(private readonly config: ConfigService) {}

  // `type: 'layout'` busts every route sharing that layout (e.g. passing
  // '/[locale]' revalidates every locale-scoped page at once) — needed for
  // site-wide UI driven by the root layout itself (logo, favicon, banner)
  // rather than one specific page's own content.
  async revalidate(paths: string[], type?: 'layout' | 'page'): Promise<void> {
    // Same env var sitemap/canonical/structured-data already use for the
    // storefront's absolute origin (e.g. https://amadere.com) — no need for
    // a second one.
    const webAppUrl = this.config.get<string>('STOREFRONT_BASE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    // Unconfigured (e.g. local dev without a running web app) — skip
    // silently rather than logging noise on every admin save.
    if (!webAppUrl || !secret) return;

    try {
      const res = await fetch(`${webAppUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ paths, type }),
      });
      if (!res.ok) {
        this.logger.warn(`Revalidate ${paths.join(', ')} returned ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to revalidate ${paths.join(', ')}: ${err}`);
    }
  }
}
