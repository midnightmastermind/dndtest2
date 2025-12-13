import React, { useRef, useState, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import ResizeHandle from "./ResizeHandle";
import Button from "@atlaskit/button";
import { token } from "@atlaskit/tokens";
import MoreVerticalIcon from "@atlaskit/icon/glyph/more-vertical";
import { ActionTypes } from "./state/actions";
import { emit } from "./socket";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
export default function Panel({
    panel,
    components,
    addContainer,
    dispatch,
    gridRef,
    cols,
    rows,
    activeId,
    gridActive,
    fullscreenPanelId,
    setFullscreenPanelId,
    state,
    DragOverlay,
    activeSize,
    activeInstance
}) {
    const panelRef = useRef(null);

    /* ------------------------------------------------------------
       🔥 NEW: Local transform refs (smooth live drag + resize)
    ------------------------------------------------------------ */
    const dragTransformRef = useRef({ x: 0, y: 0 });
    const resizeTransformRef = useRef({ w: null, h: null });
    const isDraggingPanel = activeId === panel.id;

    const SortableContainer = components["SortableContainer"];
    const Instance = components["Instance"];

    const data = useMemo(
        () => ({
            role: "panel",
            panelId: panel.id,
            fromCol: panel.col,
            fromRow: panel.row,
            width: panel.width,
            height: panel.height
        }),
        [panel]
    );

    const { setNodeRef, attributes, listeners } = useDraggable({
        id: panel.id,
        data,
        disabled: false
    });

    /* ------------------------------------------------------------
       🔥 UPDATE PANEL FINAL STATE (Reducer + Socket)
    ------------------------------------------------------------ */
    const updatePanelFinal = (updated) => {
        dispatch({ type: ActionTypes.UPDATE_PANEL, payload: updated });
        emit("update_panel", { panel: updated, gridId: panel.gridId });
    };

    /* ------------------------------------------------------------
       FULLSCREEN LOGIC (unchanged)
    ------------------------------------------------------------ */
    const prev = useRef(null);
    const toggleFullscreen = () => {
        if (!fullscreenPanelId) {
            prev.current = { ...panel };

            updatePanelFinal({
                ...panel,
                row: 0,
                col: 0,
                width: cols,
                height: rows
            });

            setFullscreenPanelId(panel.id);
        } else {
            updatePanelFinal({
                ...panel,
                ...prev.current
            });

            setFullscreenPanelId(null);
        }
    };

    /* ------------------------------------------------------------
       GRID HELPERS
    ------------------------------------------------------------ */
    const getTrackInfo = () => {
        const data = gridRef.current?.dataset.sizes;
        return data ? JSON.parse(data) : null;
    };

    const colFromPx = (px) => {
        const { colSizes } = getTrackInfo();
        const rect = gridRef.current.getBoundingClientRect();
        const rel = (px - rect.left) / rect.width;
        const total = colSizes.reduce((a, b) => a + b, 0);

        let acc = 0;
        for (let i = 0; i < colSizes.length; i++) {
            acc += colSizes[i];
            if (rel < acc / total) return i;
        }
        return colSizes.length - 1;
    };

    const rowFromPx = (py) => {
        const { rowSizes } = getTrackInfo();
        const rect = gridRef.current.getBoundingClientRect();
        const rel = (py - rect.top) / rect.height;
        const total = rowSizes.reduce((a, b) => a + b, 0);

        let acc = 0;
        for (let i = 0; i < rowSizes.length; i++) {
            acc += rowSizes[i];
            if (rel < acc / total) return i;
        }
        return rowSizes.length - 1;
    };

    /* ------------------------------------------------------------
       🔥 NEW: RESIZE HANDLER USING TRANSFORM (no Redux spam)
    ------------------------------------------------------------ */
    const beginResize = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const getX = (ev) => ev.clientX ?? ev.touches?.[0]?.clientX;
        const getY = (ev) => ev.clientY ?? ev.touches?.[0]?.clientY;

        const startX = getX(event);
        const startY = getY(event);

        const move = (ev) => {
            ev.preventDefault();
            const x = getX(ev);
            const y = getY(ev);

            const gridRect = gridRef.current.getBoundingClientRect();

            const col = colFromPx(x);
            const row = rowFromPx(y);

            const newW = Math.max(1, col - panel.col + 1);
            const newH = Math.max(1, row - panel.row + 1);

            resizeTransformRef.current = {
                w: Math.min(newW, cols - panel.col),
                h: Math.min(newH, rows - panel.row)
            };

            panelRef.current.style.transform = `scale(1)`; // keeps GPU active
            panelRef.current.style.opacity = 0.92;
        };

        const stop = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", stop);
            window.removeEventListener("touchmove", move);
            window.removeEventListener("touchend", stop);

            const { w, h } = resizeTransformRef.current;
            resizeTransformRef.current = { w: null, h: null };

            // Commit final dimensions to Redux
            updatePanelFinal({
                ...panel,
                width: w ?? panel.width,
                height: h ?? panel.height
            });

            panelRef.current.style.opacity = 1;
        };

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop);
        window.addEventListener("touchmove", move, { passive: false });
        window.addEventListener("touchend", stop);
    };

    /* ------------------------------------------------------------
       🔥 COMPUTE GRID AREA (live during resize)
    ------------------------------------------------------------ */
    const liveW = resizeTransformRef.current.w ?? panel.width;
    const liveH = resizeTransformRef.current.h ?? panel.height;

    const gridArea = `${panel.row + 1} / ${panel.col + 1} /
                    ${panel.row + liveH + 1} /
                    ${panel.col + liveW + 1}`;

    /* ------------------------------------------------------------
       RENDER PANEL
    ------------------------------------------------------------ */
    return (
        <div
            ref={(el) => {
                panelRef.current = el;
                setNodeRef(el);
            }}
            {...attributes}
            style={{
                gridArea,
                background: token("elevation.surface", "rgba(17,17,17,0.95)"),
                borderRadius: 8,
                border: "1px solid #AAA",
                overflow: "hidden",
                position: "relative",
                margin: "3px",
                zIndex: isDraggingPanel ? 9999 : 50,
                transform: isDraggingPanel
                    ? `translate(${dragTransformRef.current.x}px, ${dragTransformRef.current.y}px)`
                    : "translate(0,0)",
                transition: isDraggingPanel ? "none" : "transform 120ms ease"
            }}
        >
            <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* HEADER */}
                <div
                    style={{
                        background: "#2F343A",
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 600,
                        color: "white",
                    }}
                >
                    {/* DRAG HANDLE */}
                    <div
                        style={{ paddingLeft: 6, touchAction: "none" }}
                        {...listeners}
                    >
                        <MoreVerticalIcon size="small" primaryColor="#9AA0A6" />
                    </div>

                    {/* TYPE SWITCHER + FULLSCREEN */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <select
                            value={panel.type}
                            onChange={(e) => {
                                const newType = e.target.value;

                                updatePanelFinal({
                                    ...panel,
                                    type: newType,
                                    props: {
                                        ...(panel.props || {}),
                                        containerId:
                                            newType === "taskbox"
                                                ? `taskbox-${panel.id}`
                                                : `schedule-${panel.id}`,
                                    }
                                });
                            }}
                        >
                            {Object.keys(components).map((key) => (
                                <option key={key} value={key}>
                                    {key}
                                </option>
                            ))}
                        </select>

                        <Button spacing="compact" onClick={toggleFullscreen}>
                            {fullscreenPanelId === panel.id ? "R" : "F"}
                        </Button>
                    </div>
                </div>

                {/* PANEL CONTENT */}
                <div style={{ flex: 1, minHeight: 0, color: "white", margin: 5 }}>
                    <button onClick={addContainer}>+ Container</button>
                    <div className="containers-col">
                        <SortableContext items={panel.containers} strategy={rectSortingStrategy}>
                            {state.containers.map((c) => (
                                <SortableContainer key={c.id} container={c} />
                            ))}
                        </SortableContext>
                        {state.containers.length === 0 && (
                            <div style={{ marginTop: 12, opacity: 0.7, fontSize: 13 }}>
                                Create a container to start.
                            </div>
                        )}
                    </div>
                </div>
                <DragOverlay adjustScale={false}>
                    {activeId ? (
                        <div style={{ width: activeSize?.width, height: activeSize?.height }}>
                            <Instance
                                id={`overlay-${activeId}`}
                                label={activeInstance?.label ?? "Dragging"}
                                overlay
                            />
                        </div>
                    ) : null}
                </DragOverlay>
                {/* RESIZE HANDLE */}
                <ResizeHandle
                    onMouseDown={beginResize}
                    onTouchStart={beginResize}
                />
            </div>
        </div>
    );
}

