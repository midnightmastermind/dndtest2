
// ui/RadialMenu.jsx
// ============================================================
// Radial/Arc menu component with spinning animation
// Used as a combined drag handle + action menu for panels/containers/instances
//
// CHANGES (ONLY what you asked):
// ✅ keep everything else the same as the last working portal+spin version
// ✅ fix "shooting from bottom" -> swing from TOP into place
// ✅ fix move handle color mismatch (copy was fine) -> move uses slate gradient
// ✅ remove always-visible mode tooltip block (keep only native hover tooltips via title)
// ✅ increase spacing (buttons farther from each other + farther from center)
// ✅ add WHITE BORDER around popup buttons (like handle)
// ✅ handle becomes a LEFT TAB (not circle), hugs inside wall, taller, slightly wider
// ============================================================

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Settings, Plus, Copy, Move } from "lucide-react";

export default function RadialMenu({
  dragMode = "move",
  onToggleDragMode,
  onSettings,
  onAddChild,
  addLabel = "Item",
  disabled = false,
  size = "sm",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);

  // outside-click should consider BOTH handle area and the portal area
  const menuRef = useRef(null);       // in-flow wrapper
  const portalRef = useRef(null);     // portaled wrapper

  const handleRef = useRef(null);
  const timeoutRef = useRef(null);

  // fixed-position anchor for portal (null until measured)
  const [anchor, setAnchor] = useState({ x: null, y: null });

  // controls the "from -> to" animation after mount
  const [entered, setEntered] = useState(false);

  // ✅ swing IN from the TOP (was -90, which could feel like bottom depending on your angles)
  // Using +90 means the arc wrapper starts rotated "up" and swings down into place.
  const startRot = 90;

  const updateAnchor = useCallback(() => {
    const el = handleRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, []);

  // Close menu when clicking outside (includes portal!)
  useEffect(() => {
    const handlePointerDown = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inPortal = portalRef.current?.contains(e.target);
      if (!inMenu && !inPortal) setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  // Auto-close after delay
  useEffect(() => {
    if (isOpen) timeoutRef.current = setTimeout(() => setIsOpen(false), 5000);
    return () => timeoutRef.current && clearTimeout(timeoutRef.current);
  }, [isOpen]);

  // when open, sync anchor before paint
  useLayoutEffect(() => {
    if (!isOpen) return;
    updateAnchor();
  }, [isOpen, updateAnchor]);

  // keep anchor synced while any parent scrolls (nested scrollers too)
  useEffect(() => {
    if (!isOpen) return;

    const onAnyScroll = () => updateAnchor();
    const onResize = () => updateAnchor();

    window.addEventListener("scroll", onAnyScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onAnyScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, updateAnchor]);

  // ensure the portal animates "from" state on open
  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    setEntered(false);
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  const handleToggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (disabled) return;

      setIsOpen((prev) => {
        const next = !prev;
        if (next) updateAnchor(); // prevent top-left fly-in
        return next;
      });
    },
    [disabled, updateAnchor]
  );

  const handleAction = useCallback((action, e) => {
    e?.stopPropagation();
    action?.();
    setIsOpen(false);
  }, []);

  // Size configurations
  // ✅ increased radius for spacing
  const sizes = {
    sm: {
      handle: "h-5",            // height only; width is custom for tab
      handleIcon: "w-2.5 h-2.5",
      menu: "w-6 h-6",
      menuIcon: "w-3 h-3",
      radius: 34,               // was 24
    },
    md: {
      handle: "h-6",
      handleIcon: "w-3 h-3",
      menu: "w-7 h-7",
      menuIcon: "w-3.5 h-3.5",
      radius: 42,               // was 30
    },
  };

  const s = sizes[size] || sizes.sm;

  // Mode indicator icon inside handle
  const ModeIcon = dragMode === "copy" ? Copy : Move;

  // ✅ space buttons apart more (angles farther apart) + keep left-side arc
  const menuItems = useMemo(
    () => [
      {
        angle: 135, // upper-left (was 135)
        icon: Settings,
        label: "Settings",
        onClick: onSettings,
        color: "bg-slate-600 hover:bg-slate-500",
      },
      {
        angle: 180, // left
        icon: Plus,
        label: `Add ${addLabel}`,
        onClick: onAddChild,
        color: "bg-emerald-600 hover:bg-emerald-500",
      },
      {
        angle: 225, // lower-left (was -135)
        icon: dragMode === "move" ? Copy : Move,
        label: dragMode === "move" ? "Set to Copy" : "Set to Move",
        onClick: onToggleDragMode,
        // ✅ copy stays blue; move stays slate (matches handle)
        color: dragMode === "move" ? "bg-blue-600 hover:bg-blue-500" : "bg-slate-600 hover:bg-slate-500",
      },
    ],
    [addLabel, dragMode, onAddChild, onSettings, onToggleDragMode]
  );

  // PORTALED arc menu
  const portaledArcMenu =
    isOpen &&
    anchor.x != null &&
    createPortal(
      <div
        ref={portalRef}
        style={{
          position: "fixed",
          left: anchor.x,
          top: anchor.y,
          width: s.radius * 2 + 28,   // slightly bigger footprint
          height: s.radius * 2 + 28,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 2147483647,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          className={`
            radial-menu-items
            absolute inset-0
            pointer-events-none
            transition-all duration-300 ease-out
          `}
          style={{
            transformOrigin: "50% 50%",
            // ✅ rotary swing from TOP
            transform: `rotate(${entered ? 0 : startRot}deg)`,
            opacity: entered ? 1 : 0,
            transitionProperty: "transform, opacity",
            transitionDuration: "280ms",
            transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const angleRad = (item.angle * Math.PI) / 180;
            const x = Math.cos(angleRad) * s.radius;
            const y = Math.sin(angleRad) * s.radius;
            const delay = index * 35;

            return (
              <button
                key={item.label}
                type="button"
                onClick={(e) => handleAction(item.onClick, e)}
                disabled={disabled || !item.onClick}
                className={`
                  radial-menu-item
                  absolute
                  ${s.menu}
                  rounded-full
                  flex items-center justify-center
                  ${item.color}
                  border-2 border-white/80        /* ✅ white border like handle */
                  shadow-lg
                  transition-all
                  ${entered ? "pointer-events-auto" : "pointer-events-none"}
                  ${disabled || !item.onClick ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-110"}
                `}
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  transitionDelay: `${delay}ms`,
                }}
                title={item.label}
              >
                {/* keep icons upright while wrapper rotates */}
                <span
                  style={{
                    display: "inline-flex",
                    transformOrigin: "50% 50%",
                    transform: `rotate(${entered ? 0 : -startRot}deg)`,
                    transition: "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transitionDelay: `${delay}ms`,
                  }}
                >
                  <Icon className={`${s.menuIcon} text-white`} />
                </span>
              </button>
            );
          })}
        </div>
      </div>,
      document.body
    );

  return (
    <div
      ref={menuRef}
      className={`radial-menu relative items-center flex-1 flex flex-col justify-center ${className}`}
      style={{ zIndex: isOpen ? 99999 : 1000 }}
    >
      {/* Central drag handle button with mode indicator */}
      <button
        ref={handleRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          radial-handle
          ${s.handle}
          flex items-center justify-center
          px-2
          w-8
          flex-1
          rounded-l-[6px]
          rounded-r-none
          border-r-2 border-solid
          border-gray-700
          transition-all duration-200
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-grab hover:shadow-lg active:cursor-grabbing"}
          ${isOpen ? "brightness-105" : ""}
          transition-all duration-200
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-grab hover:shadow-lg active:cursor-grabbing"}
        `}
        style={{
          alignSelf: "center",
          flex: 1,
          paddingTop: 0,
          paddingBottom: 0,
        }}
        title={`${dragMode === "copy" ? "Copy" : "Move"} mode - Click for menu`}
      >
        <ModeIcon className={`${s.handleIcon} text-white/90`} />
      </button>


      {/* ✅ Portal renders arc menu above overflow/scroll parents */}
      {portaledArcMenu}

      {/* ❌ removed always-visible Move/Copy label per request */}
    </div>
  );
}

