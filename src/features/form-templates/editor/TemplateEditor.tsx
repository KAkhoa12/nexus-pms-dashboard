import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getTemplateEditorTools } from "@/features/form-templates/editor/editor-config";
import type { EditorJsData } from "@/features/form-templates/editor/types";
import "./editor.css";

type TemplateEditorProps = {
  documentKey: string;
  data: EditorJsData;
  onChange: (data: EditorJsData) => void;
  onReadyChange?: (isReady: boolean) => void;
};

type AlignValue = "left" | "center" | "right" | "justify";

export type TemplateEditorHandle = {
  insertVariable: (
    token: string,
    point?: { x: number; y: number },
  ) => Promise<void>;
  insertImageFromDataUrl: (dataUrl: string) => void;
  applyAlign: (align: AlignValue) => Promise<boolean>;
  undo: () => boolean;
  redo: () => boolean;
  save: () => Promise<EditorJsData | null>;
  focus: () => void;
};

type EditorInstance = {
  isReady: Promise<void>;
  save: () => Promise<EditorJsData>;
  render: (data: EditorJsData) => Promise<void>;
  destroy: () => void | Promise<void>;
  blocks: {
    insert: (toolName: string, data?: Record<string, unknown>) => void;
  };
  caret: {
    focus: () => void;
  };
};

type EditorConstructor = new (config: {
  holder: HTMLDivElement;
  tools: Record<string, unknown>;
  data: EditorJsData;
  minHeight: number;
  autofocus: boolean;
  onChange: () => Promise<void>;
}) => EditorInstance;

type EditorJsBlock = EditorJsData["blocks"][number];

function toSafeText(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

function normalizeIncomingData(data: EditorJsData): EditorJsData {
  const blocks = data.blocks
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      if (!block.type || typeof block.type !== "string") return null;

      const rawData =
        block.data &&
        typeof block.data === "object" &&
        !Array.isArray(block.data)
          ? (block.data as Record<string, unknown>)
          : {};

      if (block.type === "rich_text") {
        return {
          id: block.id,
          type: "paragraph",
          data: {
            text: toSafeText(rawData.html),
          },
        } as EditorJsBlock;
      }

      return {
        id: block.id,
        type: block.type,
        data: rawData,
      } as EditorJsBlock;
    })
    .filter((block): block is EditorJsBlock => Boolean(block));

  if (blocks.length === 0) {
    return {
      blocks: [
        {
          type: "paragraph",
          data: { text: "" },
        },
      ],
    };
  }

  return {
    time: data.time,
    version: data.version,
    blocks,
  };
}

function getAlignFromData(value: unknown): AlignValue | null {
  if (value === "left") return "left";
  if (value === "center") return "center";
  if (value === "right") return "right";
  if (value === "justify") return "justify";
  return null;
}

function setCaretFromPoint(x: number, y: number): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const documentWithCaret = document as Document & {
    caretPositionFromPoint?: (
      px: number,
      py: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (px: number, py: number) => Range | null;
  };

  if (typeof documentWithCaret.caretPositionFromPoint === "function") {
    const pos = documentWithCaret.caretPositionFromPoint(x, y);
    if (!pos) return false;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  if (typeof documentWithCaret.caretRangeFromPoint === "function") {
    const range = documentWithCaret.caretRangeFromPoint(x, y);
    if (!range) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  return false;
}

function normalizeAlign(value: string | null | undefined): AlignValue | null {
  if (value === "left") return "left";
  if (value === "center") return "center";
  if (value === "right") return "right";
  if (value === "justify") return "justify";
  return null;
}

function getNodeElement(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node instanceof HTMLElement ? node : node.parentElement;
}

function getEditorRootFromNode(
  node: Node | null,
  holder: HTMLDivElement,
): HTMLElement | null {
  const element = getNodeElement(node);
  const editorRoot = element?.closest<HTMLElement>(".codex-editor") || null;
  if (!editorRoot) return null;
  return holder.contains(editorRoot) ? editorRoot : null;
}

function getEditorBlocks(editorRoot: HTMLElement): HTMLElement[] {
  const redactor = editorRoot.querySelector<HTMLElement>(
    ".codex-editor__redactor",
  );
  if (!redactor) return [];
  return Array.from(redactor.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains("ce-block"),
  );
}

function getAlignTargets(
  block: HTMLElement,
  editorRoot: HTMLElement,
): HTMLElement[] {
  const candidates = Array.from(
    block.querySelectorAll<HTMLElement>(".ce-paragraph, .ce-header, ul, ol"),
  );
  return candidates.filter((element) => {
    const ownerBlock = element.closest<HTMLElement>(".ce-block");
    if (ownerBlock !== block) return false;
    const ownerEditor = element.closest<HTMLElement>(".codex-editor");
    return ownerEditor === editorRoot;
  });
}

function isAlignableBlock(
  block: HTMLElement,
  editorRoot: HTMLElement,
): boolean {
  return getAlignTargets(block, editorRoot).length > 0;
}

function getBlockAlignment(
  block: HTMLElement,
  editorRoot: HTMLElement,
): AlignValue | null {
  const targets = getAlignTargets(block, editorRoot);
  for (const target of targets) {
    const align = normalizeAlign(target.style.textAlign);
    if (align) return align;
  }
  return null;
}

function collectAlignLookupFromData(
  blocks: EditorJsData["blocks"],
  alignById: Map<string, AlignValue>,
): void {
  blocks.forEach((block) => {
    if (block.id) {
      const align = getAlignFromData(
        (block.data as Record<string, unknown>).align,
      );
      if (align && align !== "left") {
        alignById.set(block.id, align);
      }
    }

    const columnsRaw = (block.data as Record<string, unknown>).columns;
    if (!Array.isArray(columnsRaw)) return;
    columnsRaw.forEach((column) => {
      if (!column || typeof column !== "object" || Array.isArray(column))
        return;
      const nestedBlocks = (column as { blocks?: unknown }).blocks;
      if (!Array.isArray(nestedBlocks)) return;
      collectAlignLookupFromData(
        nestedBlocks as EditorJsData["blocks"],
        alignById,
      );
    });
  });
}

function collectAlignmentsFromDom(holder: HTMLDivElement): {
  seenBlockIds: Set<string>;
  alignById: Map<string, AlignValue>;
} {
  const seenBlockIds = new Set<string>();
  const alignById = new Map<string, AlignValue>();

  const editorRoots = Array.from(
    holder.querySelectorAll<HTMLElement>(".codex-editor"),
  );
  editorRoots.forEach((editorRoot) => {
    const blocks = getEditorBlocks(editorRoot);
    blocks.forEach((block) => {
      if (!isAlignableBlock(block, editorRoot)) return;
      const blockId = block.dataset.id;
      if (!blockId) return;
      seenBlockIds.add(blockId);
      const align = getBlockAlignment(block, editorRoot);
      if (!align || align === "left") return;
      alignById.set(blockId, align);
    });
  });

  return { seenBlockIds, alignById };
}

function patchBlockAlignments(
  blocks: EditorJsData["blocks"],
  seenBlockIds: Set<string>,
  alignById: Map<string, AlignValue>,
): EditorJsData["blocks"] {
  return blocks.map((block) => {
    const nextData = { ...block.data } as Record<string, unknown>;

    if (block.id && seenBlockIds.has(block.id)) {
      const align = alignById.get(block.id);
      if (align) {
        nextData.align = align;
      } else {
        delete nextData.align;
      }
    }

    const columnsRaw = nextData.columns;
    if (Array.isArray(columnsRaw)) {
      nextData.columns = columnsRaw.map((column) => {
        if (!column || typeof column !== "object" || Array.isArray(column)) {
          return column;
        }
        const columnRecord = { ...(column as Record<string, unknown>) };
        const nestedBlocksRaw = columnRecord.blocks;
        if (Array.isArray(nestedBlocksRaw)) {
          columnRecord.blocks = patchBlockAlignments(
            nestedBlocksRaw as EditorJsData["blocks"],
            seenBlockIds,
            alignById,
          );
        }
        return columnRecord;
      });
    }

    return {
      ...block,
      data: nextData,
    } as EditorJsBlock;
  });
}

function enrichAlignments(
  data: EditorJsData,
  holder: HTMLDivElement | null,
): EditorJsData {
  if (!holder) return data;
  const { seenBlockIds, alignById } = collectAlignmentsFromDom(holder);

  return {
    ...data,
    blocks: patchBlockAlignments(data.blocks, seenBlockIds, alignById),
  };
}

function applyAlignToBlock(
  block: HTMLElement,
  editorRoot: HTMLElement,
  align: AlignValue,
): void {
  const targets = getAlignTargets(block, editorRoot);
  targets.forEach((element) => {
    element.style.textAlign = align;
  });
}

function findClosestBlock(node: Node | null): HTMLElement | null {
  if (!node) return null;
  let current: Node | null = node;
  while (current) {
    if (
      current instanceof HTMLElement &&
      current.classList.contains("ce-block")
    ) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function getSelectedBlocks(
  editorRoot: HTMLElement,
  range: Range,
  anchorNode: Node | null,
): HTMLElement[] {
  const selectedByClass = Array.from(
    editorRoot.querySelectorAll<HTMLElement>(".ce-block--selected"),
  ).filter((block) => isAlignableBlock(block, editorRoot));
  if (selectedByClass.length > 1) return selectedByClass;

  const allBlocks = getEditorBlocks(editorRoot);
  const blocks = allBlocks.filter((block) =>
    isAlignableBlock(block, editorRoot),
  );
  const startBlock = findClosestBlock(range.startContainer);
  const endBlock = findClosestBlock(range.endContainer);
  if (
    startBlock &&
    endBlock &&
    startBlock.closest<HTMLElement>(".codex-editor") === editorRoot &&
    endBlock.closest<HTMLElement>(".codex-editor") === editorRoot
  ) {
    const startIndex = allBlocks.indexOf(startBlock);
    const endIndex = allBlocks.indexOf(endBlock);
    if (startIndex >= 0 && endIndex >= 0) {
      const left = Math.min(startIndex, endIndex);
      const right = Math.max(startIndex, endIndex);
      const byBoundary = allBlocks
        .slice(left, right + 1)
        .filter((block) => isAlignableBlock(block, editorRoot));
      if (byBoundary.length > 0) {
        return byBoundary;
      }
    }
  }

  const selectedByRange = blocks.filter((block) => {
    try {
      return range.intersectsNode(block);
    } catch {
      return false;
    }
  });
  if (selectedByRange.length > 0) return selectedByRange;
  if (selectedByClass.length > 0) return selectedByClass;

  const focusedByClass =
    editorRoot.querySelector<HTMLElement>(".ce-block--focused");
  if (focusedByClass && isAlignableBlock(focusedByClass, editorRoot)) {
    return [focusedByClass];
  }

  const closest = findClosestBlock(anchorNode);
  if (
    closest &&
    closest.closest<HTMLElement>(".codex-editor") === editorRoot &&
    isAlignableBlock(closest, editorRoot)
  ) {
    return [closest];
  }
  return [];
}

function getBlocksBetween(
  editorRoot: HTMLElement,
  startBlock: HTMLElement,
  endBlock: HTMLElement,
): HTMLElement[] {
  const allBlocks = getEditorBlocks(editorRoot);
  const startIndex = allBlocks.indexOf(startBlock);
  const endIndex = allBlocks.indexOf(endBlock);
  if (startIndex < 0 || endIndex < 0) return [];

  const left = Math.min(startIndex, endIndex);
  const right = Math.max(startIndex, endIndex);
  return allBlocks
    .slice(left, right + 1)
    .filter((block) => isAlignableBlock(block, editorRoot));
}

function applyAlignmentsFromData(
  holder: HTMLDivElement | null,
  data: EditorJsData,
): void {
  if (!holder) return;

  const alignById = new Map<string, AlignValue>();
  collectAlignLookupFromData(data.blocks, alignById);

  const editorRoots = Array.from(
    holder.querySelectorAll<HTMLElement>(".codex-editor"),
  );
  editorRoots.forEach((editorRoot) => {
    const domBlocks = getEditorBlocks(editorRoot);
    domBlocks.forEach((domBlock) => {
      if (!isAlignableBlock(domBlock, editorRoot)) return;
      const id = domBlock.dataset.id;
      if (!id) return;
      const nextAlign = alignById.get(id) || "left";
      applyAlignToBlock(domBlock, editorRoot, nextAlign);
    });
  });
}

function serializeData(data: EditorJsData): string {
  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
}

function isEditorDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("ft_editor_debug") === "1";
}

function debugEditorLog(event: string, payload: Record<string, unknown>): void {
  if (!isEditorDebugEnabled()) return;
  console.info(`[TemplateEditor] ${event}`, payload);
}

export const TemplateEditor = forwardRef<
  TemplateEditorHandle,
  TemplateEditorProps
>(({ data, documentKey, onChange, onReadyChange }, ref) => {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const onChangeRef = useRef(onChange);
  const onReadyChangeRef = useRef(onReadyChange);
  const lastRangeRef = useRef<Range | null>(null);
  const lastExpandedRangeRef = useRef<Range | null>(null);
  const lastSelectionRootRef = useRef<HTMLElement | null>(null);
  const lastSelectedBlocksRef = useRef<HTMLElement[]>([]);
  const lastMultiSelectedBlocksRef = useRef<HTMLElement[]>([]);
  const pointerDragStartBlockRef = useRef<HTMLElement | null>(null);
  const pointerDragRootRef = useRef<HTMLElement | null>(null);
  const [tools, setTools] = useState<Record<string, unknown> | null>(null);

  const historyRef = useRef<EditorJsData[]>([]);
  const historyIndexRef = useRef(-1);
  const isHistoryOperationRef = useRef(false);
  const lastSerializedRef = useRef("");

  const pushHistory = (snapshot: EditorJsData) => {
    const serialized = serializeData(snapshot);
    if (!serialized) return;
    if (serialized === lastSerializedRef.current) return;

    const nextSnapshot = normalizeIncomingData(snapshot);
    const nextHistory = historyRef.current.slice(
      0,
      historyIndexRef.current + 1,
    );
    nextHistory.push(nextSnapshot);

    const MAX_HISTORY = 200;
    if (nextHistory.length > MAX_HISTORY) {
      nextHistory.splice(0, nextHistory.length - MAX_HISTORY);
    }

    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    lastSerializedRef.current = serialized;
  };

  const setHistoryFromInitial = (initialData: EditorJsData) => {
    const normalized = normalizeIncomingData(initialData);
    historyRef.current = [normalized];
    historyIndexRef.current = 0;
    lastSerializedRef.current = serializeData(normalized);
  };

  const applyHistoryAt = async (nextIndex: number): Promise<boolean> => {
    const instance = editorRef.current;
    const holder = holderRef.current;
    if (!instance) return false;

    const snapshot = historyRef.current[nextIndex];
    if (!snapshot) return false;

    isHistoryOperationRef.current = true;
    try {
      await instance.render(snapshot);
      applyAlignmentsFromData(holder, snapshot);
      historyIndexRef.current = nextIndex;
      lastSerializedRef.current = serializeData(snapshot);
      onChangeRef.current(snapshot);
      return true;
    } finally {
      isHistoryOperationRef.current = false;
    }
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);

  useEffect(() => {
    let active = true;
    const loadTools = async () => {
      const loaded = await getTemplateEditorTools();
      if (active) {
        setTools(loaded);
      }
    };
    void loadTools();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const holder = holderRef.current;
      const selection = window.getSelection();
      if (!holder || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const editorRoot = getEditorRootFromNode(
        range.commonAncestorContainer,
        holder,
      );
      if (!editorRoot) return;
      const snapshot = range.cloneRange();
      lastRangeRef.current = snapshot;
      if (!range.collapsed) {
        lastExpandedRangeRef.current = snapshot;
      }
      const selectedBlocksByRange = getSelectedBlocks(
        editorRoot,
        range,
        selection.anchorNode || range.commonAncestorContainer,
      );
      const allBlocks = getEditorBlocks(editorRoot).filter((block) =>
        isAlignableBlock(block, editorRoot),
      );
      const selectedBlocksBySelection = allBlocks.filter((block) => {
        try {
          return selection.containsNode(block, true);
        } catch {
          return false;
        }
      });
      const selectedBlocks =
        selectedBlocksBySelection.length > 0
          ? selectedBlocksBySelection
          : selectedBlocksByRange;

      const startBlock = findClosestBlock(range.startContainer);
      const endBlock = findClosestBlock(range.endContainer);
      const startIndex = startBlock ? allBlocks.indexOf(startBlock) : -1;
      const endIndex = endBlock ? allBlocks.indexOf(endBlock) : -1;

      if (selectedBlocks.length > 0) {
        lastSelectionRootRef.current = editorRoot;
        lastSelectedBlocksRef.current = selectedBlocks;
      }
      if (selectedBlocks.length > 1) {
        lastMultiSelectedBlocksRef.current = selectedBlocks;
      }

      debugEditorLog("selection-change", {
        collapsed: range.collapsed,
        selected_text_length: range.toString().length,
        start_index: startIndex,
        end_index: endIndex,
        by_range_count: selectedBlocksByRange.length,
        by_selection_count: selectedBlocksBySelection.length,
        final_selected_count: selectedBlocks.length,
        final_selected_ids: selectedBlocks.map(
          (block) => block.dataset.id || "",
        ),
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const holder = holderRef.current;
      if (!holder) return;
      const targetNode = event.target instanceof Node ? event.target : null;
      if (!targetNode) return;
      const editorRoot = getEditorRootFromNode(targetNode, holder);
      if (!editorRoot) return;
      const block = findClosestBlock(targetNode);
      if (!block) return;
      if (block.closest<HTMLElement>(".codex-editor") !== editorRoot) return;
      pointerDragStartBlockRef.current = block;
      pointerDragRootRef.current = editorRoot;
      debugEditorLog("pointer-down-block", {
        block_id: block.dataset.id || "",
      });
    };

    const handlePointerUp = (event: MouseEvent) => {
      const holder = holderRef.current;
      const startBlock = pointerDragStartBlockRef.current;
      const startRoot = pointerDragRootRef.current;
      pointerDragStartBlockRef.current = null;
      pointerDragRootRef.current = null;

      if (!holder || !startBlock || !startRoot) return;
      const targetNode = event.target instanceof Node ? event.target : null;
      if (!targetNode) return;
      const endRoot = getEditorRootFromNode(targetNode, holder);
      const endBlock = findClosestBlock(targetNode);
      if (!endRoot || !endBlock) return;
      if (endRoot !== startRoot) return;
      if (endBlock.closest<HTMLElement>(".codex-editor") !== endRoot) return;

      const draggedBlocks = getBlocksBetween(endRoot, startBlock, endBlock);
      if (draggedBlocks.length > 0) {
        lastSelectionRootRef.current = endRoot;
        lastSelectedBlocksRef.current = draggedBlocks;
      }
      if (draggedBlocks.length > 1) {
        lastMultiSelectedBlocksRef.current = draggedBlocks;
      }
      debugEditorLog("pointer-up-block", {
        start_block_id: startBlock.dataset.id || "",
        end_block_id: endBlock.dataset.id || "",
        dragged_count: draggedBlocks.length,
        dragged_ids: draggedBlocks.map((block) => block.dataset.id || ""),
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleSelectionChange);
    document.addEventListener("keyup", handleSelectionChange);
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("mouseup", handlePointerUp, true);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleSelectionChange);
      document.removeEventListener("keyup", handleSelectionChange);
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("mouseup", handlePointerUp, true);
    };
  }, []);

  useEffect(() => {
    if (!holderRef.current || !tools) return;
    let mounted = true;
    const initialData = normalizeIncomingData(data);
    onReadyChangeRef.current?.(false);

    const init = async () => {
      const EditorModule = await import("@editorjs/editorjs");
      const EditorClass = EditorModule.default as unknown as EditorConstructor;
      let instance: EditorInstance | null = null;

      instance = new EditorClass({
        holder: holderRef.current as HTMLDivElement,
        tools,
        data: initialData,
        minHeight: 420,
        autofocus: true,
        onChange: async () => {
          if (!instance) return;
          const saved = (await instance.save()) as EditorJsData;
          const enriched = enrichAlignments(saved, holderRef.current);
          const normalized = normalizeIncomingData(enriched);
          debugEditorLog("editor-on-change", {
            block_count: normalized.blocks.length,
            block_types: normalized.blocks.map((block) => block.type),
          });
          onChangeRef.current(normalized);
          if (!isHistoryOperationRef.current) {
            pushHistory(normalized);
          }
        },
      });

      await instance.isReady;
      if (!mounted) {
        await instance.destroy();
        return;
      }
      editorRef.current = instance;
      setHistoryFromInitial(initialData);
      window.requestAnimationFrame(() => {
        applyAlignmentsFromData(holderRef.current, initialData);
      });
      onReadyChangeRef.current?.(true);
    };

    void init();

    return () => {
      mounted = false;
      onReadyChangeRef.current?.(false);
      if (editorRef.current) {
        void editorRef.current.destroy();
        editorRef.current = null;
      }
      historyRef.current = [];
      historyIndexRef.current = -1;
      lastSerializedRef.current = "";
      lastSelectionRootRef.current = null;
      lastSelectedBlocksRef.current = [];
      lastMultiSelectedBlocksRef.current = [];
      pointerDragStartBlockRef.current = null;
      pointerDragRootRef.current = null;
    };
  }, [documentKey, tools]);

  useImperativeHandle(ref, () => ({
    async insertVariable(token: string, point?: { x: number; y: number }) {
      editorRef.current?.caret.focus();
      if (point) {
        setCaretFromPoint(point.x, point.y);
      }
      let inserted = document.execCommand("insertText", false, token);
      if (!inserted) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(token);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
          inserted = true;
        }
      }

      if (!inserted) {
        editorRef.current?.blocks.insert("paragraph", { text: token });
      }
      const saved = await editorRef.current?.save();
      if (saved) {
        const enriched = enrichAlignments(saved, holderRef.current);
        const normalized = normalizeIncomingData(enriched);
        debugEditorLog("insert-variable-saved", {
          block_count: normalized.blocks.length,
          block_types: normalized.blocks.map((block) => block.type),
        });
        onChangeRef.current(normalized);
        pushHistory(normalized);
      }
    },
    insertImageFromDataUrl(dataUrl: string) {
      editorRef.current?.blocks.insert("resizableImage", {
        url: dataUrl,
        width: 60,
        caption: "",
      });
    },
    async applyAlign(align: AlignValue) {
      const holder = holderRef.current;
      const selection = window.getSelection();
      if (!holder) return false;

      let targetSource = "none";
      let currentRange: Range | null = null;
      let currentRoot: HTMLElement | null = null;
      if (selection && selection.rangeCount > 0) {
        currentRange = selection.getRangeAt(0);
        currentRoot = getEditorRootFromNode(
          currentRange.commonAncestorContainer,
          holder,
        );
      }

      let range: Range | null = null;
      let editorRoot: HTMLElement | null = null;
      let targetBlocks: HTMLElement[] = [];

      if (currentRange && currentRoot) {
        range = currentRange;
        editorRoot = currentRoot;
        targetBlocks = getSelectedBlocks(
          currentRoot,
          currentRange,
          selection?.anchorNode || currentRange.commonAncestorContainer,
        );
        if (targetBlocks.length > 0) {
          targetSource = "current-range";
        }
      }

      if (
        currentRange &&
        currentRoot &&
        currentRange.collapsed &&
        lastExpandedRangeRef.current
      ) {
        const expandedRange = lastExpandedRangeRef.current.cloneRange();
        const expandedRoot = getEditorRootFromNode(
          expandedRange.commonAncestorContainer,
          holder,
        );
        if (expandedRoot && expandedRoot === currentRoot) {
          const expandedTargets = getSelectedBlocks(
            expandedRoot,
            expandedRange,
            selection?.anchorNode || expandedRange.commonAncestorContainer,
          );
          if (expandedTargets.length > 0) {
            range = expandedRange;
            editorRoot = expandedRoot;
            targetBlocks = expandedTargets;
            targetSource = "expanded-range-from-collapsed";
          }
        }
      }

      if (lastExpandedRangeRef.current) {
        const expandedRange = lastExpandedRangeRef.current.cloneRange();
        const expandedRoot = getEditorRootFromNode(
          expandedRange.commonAncestorContainer,
          holder,
        );
        if (expandedRoot && (!editorRoot || expandedRoot === editorRoot)) {
          const expandedTargets = getSelectedBlocks(
            expandedRoot,
            expandedRange,
            selection?.anchorNode || expandedRange.commonAncestorContainer,
          );
          if (
            expandedTargets.length > targetBlocks.length ||
            (!range && expandedTargets.length > 0)
          ) {
            range = expandedRange;
            editorRoot = expandedRoot;
            targetBlocks = expandedTargets;
            targetSource = "last-expanded-range";
          }
        }
      }

      if (!range && lastRangeRef.current) {
        const snapshot = lastRangeRef.current.cloneRange();
        const snapshotRoot = getEditorRootFromNode(
          snapshot.commonAncestorContainer,
          holder,
        );
        if (snapshotRoot) {
          const snapshotTargets = getSelectedBlocks(
            snapshotRoot,
            snapshot,
            snapshot.commonAncestorContainer,
          );
          if (snapshotTargets.length > 0) {
            range = snapshot;
            editorRoot = snapshotRoot;
            targetBlocks = snapshotTargets;
            targetSource = "last-range-snapshot";
          }
        }
      }

      if (!range && lastExpandedRangeRef.current) {
        const snapshot = lastExpandedRangeRef.current.cloneRange();
        const snapshotRoot = getEditorRootFromNode(
          snapshot.commonAncestorContainer,
          holder,
        );
        if (snapshotRoot) {
          const snapshotTargets = getSelectedBlocks(
            snapshotRoot,
            snapshot,
            snapshot.commonAncestorContainer,
          );
          if (snapshotTargets.length > 0) {
            range = snapshot;
            editorRoot = snapshotRoot;
            targetBlocks = snapshotTargets;
            targetSource = "last-expanded-snapshot";
          }
        }
      }

      if (!editorRoot) {
        const rememberedRoot = lastSelectionRootRef.current;
        if (rememberedRoot && holder.contains(rememberedRoot)) {
          editorRoot = rememberedRoot;
          targetSource = "remembered-root";
        }
      }
      if (!editorRoot) return false;

      const rememberedSelectionBlocks = lastSelectedBlocksRef.current.filter(
        (block) =>
          block.isConnected &&
          editorRoot?.contains(block) &&
          isAlignableBlock(block, editorRoot),
      );
      const rememberedMultiBlocks = lastMultiSelectedBlocksRef.current.filter(
        (block) =>
          block.isConnected &&
          editorRoot?.contains(block) &&
          isAlignableBlock(block, editorRoot),
      );

      if (targetBlocks.length <= 1 && rememberedSelectionBlocks.length > 1) {
        targetBlocks = rememberedSelectionBlocks;
        targetSource = "remembered-selection-blocks";
      }
      if (targetBlocks.length <= 1) {
        if (rememberedMultiBlocks.length > 1) {
          targetBlocks = rememberedMultiBlocks;
          targetSource = "remembered-multi-blocks";
        }
      }

      if (targetBlocks.length === 0 && range) {
        targetBlocks = getSelectedBlocks(
          editorRoot,
          range,
          selection?.anchorNode || range.commonAncestorContainer,
        );
        if (targetBlocks.length > 0) {
          targetSource = "recomputed-from-range";
        }
      }
      if (targetBlocks.length === 0) {
        if (rememberedSelectionBlocks.length > 0) {
          targetBlocks = rememberedSelectionBlocks;
          targetSource = "remembered-selection-fallback";
        }
      }
      if (targetBlocks.length === 0) {
        debugEditorLog("apply-align-empty-target", {
          align,
          target_source: targetSource,
          has_current_range: Boolean(currentRange),
          current_collapsed: currentRange?.collapsed ?? null,
          has_last_range: Boolean(lastRangeRef.current),
          has_last_expanded_range: Boolean(lastExpandedRangeRef.current),
          remembered_blocks_count: rememberedSelectionBlocks.length,
          remembered_multi_blocks_count: rememberedMultiBlocks.length,
          selection_range_count: selection?.rangeCount ?? 0,
        });
        return false;
      }

      debugEditorLog("apply-align-target", {
        align,
        target_source: targetSource,
        target_count: targetBlocks.length,
        target_ids: targetBlocks.map((block) => block.dataset.id || ""),
        has_current_range: Boolean(currentRange),
        current_collapsed: currentRange?.collapsed ?? null,
        has_last_range: Boolean(lastRangeRef.current),
        has_last_expanded_range: Boolean(lastExpandedRangeRef.current),
        remembered_blocks_count: rememberedSelectionBlocks.length,
        remembered_multi_blocks_count: rememberedMultiBlocks.length,
      });

      targetBlocks.forEach((block) =>
        applyAlignToBlock(block, editorRoot as HTMLElement, align),
      );
      lastSelectionRootRef.current = editorRoot;
      lastSelectedBlocksRef.current = targetBlocks;
      if (targetBlocks.length > 1) {
        lastMultiSelectedBlocksRef.current = targetBlocks;
      }

      const saved = await editorRef.current?.save();
      if (saved) {
        const enriched = enrichAlignments(saved, holderRef.current);
        const normalized = normalizeIncomingData(enriched);
        onChangeRef.current(normalized);
        pushHistory(normalized);
        debugEditorLog("apply-align-saved", {
          align,
          target_source: targetSource,
          block_count: normalized.blocks.length,
        });
      }
      return true;
    },
    undo() {
      const nextIndex = historyIndexRef.current - 1;
      if (nextIndex < 0) return false;
      void applyHistoryAt(nextIndex);
      return true;
    },
    redo() {
      const nextIndex = historyIndexRef.current + 1;
      if (nextIndex >= historyRef.current.length) return false;
      void applyHistoryAt(nextIndex);
      return true;
    },
    async save() {
      if (!editorRef.current) return null;
      const saved = (await editorRef.current.save()) as EditorJsData;
      const enriched = enrichAlignments(saved, holderRef.current);
      const normalized = normalizeIncomingData(enriched);
      debugEditorLog("manual-save", {
        block_count: normalized.blocks.length,
        block_types: normalized.blocks.map((block) => block.type),
      });
      onChangeRef.current(normalized);
      if (!isHistoryOperationRef.current) {
        pushHistory(normalized);
      }
      return normalized;
    },
    focus() {
      editorRef.current?.caret.focus();
    },
  }));

  return <div ref={holderRef} className="ft-editor min-h-[450px]" />;
});

TemplateEditor.displayName = "TemplateEditor";
