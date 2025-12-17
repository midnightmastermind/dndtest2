import React, { useContext } from "react";
import { GridDataContext } from "./GridDataContext";

function InstanceInner({
  id,
  label,
  overlay = false,
  dragAttributes,
  dragListeners,
}) {
  const { activeId } = useContext(GridDataContext);
  const isOriginalActive = !overlay && activeId === id;

  return (
    <div
      className={"font-mono dnd-instance" + (isOriginalActive ? " hidden" : "")}
      style={{
        touchAction: "manipulation",           // ✅ allow scroll
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      {...(!overlay ? dragAttributes : {})}
      {...(!overlay ? dragListeners : {})}
    >
      {label}
    </div>
  );
}

export default React.memo(InstanceInner);