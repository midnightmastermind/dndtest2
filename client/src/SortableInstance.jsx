// SortableInstance.jsx — MERGED (dnd-kit + gated native outbound drag)
//
// Fixes merged in:
// ✅ Keep native drag gated by edge-intent (unchanged)
// ✅ Ensure we never accidentally allow native drag when disabled
// ✅ Minor safety: clear allowNativeRef on dragstart (so next gesture starts clean)

import React, { useCallback, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Instance from "./Instance";

const NATIVE_MIME = "application/x-daytracker-dnd";

function SortableInstance({
  instance,
  containerId,
  panelId,
  dispatch,
  socket,
  disabled = false,

  // ✅ Feature flag: enable outbound native drag (still gated by edge intent)
  nativeEnabled = false,
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: instance.id,
      disabled,
      data: {
        role: "instance",
        instanceId: instance.id,
        containerId,
        panelId,
        label: instance.label,
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? "none" : "auto",
    touchAction: "none",
  };

  // ==========================================================
  // ✅ Native outbound "edge intent" gate
  // ==========================================================
  const allowNativeRef = useRef(false);
  const pointerDownRef = useRef(false);

  const EDGE_PX = 24;

  const isNearEdge = useCallback((x, y) => {
    return (
      x <= EDGE_PX ||
      y <= EDGE_PX ||
      x >= window.innerWidth - EDGE_PX ||
      y >= window.innerHeight - EDGE_PX
    );
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (!nativeEnabled || disabled) return;

      pointerDownRef.current = true;
      allowNativeRef.current = false;

      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;

      if (typeof x === "number" && typeof y === "number" && isNearEdge(x, y)) {
        allowNativeRef.current = true;
      }
    },
    [nativeEnabled, disabled, isNearEdge]
  );

  useEffect(() => {
    if (!nativeEnabled) return;

    const onMove = (e) => {
      if (!pointerDownRef.current) return;

      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;

      if (typeof x === "number" && typeof y === "number" && isNearEdge(x, y)) {
        allowNativeRef.current = true;
      }
    };

    const onUp = () => {
      pointerDownRef.current = false;
      allowNativeRef.current = false;
    };

    const onBlur = () => {
      // If the user is holding down and the window blurs (alt-tab / leaving),
      // treat it like edge intent so the next native event isn't blocked.
      if (pointerDownRef.current) allowNativeRef.current = true;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [nativeEnabled, isNearEdge]);

  const onNativeDragStart = useCallback(
    (e) => {
      // Always clear for the next gesture (even if we block).
      // (Some browsers can fire dragstart in weird sequences.)
      const reset = () => {
        pointerDownRef.current = false;
        allowNativeRef.current = false;
      };

      if (!nativeEnabled || disabled) {
        e.preventDefault?.();
        reset();
        return;
      }

      // ✅ Gate: only allow native drag if we detected edge intent
      if (!allowNativeRef.current) {
        e.preventDefault?.();
        reset();
        return;
      }

      try {
        e.dataTransfer.effectAllowed = "copyMove";

        const payload = {
          v: 1,
          type: "instance",
          id: instance.id,
          from: { containerId, panelId },
          meta: { label: instance.label },
        };

        e.dataTransfer.setData(NATIVE_MIME, JSON.stringify(payload));
        e.dataTransfer.setData("text/plain", instance.label || "");
        e.dataTransfer.setData("text/html", `<div>${instance.label ?? ""}</div>`);
      } catch {
        // ignore
      }
    },
    [nativeEnabled, disabled, instance, containerId, panelId]
  );

  return (
    <div
      ref={setNodeRef}
      data-instance-id={instance.id}
      className="no-select instance-wrap"
      style={style}
      // ✅ draggable "available" only when enabled; dragstart is still gated.
      draggable={!!nativeEnabled && !disabled}
      onDragStart={onNativeDragStart}
      onPointerDown={onPointerDown}
      {...(!disabled ? attributes : {})}
      {...(!disabled ? listeners : {})}
    >
      <Instance id={instance.id} label={instance.label} dispatch={dispatch} socket={socket} />
    </div>
  );
}

export default React.memo(SortableInstance);
