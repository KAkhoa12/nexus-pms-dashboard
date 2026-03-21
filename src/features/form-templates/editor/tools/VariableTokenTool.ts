import type { VariableTokenBlockData } from "@/features/form-templates/editor/types";

type VariableTokenToolArgs = {
  data?: VariableTokenBlockData;
  readOnly: boolean;
};

export default class VariableTokenTool {
  private data: VariableTokenBlockData;
  private readonly readOnly: boolean;

  static get toolbox() {
    return {
      title: "Biến dữ liệu",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M8 5c-3 2-4 5-4 7s1 5 4 7"/>
        <path d="M16 5c3 2 4 5 4 7s-1 5-4 7"/>
        <path d="M10 9h4M10 12h4M10 15h4"/>
      </svg>`,
    };
  }

  constructor({ data, readOnly }: VariableTokenToolArgs) {
    this.readOnly = readOnly;
    this.data = {
      token: data?.token || "{{variable}}",
      label: data?.label || "Biến dữ liệu",
    };
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "ft-variable-tool";

    const badge = document.createElement("span");
    badge.className = "ft-variable-tool__badge";
    badge.textContent = this.data.label || "Biến dữ liệu";

    const token = document.createElement("code");
    token.className = "ft-variable-tool__token";
    token.textContent = this.data.token;

    wrapper.appendChild(badge);
    wrapper.appendChild(token);

    if (!this.readOnly) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "ft-variable-tool__button";
      action.textContent = "Sửa token";
      action.addEventListener("click", () => {
        const nextToken = window.prompt("Nhập token biến", this.data.token);
        if (!nextToken) return;
        this.data.token = nextToken.trim();
        token.textContent = this.data.token;
      });
      wrapper.appendChild(action);
    }

    return wrapper;
  }

  save(): VariableTokenBlockData {
    return this.data;
  }

  validate(savedData: VariableTokenBlockData): boolean {
    return Boolean(savedData?.token?.trim());
  }
}
