// docs/DocToolbar.jsx
// ============================================================
// Formatting toolbar for DocEditor
// Provides buttons for text formatting, headings, lists, etc.
// ============================================================

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Pill,
} from "lucide-react";

/**
 * DocToolbar - Formatting toolbar for Tiptap editor
 *
 * Props:
 * - editor: Tiptap editor instance
 */
export default function DocToolbar({ editor }) {
  if (!editor) return null;

  const ToolbarButton = ({ onClick, isActive, children, title }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={`
        h-7 w-7 p-0
        ${isActive ? "bg-accent text-accent-foreground" : ""}
      `}
    >
      {children}
    </Button>
  );

  const Separator = () => (
    <div className="w-px h-5 bg-border mx-1" />
  );

  return (
    <div className="doc-toolbar flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/30 flex-wrap sticky top-0 z-10">
      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline Code"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <Separator />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>

      <Separator />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </ToolbarButton>

      {/* Field Insert Button */}
      <Separator />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          // Trigger @ suggestion programmatically
          editor.chain().focus().insertContent("@").run();
        }}
        title="Insert Field (@)"
        className="h-7 px-2 text-xs"
      >
        @ Field
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          // Convert selected text to an instance pill
          const { from, to, empty } = editor.state.selection;
          if (empty) return;
          const selectedText = editor.state.doc.textBetween(from, to);
          if (!selectedText.trim()) return;

          const pillId = crypto.randomUUID();
          editor.chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent({
              type: "instancePill",
              attrs: {
                instanceId: pillId,
                instanceLabel: selectedText,
                showIcon: false,
              },
            })
            .run();
        }}
        title="Convert selection to pill"
        className="h-7 px-2 text-xs"
      >
        <Pill className="w-3 h-3 mr-1" /> Pill
      </Button>
    </div>
  );
}
