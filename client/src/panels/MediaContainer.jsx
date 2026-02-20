// panels/MediaContainer.jsx
// ============================================================
// Media viewer for artifacts (images, video, audio, PDFs, files)
// Includes zoom/rotate for images, players for audio/video,
// iframe for PDFs, and download for generic files
// ============================================================

import React, { useState } from "react";
import {
  FileText, Image, Film, Music, File,
  ZoomIn, ZoomOut, RotateCw, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const typeIcons = {
  image: Image,
  video: Film,
  audio: Music,
  pdf: FileText,
  file: File,
  archive: File,
  other: File,
};

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * MediaContainer — renders a preview/player for an Artifact
 *
 * Props:
 * - artifact: The artifact object from state
 * - dispatch, socket: For state updates
 */
export default function MediaContainer({ artifact, dispatch, socket }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!artifact) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No file selected
      </div>
    );
  }

  const { artifactType, name, mimeType, size, storagePath } = artifact;
  const src = storagePath || "";

  // Toolbar strip shared across viewer types
  const ViewerBar = ({ icon: BarIcon, children }) => (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30 shrink-0">
      {BarIcon && <BarIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
      <span className="text-xs text-muted-foreground truncate flex-1">{name}</span>
      {size > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(size)}</span>
      )}
      {children}
      {src && (
        <a href={src} download={name} className="inline-flex shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Download">
            <Download className="h-3 w-3" />
          </Button>
        </a>
      )}
    </div>
  );

  // Image viewer with zoom/rotate
  if (artifactType === "image" && src) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <ViewerBar icon={Image}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => Math.max(0.1, z - 0.25))}>
            <ZoomOut className="h-3 w-3" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center shrink-0">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => Math.min(5, z + 0.25))}>
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRotation(r => (r + 90) % 360)}>
            <RotateCw className="h-3 w-3" />
          </Button>
        </ViewerBar>
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <img
            src={src}
            alt={name}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.2s",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  // Video player
  if (artifactType === "video" && src) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <ViewerBar icon={Film} />
        <div className="flex-1 flex items-center justify-center p-4">
          <video controls className="max-w-full max-h-full rounded" src={src}>
            Your browser does not support video playback.
          </video>
        </div>
      </div>
    );
  }

  // Audio player
  if (artifactType === "audio" && src) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <ViewerBar icon={Music} />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-4 text-center">
            <Music className="h-16 w-16 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">{name}</p>
            <audio controls className="w-full" src={src}>
              Your browser does not support audio.
            </audio>
          </div>
        </div>
      </div>
    );
  }

  // PDF viewer
  if (artifactType === "pdf" && src) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <ViewerBar icon={FileText} />
        <div className="flex-1">
          <iframe src={src} className="w-full h-full border-0" title={name} />
        </div>
      </div>
    );
  }

  // Generic file
  const Icon = typeIcons[artifactType] || File;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-background">
      <Icon className="h-16 w-16 text-muted-foreground" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">{name || "Unnamed file"}</p>
        {mimeType && <p className="text-xs text-muted-foreground">{mimeType}</p>}
        {size > 0 && <p className="text-xs text-muted-foreground">{formatSize(size)}</p>}
      </div>
      {src && (
        <a href={src} download={name}>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </a>
      )}
    </div>
  );
}
