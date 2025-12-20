// InstanceInner.jsx
import React, { useContext, useEffect, useState } from "react";
import { GridDataContext } from "./GridDataContext";

import { Settings } from "lucide-react";
import InstanceForm from "./ui/InstanceForm";
import ButtonPopover from "./ui/ButtonPopover";
import { emit } from "./socket";
import { updateInstanceAction, deleteInstanceAction } from "./state/actions";

/**
 * Uses your action creators + socket emits.
 * Needs `dispatch` passed in.
 */
function InstanceInner({
  id,
  label,
  overlay = false,
  dragAttributes,
  dragListeners,

  // ✅ provide dispatch from parent
  dispatch,
}) {
  const { activeId } = useContext(GridDataContext);
  const isOriginalActive = !overlay && activeId === id;

  const [draft, setDraft] = useState(() => ({ label: label ?? "" }));

  // keep draft in sync if label changes from server
  useEffect(() => {
    setDraft({ label: label ?? "" });
  }, [label, id]);

  const commitLabel = () => {
    const next = (draft?.label ?? "").trim();
    if (!next) return;

    // ✅ optimistic reducer update
    dispatch?.(updateInstanceAction({ id, label: next }));

    // ✅ server update
    emit("update_instance", { instance: { id, label: next } });
  };

  const deleteMe = () => {
    // ✅ optimistic reducer update (also removes from all container.items in reducer)
    dispatch?.(deleteInstanceAction(id));

    // ✅ server delete (server should cascade remove from containers)
    emit("delete_instance", { instanceId: id });
  };

  return (
    <div
      className={"font-mono dnd-instance" + (isOriginalActive ? " hidden" : "")}
      style={{
        touchAction: "manipulation",
        WebkitUserSelect: "none",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      {...(!overlay ? dragAttributes : {})}
      {...(!overlay ? dragListeners : {})}
    >
      {/* ✅ settings popover next to label */}
      <ButtonPopover label={<Settings className="h-4 w-4" />}>
        <InstanceForm
          value={draft}
          onChange={setDraft}
          onCommitLabel={commitLabel}
          onDeleteInstance={deleteMe}
          instanceId={id}
        />
      </ButtonPopover>
      {/* ✅ label gets its own div */}
      <div style={{ flex: 1, minWidth: 0 }}>{label}</div>

      
    </div>
  );
}

export default React.memo(InstanceInner);
