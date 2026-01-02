// InstanceInner.jsx
import React, { useContext, useEffect, useState, useCallback } from "react";
import { GridDataContext } from "./GridDataContext";

import { Settings } from "lucide-react";
import InstanceForm from "./ui/InstanceForm";
import ButtonPopover from "./ui/ButtonPopover";

import * as CommitHelpers from "./helpers/CommitHelpers";

function InstanceInner({
  id,
  label,
  overlay = false,
  dragAttributes,
  dragListeners,

  dispatch,
  socket, // ✅ NEW
}) {
  const { activeId } = useContext(GridDataContext);
  const isOriginalActive = !overlay && activeId === id;

  const [draft, setDraft] = useState(() => ({ label: label ?? "" }));

  useEffect(() => {
    setDraft({ label: label ?? "" });
  }, [label, id]);

  const commitLabel = useCallback(() => {
    const next = (draft?.label ?? "").trim();
    if (!next) return;

    // ✅ CommitHelpers expects { instance } with id
    CommitHelpers.updateInstance({
      dispatch,
      socket,
      instance: { id, label: next },
      emit: true
    });
  }, [draft?.label, id, dispatch, socket]);

  const deleteMe = useCallback(() => {
    CommitHelpers.deleteInstance({
      dispatch,
      socket,
      instanceId: id,
      emit: true
    });
  }, [id, dispatch, socket]);

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
      <ButtonPopover style={{ display: "none" }} label={<Settings className="h-4 w-4" />}>
        <InstanceForm
          value={draft}
          onChange={setDraft}
          onCommitLabel={commitLabel}
          onDeleteInstance={deleteMe}
          instanceId={id}
        />
      </ButtonPopover>

      <div style={{ flex: 1, minWidth: 0 }}>{label}</div>
    </div>
  );
}

export default React.memo(InstanceInner);
