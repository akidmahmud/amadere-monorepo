"use client";

import { useEffect, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  FontColor,
  List,
  BlockQuote,
  Link,
  Image,
  ImageUpload,
  ImageToolbar,
  MediaEmbed,
  Table,
  TableToolbar,
  SourceEditing,
  GeneralHtmlSupport,
  type Editor,
  type EditorConfig,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

const COLOR_SWATCHES = [
  { color: "#1a1a1a", label: "Black" },
  { color: "#dc2626", label: "Red" },
  { color: "#d97706", label: "Amber" },
  { color: "#16a34a", label: "Green" },
  { color: "#2563eb", label: "Blue" },
  { color: "#7c3aed", label: "Violet" },
];

// Registers a custom image-upload adapter that hits the same admin media
// endpoint the old Tiptap toolbar used — CKEditor's own plugin-array
// convention accepts a plain function like this (invoked once with the
// editor instance at construction) alongside real Plugin classes.
function UploadAdapterPlugin(editor: Editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => ({
    upload: async () => {
      const file = await loader.file;
      if (!file) throw new Error("No file to upload");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/media", { method: "POST", body: form });
      const body = (await res.json()) as { success: true; data: { url: string } } | { success: false; error: { message: string } };
      if (!body.success) throw new Error(body.error.message);
      return { default: body.data.url };
    },
    abort: () => {},
  });
}

// Module-level constant, not built inline in JSX — @ckeditor/ckeditor5-react
// reinitializes the whole editor (tearing down and rebuilding it, which
// drops focus) whenever the `config` object's *reference* changes, and an
// object literal written inline in a component's render body is a brand-new
// reference on every render. Since none of this needs component state, one
// stable object fixes it — this was the cause of "can't write in it"/every
// keystroke bouncing the editor.
const CONFIG: EditorConfig = {
  licenseKey: "GPL",
  plugins: [
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    FontColor,
    List,
    BlockQuote,
    Link,
    Image,
    ImageUpload,
    ImageToolbar,
    MediaEmbed,
    Table,
    TableToolbar,
    SourceEditing,
    GeneralHtmlSupport,
    UploadAdapterPlugin,
  ],
  toolbar: [
    "undo",
    "redo",
    "|",
    "heading",
    "|",
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "|",
    "fontColor",
    "|",
    "bulletedList",
    "numberedList",
    "|",
    "blockQuote",
    "link",
    "uploadImage",
    "insertTable",
    "mediaEmbed",
    "|",
    "sourceEditing",
  ],
  heading: {
    options: [
      { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
      { model: "heading1", view: "h1", title: "Heading 1", class: "ck-heading_heading1" },
      { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
      { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" },
    ],
  },
  fontColor: { colors: COLOR_SWATCHES },
  image: { toolbar: ["imageTextAlternative"] },
  table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
  // General HTML Support (still free/open-source, same `ckeditor5` package)
  // — without it CKEditor strips any class/style/element it doesn't already
  // have a dedicated feature for, so hand-authored HTML/CSS typed via
  // Source view would just vanish again on the next edit. `name: /.*/`
  // allows every element; admin-only content, already sanitized again on
  // the storefront before render, so this is a deliberate trust boundary,
  // not a new one.
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
};

// CKEditor 5 (free/GPL, self-hosted) — the site-wide rich text editor, used
// anywhere admin-authored HTML content is captured (product Full
// Description, blog post content, and any future editor field). Same
// external contract as the Tiptap editor it replaces (`value`/`onChange`
// HTML strings), so call sites needed zero changes.
//
// `licenseKey: "GPL"` opts into the free, open-source self-hosted license —
// per CKEditor's own terms this shows a small "Powered by CKEditor" badge in
// the editor UI; only a paid commercial license removes it.
export function RichTextEditorInner({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [fullscreen, setFullscreen] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const lastValue = useRef(value);

  // Only push `value` into the editor when it changed from *outside* (e.g.
  // the edit page's seedFrom() once the async product/post fetch resolves)
  // — CKEditor's `data` prop is initial-only, not a controlled value, same
  // reasoning as the Tiptap editor this replaces.
  useEffect(() => {
    if (editorRef.current && value !== lastValue.current) {
      editorRef.current.setData(value);
      lastValue.current = value;
    }
  }, [value]);

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col overflow-hidden rounded-none border border-border bg-surface"
          // min-height matches the dynamic-import loading placeholder in
          // RichTextEditor.tsx — CKEditor's own toolbar+editable UI boots
          // asynchronously too (a second, separate async phase on top of
          // the dynamic import), and without a reserved height here the
          // container stays collapsed until that finishes, then jumps to
          // full height — the same click-lands-on-the-wrong-element hazard
          // the loading placeholder alone doesn't cover.
          : "min-h-[430px] rounded-sm border border-border bg-surface"
      }
    >
      <div className="flex justify-end border-b border-border bg-surface-2 p-1">
        <button
          type="button"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => setFullscreen((v) => !v)}
          className="rounded-[6px] px-2 py-1 text-xs font-semibold text-secondary transition-colors hover:bg-brand-50 hover:text-brand-600"
        >
          {fullscreen ? "⤡ Exit fullscreen" : "⤢ Fullscreen"}
        </button>
      </div>
      <div className={fullscreen ? "flex-1 overflow-y-auto" : undefined}>
        <CKEditor
          editor={ClassicEditor}
          data={value}
          onReady={(editor) => {
            editorRef.current = editor;
          }}
          onChange={(_event, editor) => {
            const html = editor.getData();
            lastValue.current = html;
            onChange(html);
          }}
          config={CONFIG}
        />
      </div>
    </div>
  );
}
