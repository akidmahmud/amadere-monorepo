"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Youtube from "@tiptap/extension-youtube";
import { useUploadMedia } from "@/hooks/useMedia";

const HEADING_OPTIONS = [
  { label: "Paragraph", level: 0 as const },
  { label: "Heading 1", level: 1 as const },
  { label: "Heading 2", level: 2 as const },
  { label: "Heading 3", level: 3 as const },
  { label: "Heading 4", level: 4 as const },
];

const COLOR_SWATCHES = ["#1a1a1a", "#dc2626", "#d97706", "#16a34a", "#2563eb", "#7c3aed"];

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-9 min-w-9 place-items-center rounded-[6px] px-1.5 text-base font-semibold transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-brand-500 text-white hover:bg-brand-600 hover:text-white" : "text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onToggleSource, sourceOpen, onToggleFullscreen, fullscreen }: {
  editor: Editor;
  onToggleSource: () => void;
  sourceOpen: boolean;
  onToggleFullscreen: () => void;
  fullscreen: boolean;
}) {
  const upload = useUploadMedia();
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    editor.chain().focus().setImage({ src: media.url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 p-1.5">
      <select
        aria-label="Text style"
        disabled={sourceOpen}
        value={HEADING_OPTIONS.find((o) => (o.level === 0 ? editor.isActive("paragraph") : editor.isActive("heading", { level: o.level })))?.level ?? 0}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run();
        }}
        className="h-9 rounded-[6px] border border-border bg-surface px-1.5 text-sm text-text outline-none disabled:opacity-40"
      >
        {HEADING_OPTIONS.map((o) => (
          <option key={o.level} value={o.level}>
            {o.label}
          </option>
        ))}
      </select>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <ToolbarButton label="Bold" active={editor.isActive("bold")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px bg-border" />

      {COLOR_SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Text color ${color}`}
          title={color}
          disabled={sourceOpen}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setColor(color).run()}
          className="h-6 w-6 rounded-full border border-border disabled:opacity-40"
          style={{ background: color }}
        />
      ))}
      <ToolbarButton label="Clear color" disabled={sourceOpen} onClick={() => editor.chain().focus().unsetColor().run()}>
        ⌀
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •≡
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.≡
      </ToolbarButton>
      <ToolbarButton label="Blockquote" active={editor.isActive("blockquote")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <ToolbarButton
        label="Insert link"
        active={editor.isActive("link")}
        disabled={sourceOpen}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = prompt("Link URL:", previous ?? "");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href: url }).run();
        }}
      >
        🔗
      </ToolbarButton>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      <ToolbarButton label="Insert image" disabled={sourceOpen || upload.isPending} onClick={() => imageInputRef.current?.click()}>
        🖼
      </ToolbarButton>
      <ToolbarButton
        label="Embed YouTube video"
        disabled={sourceOpen}
        onClick={() => {
          const url = prompt("YouTube video URL:");
          if (url) editor.commands.setYoutubeVideo({ src: url });
        }}
      >
        ▶
      </ToolbarButton>
      <ToolbarButton
        label="Insert table"
        disabled={sourceOpen}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        ▦
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <ToolbarButton label="Undo" disabled={sourceOpen} onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={sourceOpen} onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>

      <span className="ml-auto flex items-center gap-1">
        <ToolbarButton label="View HTML source" active={sourceOpen} onClick={onToggleSource}>
          {"</>"}
        </ToolbarButton>
        <ToolbarButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} active={fullscreen} onClick={onToggleFullscreen}>
          {fullscreen ? "⤡" : "⤢"}
        </ToolbarButton>
      </span>
    </div>
  );
}

// TipTap-based WYSIWYG editor — replaces the old native contentEditable +
// document.execCommand() implementation (deprecated API, no toolbar beyond
// Bold/Italic/H2/H3/lists/link). Same external contract as before
// (`value`/`onChange` HTML strings) so every call site (product descriptions,
// blog post content) needed zero changes.
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState(value);
  const [fullscreen, setFullscreen] = useState(false);
  const lastValue = useRef(value);

  const editor = useEditor({
    // Next.js SSR: TipTap warns/hydration-mismatches if it renders
    // immediately on the server render pass — defer to the client.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TextStyle,
      Color,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastValue.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] p-3 text-sm leading-relaxed text-text outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-sm [&_h4]:font-bold [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_a]:text-brand-500 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-secondary [&_img]:max-w-full [&_img]:rounded-inner [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:p-1.5 [&_iframe]:aspect-video [&_iframe]:w-full",
      },
    },
  });

  // Only push `value` into the editor when it changed from *outside* (e.g.
  // the edit page's seedFrom()) — otherwise every keystroke's
  // onUpdate->onChange->re-render loop would reset the caret to the start.
  useEffect(() => {
    if (editor && value !== lastValue.current && !editor.isFocused) {
      editor.commands.setContent(value);
    }
    lastValue.current = value;
  }, [value, editor]);

  useEffect(() => {
    if (sourceOpen) setSourceDraft(lastValue.current);
  }, [sourceOpen]);

  function applySource() {
    onChange(sourceDraft);
    lastValue.current = sourceDraft;
    editor?.commands.setContent(sourceDraft);
    setSourceOpen(false);
  }

  if (!editor) return <div className="min-h-[264px] rounded-sm border border-border bg-surface" />;

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col overflow-hidden rounded-none border border-border bg-surface"
          : "rounded-sm border border-border bg-surface"
      }
    >
      <Toolbar
        editor={editor}
        sourceOpen={sourceOpen}
        onToggleSource={() => (sourceOpen ? applySource() : setSourceOpen(true))}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
      />
      {sourceOpen ? (
        <textarea
          value={sourceDraft}
          onChange={(e) => setSourceDraft(e.target.value)}
          className={`w-full flex-1 resize-none bg-surface p-3 font-mono text-xs text-text outline-none ${fullscreen ? "" : "min-h-[220px]"}`}
        />
      ) : (
        <EditorContent editor={editor} className={fullscreen ? "flex-1 overflow-y-auto" : undefined} />
      )}
    </div>
  );
}
