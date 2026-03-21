import type { ResizableImageBlockData } from "@/features/form-templates/editor/types";

type ResizableImageToolArgs = {
  data?: ResizableImageBlockData;
  readOnly: boolean;
};

const DEFAULT_WIDTH = 60;
const MIN_WIDTH = 20;
const MAX_WIDTH = 100;

function clampWidth(value: number | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_WIDTH;
  if (value < MIN_WIDTH) return MIN_WIDTH;
  if (value > MAX_WIDTH) return MAX_WIDTH;
  return value;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });
}

export default class ResizableImageTool {
  private data: ResizableImageBlockData;
  private readonly readOnly: boolean;

  static get toolbox() {
    return {
      title: "Ảnh co giãn",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="5" width="18" height="14" rx="2" ry="2"/>
        <circle cx="9" cy="10" r="1.5"/>
        <path d="M21 16l-5-4-4 3-2-1.5L3 19"/>
      </svg>`,
    };
  }

  constructor({ data, readOnly }: ResizableImageToolArgs) {
    this.readOnly = readOnly;
    this.data = {
      url: data?.url || "",
      caption: data?.caption || "",
      width: clampWidth(data?.width),
    };
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "ft-image-tool";

    const img = document.createElement("img");
    img.className = "ft-image-tool__image";
    img.alt = this.data.caption || "image";

    const caption = document.createElement("p");
    caption.className = "ft-image-tool__caption";

    const renderView = () => {
      if (!this.data.url) {
        wrapper.innerHTML = `<div class="ft-image-tool__empty">Kéo thả ảnh vào editor hoặc dùng nút chọn ảnh.</div>`;
        return;
      }

      wrapper.innerHTML = "";
      img.src = this.data.url;
      img.style.width = `${clampWidth(this.data.width)}%`;
      wrapper.appendChild(img);

      if (this.data.caption) {
        caption.textContent = this.data.caption;
        wrapper.appendChild(caption);
      }
    };

    renderView();

    if (!this.readOnly) {
      const controls = document.createElement("div");
      controls.className = "ft-image-tool__controls";

      const widthLabel = document.createElement("label");
      widthLabel.textContent = "Độ rộng ảnh";

      const widthRange = document.createElement("input");
      widthRange.type = "range";
      widthRange.min = String(MIN_WIDTH);
      widthRange.max = String(MAX_WIDTH);
      widthRange.step = "1";
      widthRange.value = String(clampWidth(this.data.width));
      widthRange.addEventListener("input", () => {
        this.data.width = clampWidth(Number(widthRange.value));
        img.style.width = `${this.data.width}%`;
      });

      const captionInput = document.createElement("input");
      captionInput.type = "text";
      captionInput.placeholder = "Chú thích ảnh";
      captionInput.value = this.data.caption || "";
      captionInput.addEventListener("input", () => {
        this.data.caption = captionInput.value;
        renderView();
      });

      const actions = document.createElement("div");
      actions.className = "ft-image-tool__actions";

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        this.data.url = await fileToDataUrl(file);
        renderView();
      });

      const uploadButton = document.createElement("button");
      uploadButton.type = "button";
      uploadButton.textContent = "Chọn ảnh";
      uploadButton.addEventListener("click", () => fileInput.click());

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "Xóa ảnh";
      removeButton.addEventListener("click", () => {
        this.data.url = "";
        renderView();
      });

      actions.appendChild(uploadButton);
      actions.appendChild(removeButton);

      controls.appendChild(widthLabel);
      controls.appendChild(widthRange);
      controls.appendChild(captionInput);
      controls.appendChild(actions);
      controls.appendChild(fileInput);

      wrapper.appendChild(controls);
    }

    return wrapper;
  }

  save(): ResizableImageBlockData {
    return {
      url: this.data.url,
      caption: this.data.caption || "",
      width: clampWidth(this.data.width),
    };
  }

  validate(savedData: ResizableImageBlockData): boolean {
    return Boolean(savedData?.url?.trim());
  }
}
