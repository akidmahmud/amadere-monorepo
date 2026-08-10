"use client";

import { useState } from "react";
import { Button, Icon, Modal } from "@amader/admin-ui";
import { usePreviewContent, type EmailBlock, type EmailContentMode } from "@/hooks/useNewsletterCampaigns";

// Renders the same server-side renderCampaignHtml() used for real sends —
// what you see here is what a subscriber gets, not a client-side
// approximation. Fetched on click, not live-on-every-keystroke, to avoid
// spamming the backend while typing.
export function PreviewButton({ mode, blocks, html }: { mode: EmailContentMode; blocks: EmailBlock[]; html: string }) {
  const [open, setOpen] = useState(false);
  const preview = usePreviewContent();

  function handleOpen() {
    setOpen(true);
    preview.mutate({ mode, blocks, html });
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={handleOpen}>
        <Icon name="visibility" size={16} /> Preview
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Email Preview" className="max-w-[700px]">
        {preview.isPending && <p className="text-sm text-muted">Rendering…</p>}
        {preview.isError && <p className="text-sm text-danger">Failed to render preview.</p>}
        {preview.data && (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.data.html}
            className="h-[70vh] w-full rounded-inner border border-border bg-white"
          />
        )}
      </Modal>
    </>
  );
}
