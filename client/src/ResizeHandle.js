const ResizeHandle = ({ onMouseDown, onTouchStart }) => {
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{
        width: 18,
        height: 18,
        position: "absolute",
        right: 0,
        bottom: 0,
        cursor: "nwse-resize",
        background: "rgba(3, 2, 2, 0.52)",
        borderTopLeftRadius: 6,
        touchAction: "none",
        zIndex: 9999,          // ✅ ensure it's above scroll content
        pointerEvents: "auto",  // ✅ explicit
      }}
    />
  );
};

export default ResizeHandle;