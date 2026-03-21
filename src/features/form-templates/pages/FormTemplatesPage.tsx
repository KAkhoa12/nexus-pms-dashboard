import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Copy,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formTemplatesApi } from "@/features/form-templates/api/form-templates.api";
import {
  DEFAULT_SETTINGS,
  EMPTY_EDITOR_DATA,
  PAGE_DIMENSIONS,
} from "@/features/form-templates/editor/constants";
import { TemplateEditor } from "@/features/form-templates/editor/TemplateEditor";
import type { TemplateEditorHandle } from "@/features/form-templates/editor/TemplateEditor";
import { TemplatePreview } from "@/features/form-templates/editor/TemplatePreview";
import type {
  EditorJsData,
  TemplateConfigJson,
} from "@/features/form-templates/editor/types";
import type {
  FormTemplate,
  TemplateSettings,
} from "@/features/form-templates/types";
import type { PaginationMeta } from "@/features/auth/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
    reader.readAsDataURL(file);
  });
}

function cloneEditorData(data: EditorJsData): EditorJsData {
  return {
    time: data.time,
    version: data.version,
    blocks: data.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      data: { ...block.data },
    })),
  };
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isEditorJsData(value: unknown): value is EditorJsData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const blocks = (value as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks)) return false;
  return blocks.every(
    (block) =>
      block &&
      typeof block === "object" &&
      !Array.isArray(block) &&
      typeof (block as { type?: unknown }).type === "string" &&
      (block as { data?: unknown }).data &&
      typeof (block as { data?: unknown }).data === "object" &&
      !Array.isArray((block as { data?: unknown }).data),
  );
}

function parseSettingsFromRecord(
  value: unknown,
  fallback: TemplateSettings,
): TemplateSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const settings = value as Partial<TemplateSettings>;
  return {
    pageSize:
      settings.pageSize === "A3" || settings.pageSize === "A4"
        ? settings.pageSize
        : fallback.pageSize,
    orientation:
      settings.orientation === "landscape" ||
      settings.orientation === "portrait"
        ? settings.orientation
        : fallback.orientation,
    fontFamily:
      typeof settings.fontFamily === "string" && settings.fontFamily.trim()
        ? settings.fontFamily
        : fallback.fontFamily,
    fontSize:
      typeof settings.fontSize === "number" &&
      settings.fontSize >= 8 &&
      settings.fontSize <= 72
        ? settings.fontSize
        : fallback.fontSize,
    textColor:
      typeof settings.textColor === "string" && settings.textColor.trim()
        ? settings.textColor
        : fallback.textColor,
    showGrid:
      typeof settings.showGrid === "boolean"
        ? settings.showGrid
        : fallback.showGrid,
  };
}

function parseTemplateSettings(template: FormTemplate): TemplateSettings {
  const fallback: TemplateSettings = {
    pageSize: template.page_size === "A3" ? "A3" : "A4",
    orientation:
      template.orientation === "landscape" ? "landscape" : "portrait",
    fontFamily: template.font_family || DEFAULT_SETTINGS.fontFamily,
    fontSize: template.font_size || DEFAULT_SETTINGS.fontSize,
    textColor: template.text_color || DEFAULT_SETTINGS.textColor,
    showGrid: false,
  };
  const parsedConfig = parseJsonObject(template.config_json);
  if (!parsedConfig) return fallback;
  return parseSettingsFromRecord(parsedConfig.settings, fallback);
}

function parseTemplateEditorData(template: FormTemplate): EditorJsData {
  const parsedConfig = parseJsonObject(template.config_json);
  const configEditorData = parsedConfig?.editor_data;
  if (isEditorJsData(configEditorData)) {
    return cloneEditorData(configEditorData);
  }

  const parsedContent = parseJsonObject(template.content_html);
  if (isEditorJsData(parsedContent)) {
    return cloneEditorData(parsedContent);
  }

  if (template.content_html.trim()) {
    return {
      blocks: [
        {
          type: "rich_text",
          data: { html: template.content_html },
        },
      ],
    };
  }

  return cloneEditorData(EMPTY_EDITOR_DATA);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type ListItemNode =
  | string
  | {
      content?: string;
      items?: ListItemNode[];
    };

function listItemsToHtml(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return (items as ListItemNode[])
    .map((item) => {
      if (typeof item === "string") {
        return `<li>${item}</li>`;
      }
      const content = typeof item.content === "string" ? item.content : "";
      const nested =
        item.items && item.items.length > 0
          ? `<ul>${listItemsToHtml(item.items)}</ul>`
          : "";
      return `<li>${content}${nested}</li>`;
    })
    .join("");
}

function buildAlignStyle(alignRaw: unknown): string {
  const align =
    alignRaw === "left" ||
    alignRaw === "center" ||
    alignRaw === "right" ||
    alignRaw === "justify"
      ? alignRaw
      : "";
  if (!align) return "";
  return ` style="text-align:${align};"`;
}

function editorDataToHtml(data: EditorJsData): string {
  return data.blocks
    .map((block) => {
      if (block.type === "rich_text") {
        return String((block.data.html as string | undefined) || "");
      }
      if (block.type === "header") {
        const level = Number(block.data.level || 2);
        const tag = `h${Math.min(6, Math.max(1, level))}`;
        return `<${tag}${buildAlignStyle(block.data.align)}>${String(block.data.text || "")}</${tag}>`;
      }
      if (block.type === "paragraph") {
        return `<p${buildAlignStyle(block.data.align)}>${String(block.data.text || "")}</p>`;
      }
      if (block.type === "list") {
        const style = String(block.data.style || "unordered");
        const tag = style === "ordered" ? "ol" : "ul";
        return `<${tag}${buildAlignStyle(block.data.align)}>${listItemsToHtml(block.data.items)}</${tag}>`;
      }
      if (block.type === "table") {
        const rawRows = (block.data as { content?: unknown }).content;
        const rows = Array.isArray(rawRows) ? (rawRows as unknown[]) : [];
        if (rows.length === 0) return "";
        const withHeadings = Boolean(
          (block.data as { withHeadings?: unknown }).withHeadings,
        );
        const toCells = (row: unknown) =>
          Array.isArray(row)
            ? row
                .map(
                  (cell) =>
                    `<td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;">${String(cell ?? "")}</td>`,
                )
                .join("")
            : "";
        if (withHeadings) {
          const [head, ...body] = rows;
          const headCells = Array.isArray(head)
            ? head
                .map(
                  (cell) =>
                    `<th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;background:#f8fafc;">${String(cell ?? "")}</th>`,
                )
                .join("")
            : "";
          const bodyRows = body
            .map((row) => `<tr>${toCells(row)}</tr>`)
            .join("");
          return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        }
        const bodyRows = rows.map((row) => `<tr>${toCells(row)}</tr>`).join("");
        return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><tbody>${bodyRows}</tbody></table>`;
      }
      if (block.type === "delimiter") {
        return "<hr />";
      }
      if (block.type === "variableToken") {
        const token = String(block.data.token || "");
        return `<span data-template-variable="${escapeHtml(token)}">${escapeHtml(token)}</span>`;
      }
      if (block.type === "resizableImage") {
        const url = String(block.data.url || "");
        if (!url) return "";
        const width = Number(block.data.width || 60);
        const caption = String(block.data.caption || "");
        return `
          <figure>
            <img src="${escapeHtml(url)}" alt="${escapeHtml(caption || "image")}" style="width:${Math.min(100, Math.max(20, width))}%;" />
            ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
          </figure>
        `;
      }
      if (block.type === "simpleImage") {
        const url = String(block.data.url || "");
        if (!url) return "";
        const caption = String(block.data.caption || "");
        return `
          <figure>
            <img src="${escapeHtml(url)}" alt="${escapeHtml(caption || "image")}" />
            ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
          </figure>
        `;
      }
      if (block.type === "columns") {
        const columnsRaw = block.data.columns as
          | Array<{ span?: number; blocks?: EditorJsData["blocks"] }>
          | undefined;
        if (!Array.isArray(columnsRaw) || columnsRaw.length === 0) return "";
        const columnsHtml = columnsRaw
          .map((columnData) => {
            const span = Math.min(
              12,
              Math.max(1, Number(columnData.span || 1)),
            );
            const width = (span / 12) * 100;
            const nestedData: EditorJsData = {
              blocks: Array.isArray(columnData.blocks) ? columnData.blocks : [],
            };
            return `
              <div style="flex:0 0 ${width}%;max-width:${width}%;">
                ${editorDataToHtml(nestedData)}
              </div>
            `;
          })
          .join("");
        return `<div style="display:flex;gap:12px;">${columnsHtml}</div>`;
      }
      return "";
    })
    .join("\n");
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function translateTemplateType(value: string): string {
  if (value === "INVOICE") return "Hóa đơn";
  if (value === "CONTRACT") return "Hợp đồng";
  if (value === "GENERAL") return "Biểu mẫu chung";
  return value;
}

export function FormTemplatesPage() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();
  const isNewRoute = useMatch("/dashboard/settings/forms/new") !== null;
  const isEditRoute =
    useMatch("/dashboard/settings/forms/:templateId/edit") !== null;
  const isDetailRoute = isNewRoute || isEditRoute;
  const routeTemplateId = templateId ? Number(templateId) : null;

  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 20,
    total_items: 0,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deletedMode, setDeletedMode] = useState<"active" | "trash" | "all">(
    "active",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [templateName, setTemplateName] = useState("Mẫu hóa đơn mới");
  const [templateType, setTemplateType] = useState("INVOICE");
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [editorData, setEditorData] = useState<EditorJsData>(
    cloneEditorData(EMPTY_EDITOR_DATA),
  );
  const [detailMode, setDetailMode] = useState<"edit" | "view">("edit");
  const [editorDocumentKey, setEditorDocumentKey] = useState("new-template");
  const [editorReady, setEditorReady] = useState(false);
  const [estimatedPages, setEstimatedPages] = useState(1);
  const [editorScale, setEditorScale] = useState(1);

  const editorRef = useRef<TemplateEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const previewMeasureRef = useRef<HTMLDivElement | null>(null);

  const pageDims = useMemo(
    () => PAGE_DIMENSIONS[settings.pageSize][settings.orientation],
    [settings.pageSize, settings.orientation],
  );

  const pageBoxStyle = useMemo(
    () =>
      ({
        width: `${pageDims.width}px`,
        minHeight: `${pageDims.height}px`,
        color: settings.textColor,
        fontFamily: settings.fontFamily,
        fontSize: `${settings.fontSize}px`,
      }) as const,
    [
      pageDims.height,
      pageDims.width,
      settings.fontFamily,
      settings.fontSize,
      settings.textColor,
    ],
  );

  useEffect(() => {
    void loadTemplates();
  }, [page, pageSize, deletedMode, search]);

  useEffect(() => {
    if (!isDetailRoute || detailMode !== "edit") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveTemplate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    isDetailRoute,
    detailMode,
    templateName,
    templateType,
    settings,
    editorData,
    selectedTemplateId,
  ]);

  useEffect(() => {
    if (!isDetailRoute) return;
    const fallbackPages = Math.max(
      1,
      Math.ceil(editorDataToHtml(editorData).length / 3200),
    );
    const pageHeight = Math.max(360, pageDims.height - 96);
    const frame = window.requestAnimationFrame(() => {
      const measuredHeight = previewMeasureRef.current?.scrollHeight ?? 0;
      if (detailMode === "view" && measuredHeight > 0) {
        setEstimatedPages(Math.max(1, Math.ceil(measuredHeight / pageHeight)));
        return;
      }
      setEstimatedPages(fallbackPages);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDetailRoute, detailMode, editorData, pageDims.height]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await formTemplatesApi.list({
        mode: deletedMode,
        page,
        itemsPerPage: pageSize,
        searchKey: search.trim() || undefined,
      });
      setTemplates(data.items);
      setPagination(data.pagination);
      if (
        data.pagination.total_pages > 0 &&
        page > data.pagination.total_pages
      ) {
        setPage(data.pagination.total_pages);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách biểu mẫu."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isNewRoute) {
      setSelectedTemplateId(null);
      setTemplateName("Mẫu hóa đơn mới");
      setTemplateType("INVOICE");
      setSettings(DEFAULT_SETTINGS);
      setEditorData(cloneEditorData(EMPTY_EDITOR_DATA));
      setEditorDocumentKey(`new-${Date.now()}`);
      setDetailMode("edit");
      setEditorScale(1);
      return;
    }

    if (isEditRoute && routeTemplateId && Number.isFinite(routeTemplateId)) {
      if (selectedTemplateId === routeTemplateId) return;
      setDetailLoading(true);
      void formTemplatesApi
        .get(routeTemplateId)
        .then((template) => {
          loadTemplateToEditor(template);
        })
        .catch((error) => {
          toast.error(
            getErrorMessage(error, "Không thể tải chi tiết biểu mẫu."),
          );
          navigate("/dashboard/settings/forms", { replace: true });
        })
        .finally(() => setDetailLoading(false));
      return;
    }

    if (!isDetailRoute) {
      setDetailLoading(false);
    }
  }, [
    isNewRoute,
    isEditRoute,
    isDetailRoute,
    routeTemplateId,
    selectedTemplateId,
    navigate,
  ]);

  function createConfigJson(data: EditorJsData) {
    const payload: TemplateConfigJson = {
      version: 2,
      settings,
      variables: [],
      shortcuts: {
        save: "Ctrl/Cmd + S",
        copy: "Ctrl/Cmd + C",
        paste: "Ctrl/Cmd + V",
      },
      editor_data: data,
      updated_at: new Date().toISOString(),
    };
    return JSON.stringify(payload, null, 2);
  }

  function loadTemplateToEditor(template: FormTemplate) {
    setSelectedTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateType(template.template_type);
    setSettings(parseTemplateSettings(template));
    setEditorData(parseTemplateEditorData(template));
    setEditorDocumentKey(`template-${template.id}-${template.updated_at}`);
    setDetailMode("edit");
    setEditorScale(1);
  }

  function openNewTemplate() {
    navigate("/dashboard/settings/forms/new");
  }

  function backToList() {
    navigate("/dashboard/settings/forms");
  }

  function goToEditTemplate(templateIdValue: number) {
    navigate(`/dashboard/settings/forms/${templateIdValue}/edit`);
  }

  function zoomOutEditor() {
    setEditorScale((prev) => Math.max(0.8, Math.round((prev - 0.1) * 10) / 10));
  }

  function zoomInEditor() {
    setEditorScale((prev) => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10));
  }

  async function applyAlignCommand(command: string) {
    if (detailMode !== "edit" || !editorReady) return;
    const align =
      command === "justifyLeft"
        ? "left"
        : command === "justifyCenter"
          ? "center"
          : command === "justifyRight"
            ? "right"
            : command === "justifyFull"
              ? "justify"
              : null;
    if (!align) return;
    const applied = await editorRef.current?.applyAlign(align);
    if (applied === false) {
      toast.error("Không thể áp dụng canh lề cho vùng đang chọn.");
    }
  }

  function handleUndoEditor() {
    if (detailMode !== "edit" || !editorReady) return;
    editorRef.current?.undo();
  }

  function handleRedoEditor() {
    if (detailMode !== "edit" || !editorReady) return;
    editorRef.current?.redo();
  }

  function insertImage(dataUrl: string) {
    if (detailMode !== "edit" || !editorReady) return;
    editorRef.current?.insertImageFromDataUrl(dataUrl);
    editorRef.current?.focus();
  }

  async function handleEditorDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (detailMode !== "edit" || !editorReady) return;

    const imageFile = Array.from(event.dataTransfer.files).find((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFile) {
      try {
        const dataUrl = await fileToDataUrl(imageFile);
        insertImage(dataUrl);
      } catch (error) {
        toast.error(getErrorMessage(error, "Không thể thêm ảnh vào template."));
      }
      return;
    }
  }

  async function handleUploadImageFromInput(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      insertImage(dataUrl);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm ảnh vào template."));
    } finally {
      event.target.value = "";
    }
  }

  async function getLatestEditorData(): Promise<EditorJsData> {
    const latest = await editorRef.current?.save();
    return latest || editorData;
  }

  async function saveTemplate() {
    try {
      if (!templateName.trim()) {
        toast.error("Vui lòng nhập tên biểu mẫu.");
        return;
      }
      setSaving(true);
      const latestEditorData = await getLatestEditorData();
      const payload = {
        name: templateName.trim(),
        template_type: templateType,
        page_size: settings.pageSize,
        orientation: settings.orientation,
        font_family: settings.fontFamily,
        font_size: settings.fontSize,
        text_color: settings.textColor,
        content_html: editorDataToHtml(latestEditorData),
        config_json: createConfigJson(latestEditorData),
        is_active: true,
      };
      let saved: FormTemplate;
      if (selectedTemplateId) {
        saved = await formTemplatesApi.update(selectedTemplateId, payload);
        toast.success("Cập nhật biểu mẫu thành công.");
      } else {
        saved = await formTemplatesApi.create(payload);
        toast.success("Tạo biểu mẫu thành công.");
        navigate(`/dashboard/settings/forms/${saved.id}/edit`, {
          replace: true,
        });
      }
      setSelectedTemplateId(saved.id);
      setEditorData(latestEditorData);
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu biểu mẫu thất bại."));
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplateFromList(template: FormTemplate) {
    try {
      setSaving(true);
      const payload = {
        name: `${template.name} - Copy`,
        template_type: template.template_type,
        page_size: template.page_size,
        orientation: template.orientation,
        font_family: template.font_family,
        font_size: template.font_size,
        text_color: template.text_color,
        content_html: template.content_html,
        config_json: template.config_json,
        is_active: true,
      };
      await formTemplatesApi.create(payload);
      toast.success("Nhân bản biểu mẫu thành công.");
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, "Nhân bản biểu mẫu thất bại."));
    } finally {
      setSaving(false);
    }
  }

  async function softDeleteTemplate(templateId: number) {
    try {
      await formTemplatesApi.remove(templateId);
      toast.success("Xóa mềm biểu mẫu thành công.");
      if (selectedTemplateId === templateId) {
        navigate("/dashboard/settings/forms", { replace: true });
      }
      await loadTemplates();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa biểu mẫu thất bại."));
    }
  }

  const totalPages = Math.max(1, pagination.total_pages);
  const safePage = Math.min(page, totalPages);

  if (!isDetailRoute) {
    return (
      <section className="space-y-6">
        <h1 className="text-2xl font-semibold">Biểu mẫu hợp đồng/hóa đơn</h1>

        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>Bộ lọc</CardTitle>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Tìm biểu mẫu..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={deletedMode}
                onChange={(event) => {
                  setDeletedMode(
                    event.target.value as "active" | "trash" | "all",
                  );
                  setPage(1);
                }}
              >
                <option value="active">Đang hoạt động</option>
                <option value="trash">Thùng rác</option>
                <option value="all">Tất cả</option>
              </select>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10 / trang</option>
                <option value="20">20 / trang</option>
                <option value="50">50 / trang</option>
              </select>
              <Button onClick={openNewTemplate}>Tạo biểu mẫu</Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách biểu mẫu</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Tên biểu mẫu</th>
                  <th className="px-2 py-2">Loại</th>
                  <th className="px-2 py-2">Khổ giấy</th>
                  <th className="px-2 py-2">Hướng</th>
                  <th className="px-2 py-2">Cập nhật</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    className="cursor-pointer border-b hover:bg-muted/40"
                    onClick={() => goToEditTemplate(template.id)}
                  >
                    <td className="px-2 py-2">{template.id}</td>
                    <td className="px-2 py-2">{template.name}</td>
                    <td className="px-2 py-2">
                      {translateTemplateType(template.template_type)}
                    </td>
                    <td className="px-2 py-2">{template.page_size}</td>
                    <td className="px-2 py-2">
                      {template.orientation === "landscape" ? "Ngang" : "Dọc"}
                    </td>
                    <td className="px-2 py-2">
                      {formatDateTime(template.updated_at)}
                    </td>
                    <td
                      className="px-2 py-2 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            void duplicateTemplateFromList(template)
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => goToEditTemplate(template.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          disabled={deletedMode !== "active"}
                          onClick={() => void softDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && templates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      Không có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Tổng {pagination.total_items} bản ghi
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Trước
                </Button>
                <span className="text-sm">
                  Trang {safePage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                >
                  Sau
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={backToList}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Chi tiết biểu mẫu</h1>
            <p className="text-sm text-muted-foreground">
              Tổng số trang dự kiến: {estimatedPages} • Template:{" "}
              {settings.pageSize} •{" "}
              {settings.orientation === "landscape" ? "Ngang" : "Dọc"}
            </p>
          </div>
        </div>
        {selectedTemplateId ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => void softDeleteTemplate(selectedTemplateId)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa mềm
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin biểu mẫu</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          <Input
            className="md:col-span-2"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Tên biểu mẫu"
            disabled={detailMode === "view"}
          />
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={templateType}
            onChange={(event) => setTemplateType(event.target.value)}
            disabled={detailMode === "view"}
          >
            <option value="INVOICE">Hóa đơn</option>
            <option value="CONTRACT">Hợp đồng</option>
            <option value="GENERAL">Biểu mẫu chung</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.pageSize}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                pageSize: event.target.value as "A3" | "A4",
              }))
            }
            disabled={detailMode === "view"}
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={settings.orientation}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                orientation: event.target.value as "portrait" | "landscape",
              }))
            }
            disabled={detailMode === "view"}
          >
            <option value="portrait">Dọc</option>
            <option value="landscape">Ngang</option>
          </select>
          <div className="flex gap-2 md:col-span-2">
            <Button
              type="button"
              variant={detailMode === "edit" ? "default" : "outline"}
              onClick={() => setDetailMode("edit")}
            >
              Chế độ Edit
            </Button>
            <Button
              type="button"
              variant={detailMode === "view" ? "default" : "outline"}
              onClick={() => setDetailMode("view")}
            >
              Chế độ View
            </Button>
          </div>
          <div className="md:col-span-7 flex gap-2">
            <Button
              type="button"
              onClick={() => void saveTemplate()}
              disabled={saving || detailMode === "view"}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {detailLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Đang tải dữ liệu biểu mẫu...
          </CardContent>
        </Card>
      ) : null}

      {!detailLoading ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-12">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Nội dung template</CardTitle>
              <div className="flex flex-wrap gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={settings.fontFamily}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      fontFamily: event.target.value,
                    }))
                  }
                  disabled={detailMode === "view"}
                >
                  <option value="Arial">Arial</option>
                  <option value="'Times New Roman'">Times New Roman</option>
                  <option value="'Courier New'">Courier New</option>
                  <option value="Tahoma">Tahoma</option>
                </select>
                <Input
                  className="h-9 w-20"
                  type="number"
                  min={8}
                  max={72}
                  value={settings.fontSize}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      fontSize: Number(event.target.value) || 14,
                    }))
                  }
                  disabled={detailMode === "view"}
                />
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      textColor: event.target.value,
                    }))
                  }
                  className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                  disabled={detailMode === "view"}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleUploadImageFromInput(event)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={detailMode === "view" || !editorReady}
                >
                  Chèn ảnh
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleUndoEditor}
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleRedoEditor}
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void applyAlignCommand("justifyLeft")}
                  title="Canh trái"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void applyAlignCommand("justifyCenter")}
                  title="Canh giữa"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void applyAlignCommand("justifyRight")}
                  title="Canh phải"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={detailMode === "view" || !editorReady}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void applyAlignCommand("justifyFull")}
                  title="Canh đều"
                >
                  <AlignJustify className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={zoomOutEditor}
                  title="Thu nhỏ"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm">
                  {Math.round(editorScale * 100)}%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={zoomInEditor}
                  title="Phóng to"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[78vh] overflow-auto rounded-lg border bg-muted/20 p-4">
                <div
                  className="mx-auto"
                  style={{
                    width: `${pageDims.width * editorScale}px`,
                    minHeight: `${pageDims.height * editorScale}px`,
                  }}
                >
                  <div
                    className="bg-white p-8 shadow-sm"
                    style={{
                      ...pageBoxStyle,
                      transform: `scale(${editorScale})`,
                      transformOrigin: "top center",
                    }}
                    onDragOverCapture={(event) => event.preventDefault()}
                    onDropCapture={(event) => void handleEditorDrop(event)}
                  >
                    {detailMode === "edit" ? (
                      <TemplateEditor
                        ref={editorRef}
                        documentKey={editorDocumentKey}
                        data={editorData}
                        onChange={setEditorData}
                        onReadyChange={setEditorReady}
                      />
                    ) : (
                      <div ref={previewMeasureRef}>
                        <TemplatePreview data={editorData} />
                      </div>
                    )}
                    {detailMode === "edit" && !editorReady ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Đang khởi tạo EditorJS...
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
