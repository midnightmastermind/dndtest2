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
      {...(!overlay ? dragAttributes : {})}
      {...(!overlay ? dragListeners : {})}
    >
      {label}
    </div>
  );
}

// Custom compare: ignore listener/attribute object identity churn if label/id unchanged
export default React.memo(InstanceInner, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.label === next.label &&
    prev.overlay === next.overlay
  );
});
