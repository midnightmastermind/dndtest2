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
      className={"dnd-instance" + (isOriginalActive ? " hidden" : "")}
      style={{
        touchAction: "pan-y",           // ✅ allow scroll
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