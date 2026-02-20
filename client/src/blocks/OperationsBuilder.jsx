// blocks/OperationsBuilder.jsx
// ============================================================
// Main component - Visual block programming editor
// Inspired by Snap!/Scratch
// ============================================================

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BlockDragProvider } from "./useBlockDnD";
import BlockPalette, { MiniPalette } from "./BlockPalette";
import OperationsCanvas, { CompactCanvas } from "./OperationsCanvas";
import { evaluateBlockTree, describeBlock, serializeBlockTree, deserializeBlockTree } from "./blockEvaluator";
import { createFieldBlocks } from "./blockTypes";
import { formatValue } from "../helpers/CalculationHelpers";

/**
 * OperationsBuilder - Main visual block editor component
 *
 * Props:
 * - initialBlocks: Initial block structure (serialized format or full block)
 * - availableFields: Array of field definitions for field blocks
 * - context: Evaluation context { state, gridId, scope, timeFilter }
 * - onChange: (blockTree) => void - called when structure changes
 * - onEvaluate: (result) => void - called with evaluation result
 * - disabled: boolean
 * - compact: boolean - use compact layout
 */
export default function OperationsBuilder({
  initialBlocks,
  availableFields = [],
  context = {},
  onChange,
  onEvaluate,
  disabled = false,
  compact = false,
}) {
  // Deserialize initial blocks if needed
  const [rootBlock, setRootBlock] = useState(() => {
    if (!initialBlocks) return null;
    if (initialBlocks.id) return initialBlocks; // Already a full block
    return deserializeBlockTree(initialBlocks, { fields: availableFields });
  });

  // Build field lookup for evaluation
  const fieldsById = useMemo(() => {
    const map = {};
    for (const field of availableFields) {
      map[field.id] = field;
    }
    return map;
  }, [availableFields]);

  // Evaluate on change
  const [result, setResult] = useState(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!rootBlock) {
      setResult(null);
      setDescription("");
      onEvaluate?.(null);
      return;
    }

    // Evaluate the block tree
    const evalResult = evaluateBlockTree(rootBlock, {
      state: context.state || {},
      fieldsById,
      variables: {},
    });

    setResult(evalResult.value);
    setDescription(describeBlock(rootBlock));
    onEvaluate?.(evalResult.value);
  }, [rootBlock, context.state, fieldsById, onEvaluate]);

  // Handle structure changes
  const handleChange = useCallback((newRootBlock) => {
    setRootBlock(newRootBlock);

    // Serialize and emit change
    const serialized = serializeBlockTree(newRootBlock);
    onChange?.(serialized);
  }, [onChange]);

  // Handle block connection/movement
  const handleBlockMove = useCallback((block, target) => {
    // For canvas drops, this is handled by OperationsCanvas
  }, []);

  const handleBlockConnect = useCallback((block, targetBlockId, slotId) => {
    // For slot connections, this is handled by OperationsCanvas
  }, []);

  if (compact) {
    return (
      <CompactOperationsBuilder
        rootBlock={rootBlock}
        availableFields={availableFields}
        result={result}
        description={description}
        onChange={handleChange}
        disabled={disabled}
      />
    );
  }

  return (
    <BlockDragProvider
      onBlockMove={handleBlockMove}
      onBlockConnect={handleBlockConnect}
    >
      <div className={`
        operations-builder
        flex flex-col h-full
        border border-border rounded-lg
        bg-card overflow-hidden
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}>
        {/* Header with result preview */}
        <div className="builder-header flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Expression:</span>
            <code className="text-xs text-foreground bg-background px-2 py-0.5 rounded">
              {description || "(empty)"}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Result:</span>
            <span className={`
              text-sm font-mono px-2 py-0.5 rounded
              ${result !== null ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}
            `}>
              {result !== null ? formatResultValue(result) : "—"}
            </span>
          </div>
        </div>

        {/* Main content: Palette + Canvas */}
        <div className="builder-content flex flex-1 overflow-hidden">
          {/* Block palette sidebar */}
          <BlockPalette
            fields={availableFields}
          />

          {/* Canvas area */}
          <div className="builder-canvas flex-1 p-4 overflow-auto">
            <OperationsCanvas
              rootBlock={rootBlock}
              onChange={handleChange}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </BlockDragProvider>
  );
}

/**
 * CompactOperationsBuilder - Smaller inline version
 */
function CompactOperationsBuilder({
  rootBlock,
  availableFields,
  result,
  description,
  onChange,
  disabled,
}) {
  const [showPalette, setShowPalette] = useState(false);

  return (
    <BlockDragProvider>
      <div className="compact-operations-builder space-y-2">
        {/* Compact canvas */}
        <CompactCanvas
          rootBlock={rootBlock}
          onChange={onChange}
          disabled={disabled}
          placeholder="Click to add blocks"
        />

        {/* Result preview */}
        {rootBlock && (
          <div className="flex items-center justify-between text-xs">
            <code className="text-muted-foreground truncate max-w-[200px]">
              {description}
            </code>
            <span className="font-mono text-primary">
              = {result !== null ? formatResultValue(result) : "?"}
            </span>
          </div>
        )}

        {/* Toggle palette button */}
        <button
          onClick={() => setShowPalette(!showPalette)}
          className="text-xs text-primary hover:underline"
        >
          {showPalette ? "Hide blocks" : "Show blocks"}
        </button>

        {/* Mini palette */}
        {showPalette && (
          <MiniPalette
            fields={availableFields}
            showCategories={["fields", "math", "aggregations"]}
          />
        )}
      </div>
    </BlockDragProvider>
  );
}

/**
 * Format a result value for display
 */
function formatResultValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

/**
 * useOperationsBuilder - Hook version for more control
 */
export function useOperationsBuilder({
  initialBlocks,
  availableFields = [],
  context = {},
}) {
  const [rootBlock, setRootBlock] = useState(() => {
    if (!initialBlocks) return null;
    if (initialBlocks.id) return initialBlocks;
    return deserializeBlockTree(initialBlocks, { fields: availableFields });
  });

  const fieldsById = useMemo(() => {
    const map = {};
    for (const field of availableFields) {
      map[field.id] = field;
    }
    return map;
  }, [availableFields]);

  const result = useMemo(() => {
    if (!rootBlock) return { value: null, errors: [] };
    return evaluateBlockTree(rootBlock, {
      state: context.state || {},
      fieldsById,
      variables: {},
    });
  }, [rootBlock, context.state, fieldsById]);

  const serialized = useMemo(() => {
    return serializeBlockTree(rootBlock);
  }, [rootBlock]);

  return {
    rootBlock,
    setRootBlock,
    result,
    serialized,
    description: rootBlock ? describeBlock(rootBlock) : "",
  };
}

export { BlockDragProvider };
