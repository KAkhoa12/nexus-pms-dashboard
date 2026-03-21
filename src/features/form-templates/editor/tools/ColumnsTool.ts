import EditorJS from "@editorjs/editorjs";
import type { EditorJsBlock } from "@/features/form-templates/editor/types";

type ColumnData = {
  id: string;
  span: number;
  blocks: EditorJsBlock[];
};

type ColumnsToolData = {
  columns: ColumnData[];
};

type ColumnsToolArgs = {
  data?: ColumnsToolData;
  config?: {
    tools?: Record<string, unknown>;
  };
  readOnly: boolean;
};

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `col_${Math.random().toString(36).slice(2, 10)}`;
}

function clampSpan(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 1) return 1;
  if (value > 12) return 12;
  return Math.floor(value);
}

export default class ColumnsTool {
  private readonly readOnly: boolean;
  private readonly tools: Record<string, unknown>;
  private data: ColumnsToolData;
  private wrapper?: HTMLElement;
  private editors: Map<string, any> = new Map();

  static get toolbox() {
    return {
      title: "12 Cột",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="16" rx="2"/>
        <path d="M9 4v16M15 4v16"/>
      </svg>`,
    };
  }

  constructor({ data, config, readOnly }: ColumnsToolArgs) {
    this.readOnly = readOnly;
    this.tools = config?.tools || {};

    this.data = {
      columns:
        data?.columns && data.columns.length > 0
          ? data.columns
          : [
              { id: createId(), span: 6, blocks: [] },
              { id: createId(), span: 6, blocks: [] },
            ],
    };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "ft-columns";
    this.renderColumns();
    return this.wrapper;
  }

  private renderColumns() {
    if (!this.wrapper) return;
    this.destroyEditors();
    this.wrapper.innerHTML = "";

    const row = document.createElement("div");
    row.className = "ft-columns__row";

    this.data.columns.forEach((columnData) => {
      const columnBox = document.createElement("div");
      columnBox.className = "ft-columns__item";
      columnBox.style.flex = `0 0 ${(clampSpan(columnData.span) / 12) * 100}%`;
      columnBox.style.maxWidth = `${(clampSpan(columnData.span) / 12) * 100}%`;

      const holder = document.createElement("div");
      columnBox.appendChild(holder);
      row.appendChild(columnBox);

      const editor = new EditorJS({
        holder,
        readOnly: this.readOnly,
        tools: this.tools,
        data: { blocks: columnData.blocks || [] },
        minHeight: 48,
        onChange: async () => {
          const saved = await editor.save();
          columnData.blocks = (saved.blocks || []) as EditorJsBlock[];
        },
      });
      this.editors.set(columnData.id, editor);
    });

    this.wrapper.appendChild(row);

    if (!this.readOnly) {
      const configButton = document.createElement("button");
      configButton.type = "button";
      configButton.className = "ft-columns__config-btn";
      configButton.textContent = "Cấu hình cột (Tổng = 12)";
      configButton.addEventListener("click", () => this.renderConfigPanel());
      this.wrapper.appendChild(configButton);
    }
  }

  private renderConfigPanel() {
    if (!this.wrapper) return;
    this.destroyEditors();
    this.wrapper.innerHTML = "";

    const panel = document.createElement("div");
    panel.className = "ft-columns__config";

    const title = document.createElement("p");
    title.className = "ft-columns__config-title";
    title.textContent = "Nhập span cho từng cột (1-12), tổng phải bằng 12.";
    panel.appendChild(title);

    this.data.columns.forEach((columnData, index) => {
      const row = document.createElement("div");
      row.className = "ft-columns__config-row";

      const label = document.createElement("label");
      label.textContent = `Cột ${index + 1}`;

      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "12";
      input.value = String(clampSpan(columnData.span));
      input.dataset.colId = columnData.id;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Xóa";
      removeButton.addEventListener("click", () => {
        if (this.data.columns.length <= 1) return;
        this.data.columns = this.data.columns.filter(
          (c) => c.id !== columnData.id,
        );
        this.renderConfigPanel();
      });

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(removeButton);
      panel.appendChild(row);
    });

    const actionRow = document.createElement("div");
    actionRow.className = "ft-columns__config-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Thêm cột";
    addButton.addEventListener("click", () => {
      this.data.columns.push({ id: createId(), span: 1, blocks: [] });
      this.renderConfigPanel();
    });

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.textContent = "Áp dụng";
    applyButton.addEventListener("click", () => {
      const inputs = Array.from(
        panel.querySelectorAll<HTMLInputElement>("input[data-col-id]"),
      );
      let total = 0;
      inputs.forEach((input) => {
        const colId = input.dataset.colId || "";
        const target = this.data.columns.find((item) => item.id === colId);
        if (!target) return;
        target.span = clampSpan(Number(input.value));
        total += target.span;
      });

      if (total !== 12) {
        window.alert("Tổng số cột phải bằng 12.");
        return;
      }
      this.renderColumns();
    });

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Hủy";
    cancelButton.addEventListener("click", () => this.renderColumns());

    actionRow.appendChild(addButton);
    actionRow.appendChild(cancelButton);
    actionRow.appendChild(applyButton);
    panel.appendChild(actionRow);

    this.wrapper.appendChild(panel);
  }

  private destroyEditors() {
    this.editors.forEach((editor) => {
      void editor.destroy();
    });
    this.editors.clear();
  }

  save(): ColumnsToolData {
    return this.data;
  }

  validate(savedData: ColumnsToolData): boolean {
    if (!savedData?.columns?.length) return false;
    const total = savedData.columns.reduce(
      (sum, columnData) => sum + clampSpan(columnData.span),
      0,
    );
    return total === 12;
  }

  destroy() {
    this.destroyEditors();
  }
}
