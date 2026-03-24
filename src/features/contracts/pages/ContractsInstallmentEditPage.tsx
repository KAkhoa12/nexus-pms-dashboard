import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Minus,
  PencilLine,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  contractsApi,
  type LeaseDetail,
  type LeaseInstallment,
} from "@/features/contracts/api/contracts.api";
import { formTemplatesApi } from "@/features/form-templates/api/form-templates.api";
import {
  DEFAULT_SETTINGS,
  EMPTY_EDITOR_DATA,
  PAGE_DIMENSIONS,
} from "@/features/form-templates/editor/constants";
import { TemplateEditor } from "@/features/form-templates/editor/TemplateEditor";
import type { TemplateEditorHandle } from "@/features/form-templates/editor/TemplateEditor";
import type { EditorJsData } from "@/features/form-templates/editor/types";
import type {
  FormTemplate,
  TemplateSettings,
} from "@/features/form-templates/types";
import {
  serviceFeesApi,
  type ServiceFee,
} from "@/features/service-fees/api/service-fees.api";
import { cn } from "@/lib/utils";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorBody = { message?: string };
type EditorMode = "edit" | "view";
type InvoiceTab = "info" | "editor";
type FeeRowSource = "SERVICE_FEE" | "CUSTOM";

type FeeRow = {
  row_key: string;
  source: FeeRowSource;
  service_fee_id: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  note: string;
  evidence_image_urls: string[];
};

type FeeRowFormState = {
  source: FeeRowSource;
  service_fee_id: string;
  description: string;
  quantity: string;
  unit_price: string;
  note: string;
  evidence_image_urls: string[];
};

type InvoiceEditorVariable = {
  label: string;
  token: string;
  value: string;
};

const ACTIVE_WORKSPACE_STORAGE_KEY = "active_workspace_key";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toVnd(value: string | number): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(String(value).replaceAll(",", "").trim() || "0");
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function toQuantityText(value: string | number): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(String(value).replaceAll(",", "").trim() || "0");
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(amount);
}

function statusLabel(status: LeaseInstallment["status"]): string {
  if (status === "PAID") return "Đã thanh toán";
  if (status === "PARTIAL") return "Thanh toán một phần";
  if (status === "OVERDUE") return "Quá hạn";
  return "Chưa thanh toán";
}

function statusOptions(): Array<{
  value: LeaseInstallment["status"];
  label: string;
}> {
  return [
    { value: "UNPAID", label: "Chưa thanh toán" },
    { value: "PARTIAL", label: "Thanh toán một phần" },
    { value: "PAID", label: "Đã thanh toán" },
    { value: "OVERDUE", label: "Quá hạn" },
  ];
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
  const parsed = parseSettingsFromRecord(parsedConfig?.settings, fallback);
  return {
    ...parsed,
    showGrid: false,
  };
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

function parseInstallmentEditorData(contentHtml: string): EditorJsData {
  const parsed = parseJsonObject(contentHtml);
  if (isEditorJsData(parsed)) {
    return cloneEditorData(parsed);
  }
  if (contentHtml.trim()) {
    return {
      blocks: [
        {
          type: "rich_text",
          data: { html: contentHtml },
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

function buildAlignStyle(alignRaw: unknown): string {
  const align =
    alignRaw === "left" ||
    alignRaw === "center" ||
    alignRaw === "right" ||
    alignRaw === "justify"
      ? alignRaw
      : null;
  if (!align) return "";
  return ` style="text-align:${align};"`;
}

function listItemsToHtml(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw
    .map((item) => {
      if (typeof item === "string") return `<li>${item}</li>`;
      const content =
        item && typeof item === "object" && "content" in item
          ? String((item as { content?: string }).content || "")
          : "";
      const nested =
        item && typeof item === "object" && "items" in item
          ? listItemsToHtml((item as { items?: unknown }).items)
          : "";
      return `<li>${content}${nested ? `<ul>${nested}</ul>` : ""}</li>`;
    })
    .join("");
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
        const mappedRows = rows
          .filter((row) => Array.isArray(row))
          .map((row) => row as unknown[]);
        if (mappedRows.length === 0) return "";
        if (withHeadings) {
          const [headerRow, ...bodyRowsRaw] = mappedRows;
          const headCells = headerRow
            .map(
              (cell) =>
                `<th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;background:#f8fafc;">${String(cell ?? "")}</th>`,
            )
            .join("");
          const bodyRows = bodyRowsRaw
            .map(
              (row) =>
                `<tr>${row
                  .map(
                    (cell) =>
                      `<td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;">${String(cell ?? "")}</td>`,
                  )
                  .join("")}</tr>`,
            )
            .join("");
          return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        }
        const bodyRows = mappedRows
          .map(
            (row) =>
              `<tr>${row
                .map(
                  (cell) =>
                    `<td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;">${String(cell ?? "")}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");
        return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><tbody>${bodyRows}</tbody></table>`;
      }
      if (block.type === "delimiter") {
        return "<hr />";
      }
      if (block.type === "image") {
        const file = (block.data.file || {}) as { url?: string };
        const caption = String(block.data.caption || "");
        if (!file.url) return "";
        return `<figure><img src="${escapeHtml(file.url)}" alt="${escapeHtml(caption)}" style="max-width:100%;" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
      }
      if (block.type === "variableToken") {
        const token = String(block.data.token || "");
        return `<strong>${escapeHtml(token)}</strong>`;
      }
      return "";
    })
    .filter(Boolean)
    .join("");
}

function replaceTemplateTokens(
  html: string,
  tokenMap: Record<string, string>,
): string {
  let output = html;
  Object.entries(tokenMap).forEach(([token, value]) => {
    output = output.replaceAll(token, escapeHtml(value));
  });
  return output;
}

function formatDateTimeText(raw: string | null | undefined): string {
  if (!raw) return "-";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("vi-VN");
}

function createEmptyFeeRowForm(
  source: FeeRowSource = "CUSTOM",
): FeeRowFormState {
  return {
    source,
    service_fee_id: "",
    description: "",
    quantity: "1",
    unit_price: "0",
    note: "",
    evidence_image_urls: [],
  };
}

function toNumberInput(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(value);
}

function resolveEvidenceImageUrl(
  rawUrl: string,
  accessToken: string | null,
  workspaceKey: string,
): string {
  const normalized = rawUrl.trim();
  if (!normalized) return normalized;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  const toAbsolute = (relativePath: string) =>
    new URL(relativePath, apiBaseUrl || window.location.origin).toString();
  const encodedObjectName = (value: string) =>
    value
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  const withAuthToken = (urlLike: string) => {
    try {
      const parsed = new URL(urlLike, window.location.origin);
      if (accessToken && !parsed.searchParams.get("token")) {
        parsed.searchParams.set("token", accessToken);
      }
      if (workspaceKey && !parsed.searchParams.get("workspace_key")) {
        parsed.searchParams.set("workspace_key", workspaceKey);
      }
      return parsed.toString();
    } catch {
      return urlLike;
    }
  };

  if (normalized.startsWith("tenant-")) {
    return withAuthToken(
      toAbsolute(`/api/v1/leases/files/${encodedObjectName(normalized)}`),
    );
  }
  try {
    const parsed = new URL(normalized, window.location.origin);
    if (!parsed.pathname.startsWith("/api/v1/leases/files/")) {
      return normalized;
    }
    return withAuthToken(parsed.toString());
  } catch {
    return normalized;
  }
}

export function ContractsInstallmentEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ leaseId?: string; invoiceId?: string }>();
  const leaseId = Number(params.leaseId || "0");
  const invoiceId = Number(params.invoiceId || "0");
  const accessToken = useAuthStore((state) => state.accessToken);
  const preferencesWorkspaceKey = useAuthStore(
    (state) => state.preferences?.workspaceKey,
  );
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<LeaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<InvoiceTab>("info");
  const [installmentStatus, setInstallmentStatus] =
    useState<LeaseInstallment["status"]>("UNPAID");
  const [installmentContent, setInstallmentContent] = useState("");
  const [feeRows, setFeeRows] = useState<FeeRow[]>([]);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState<FeeRowFormState>(
    createEmptyFeeRowForm,
  );
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const evidenceUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [serviceFees, setServiceFees] = useState<ServiceFee[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(
    null,
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [editorData, setEditorData] = useState<EditorJsData>(
    cloneEditorData(EMPTY_EDITOR_DATA),
  );
  const [editorReady, setEditorReady] = useState(false);
  const [editorScale, setEditorScale] = useState(1);
  const [draggingVariableToken, setDraggingVariableToken] = useState<
    string | null
  >(null);
  const [initialEditorLoaded, setInitialEditorLoaded] = useState(false);

  const editorRef = useRef<TemplateEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceKey =
    preferencesWorkspaceKey ||
    storage.get(ACTIVE_WORKSPACE_STORAGE_KEY) ||
    "personal";

  const pageDims = useMemo(
    () => PAGE_DIMENSIONS[settings.pageSize][settings.orientation],
    [settings.pageSize, settings.orientation],
  );

  const pageBoxStyle = useMemo(
    () => ({
      width: `${pageDims.width}px`,
      minHeight: `${pageDims.height}px`,
      color: settings.textColor,
      fontFamily: settings.fontFamily,
      fontSize: `${settings.fontSize}px`,
      lineHeight: 1.6,
      border: "1px solid #e2e8f0",
    }),
    [
      pageDims.height,
      pageDims.width,
      settings.fontFamily,
      settings.fontSize,
      settings.textColor,
    ],
  );

  const installment = useMemo(() => {
    if (!detail) return null;
    return detail.installments.find((item) => item.id === invoiceId) || null;
  }, [detail, invoiceId]);

  const feeRowsTotal = useMemo(() => {
    return feeRows.reduce((sum, row) => {
      const quantity = toFiniteNumber(row.quantity, 0);
      const unitPrice = toFiniteNumber(row.unit_price, 0);
      return sum + quantity * unitPrice;
    }, 0);
  }, [feeRows]);

  const invoiceVariables = useMemo<InvoiceEditorVariable[]>(() => {
    const renterName = detail?.renter?.full_name || "-";
    const renterPhone = detail?.renter?.phone || "-";
    const roomCode = detail?.room?.code || "-";
    const feeSummary =
      feeRows.length > 0
        ? feeRows
            .map((row) => {
              const amount =
                toFiniteNumber(row.quantity, 0) *
                toFiniteNumber(row.unit_price, 0);
              return `${row.description}: ${toQuantityText(row.quantity)} x ${toVnd(row.unit_price)} = ${toVnd(amount)}`;
            })
            .join(" | ")
        : "Không có phí";
    return [
      {
        label: "Tên người dùng đăng nhập",
        token: "{{user.full_name}}",
        value: user?.fullName || "-",
      },
      {
        label: "Email người dùng đăng nhập",
        token: "{{user.email}}",
        value: user?.email || "-",
      },
      {
        label: "Khách thuê",
        token: "{{renter.full_name}}",
        value: renterName,
      },
      {
        label: "SĐT khách thuê",
        token: "{{renter.phone}}",
        value: renterPhone,
      },
      {
        label: "Mã phòng",
        token: "{{room.code}}",
        value: roomCode,
      },
      {
        label: "Mã hợp đồng",
        token: "{{lease.id}}",
        value: detail?.lease?.id ? `#${detail.lease.id}` : "-",
      },
      {
        label: "Mã kỳ hóa đơn",
        token: "{{invoice.id}}",
        value: installment?.id ? `#${installment.id}` : "-",
      },
      {
        label: "Kỳ tháng",
        token: "{{invoice.period_month}}",
        value: installment?.period_month || "-",
      },
      {
        label: "Hạn thanh toán",
        token: "{{invoice.due_date}}",
        value: installment?.due_date
          ? formatDateTimeText(installment.due_date)
          : "-",
      },
      {
        label: "Tổng phí dịch vụ",
        token: "{{invoice.fees_total}}",
        value: toVnd(feeRowsTotal),
      },
      {
        label: "Tổng tiền hóa đơn",
        token: "{{invoice.total_amount}}",
        value: toVnd(feeRowsTotal),
      },
      {
        label: "Trạng thái hóa đơn",
        token: "{{invoice.status}}",
        value: installmentStatus ? statusLabel(installmentStatus) : "-",
      },
      {
        label: "Tóm tắt các dòng phí",
        token: "{{invoice.fees_summary}}",
        value: feeSummary,
      },
    ];
  }, [detail, feeRows, feeRowsTotal, installment, installmentStatus, user]);

  const invoiceTokenMap = useMemo(() => {
    const map: Record<string, string> = {};
    invoiceVariables.forEach((item) => {
      map[item.token] = item.value === "-" ? "" : item.value;
    });
    return map;
  }, [invoiceVariables]);

  const renderedInvoiceHtml = useMemo(() => {
    const html = editorDataToHtml(editorData);
    return replaceTemplateTokens(html, invoiceTokenMap);
  }, [editorData, invoiceTokenMap]);

  const editorDocumentKey = useMemo(
    () =>
      `installment-editor-${leaseId}-${invoiceId}-${selectedTemplateId || "default"}`,
    [invoiceId, leaseId, selectedTemplateId],
  );

  const loadDetail = useCallback(async () => {
    if (!leaseId || Number.isNaN(leaseId)) return;
    setLoading(true);
    try {
      const response = await contractsApi.getDetail(leaseId);
      setDetail(response);
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Không thể tải thông tin kỳ thanh toán của hợp đồng.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  const loadServiceFees = useCallback(async () => {
    try {
      const response = await serviceFeesApi.list({
        mode: "active",
        page: 1,
        itemsPerPage: 200,
      });
      setServiceFees(response.items.filter((item) => item.is_active));
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Không thể tải danh sách phí dịch vụ hoạt động.",
        ),
      );
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await formTemplatesApi.list({
        mode: "active",
        page: 1,
        itemsPerPage: 200,
      });
      setTemplates(response.items.filter((item) => item.is_active));
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách biểu mẫu."));
    }
  }, []);

  useEffect(() => {
    void loadDetail();
    void loadServiceFees();
    void loadTemplates();
  }, [loadDetail, loadServiceFees, loadTemplates]);

  useEffect(() => {
    setInitialEditorLoaded(false);
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
  }, [invoiceId, leaseId]);

  useEffect(() => {
    if (!installment) return;
    setInstallmentStatus(installment.status);
    setInstallmentContent(installment.content || "");
    setFeeRows(
      installment.items.map((item) => ({
        row_key: `row-${item.id}-${Math.random().toString(36).slice(2, 8)}`,
        source: "CUSTOM",
        service_fee_id: null,
        description: item.description,
        quantity: String(item.quantity),
        unit_price: String(item.unit_price),
        note: item.note || "",
        evidence_image_urls: Array.isArray(item.evidence_image_urls)
          ? item.evidence_image_urls
          : [],
      })),
    );

    if (!initialEditorLoaded) {
      setEditorData(parseInstallmentEditorData(installment.content_html || ""));
      setInitialEditorLoaded(true);
    }
  }, [initialEditorLoaded, installment]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      return;
    }
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;
    setSelectedTemplate(template);
    setSettings(parseTemplateSettings(template));
    setEditorData(parseTemplateEditorData(template));
  }, [selectedTemplateId, templates]);

  function goBackToContract() {
    navigate(`/dashboard/contracts/${leaseId}`);
  }

  function zoomInEditor() {
    setEditorScale((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))));
  }

  function zoomOutEditor() {
    setEditorScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
  }

  async function applyAlignCommand(command: string) {
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
    await editorRef.current?.applyAlign(align);
  }

  async function insertTemplateVariable(
    token: string,
    point?: { x: number; y: number },
  ) {
    await editorRef.current?.insertVariable(token, point);
  }

  async function handleEditorDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const droppedToken = event.dataTransfer.getData("text/template-variable");
    if (!droppedToken) return;
    await insertTemplateVariable(droppedToken, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function insertImage(dataUrl: string) {
    editorRef.current?.insertImageFromDataUrl(dataUrl);
  }

  async function handleUploadImageFromInput(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl) insertImage(dataUrl);
    };
    reader.onerror = () => {
      toast.error("Không thể đọc file ảnh.");
    };
    reader.readAsDataURL(file);
  }

  function openCreateFeeRow() {
    setEditingRowKey(null);
    setFeeForm(createEmptyFeeRowForm("CUSTOM"));
    setIsFeeDialogOpen(true);
  }

  function openEditFeeRow(row: FeeRow) {
    setEditingRowKey(row.row_key);
    setFeeForm({
      source: row.source,
      service_fee_id: row.service_fee_id ? String(row.service_fee_id) : "",
      description: row.description,
      quantity: row.quantity,
      unit_price: row.unit_price,
      note: row.note,
      evidence_image_urls: [...row.evidence_image_urls],
    });
    setIsFeeDialogOpen(true);
  }

  function closeFeeDialog() {
    setIsFeeDialogOpen(false);
    setEditingRowKey(null);
    setFeeForm(createEmptyFeeRowForm("CUSTOM"));
  }

  function fillFromServiceFee(serviceFeeId: string) {
    const matched = serviceFees.find(
      (item) => String(item.id) === serviceFeeId,
    );
    if (!matched) return;
    setFeeForm((prev) => ({
      ...prev,
      source: "SERVICE_FEE",
      service_fee_id: serviceFeeId,
      description: matched.name,
      unit_price: toNumberInput(toFiniteNumber(matched.default_price, 0)),
      quantity:
        prev.quantity.trim().length > 0
          ? prev.quantity
          : toNumberInput(toFiniteNumber(matched.default_quantity, 1)),
      note:
        prev.note.trim().length > 0
          ? prev.note
          : matched.description || prev.note,
    }));
  }

  function saveFeeDialog() {
    const description = feeForm.description.trim();
    const quantity = toFiniteNumber(feeForm.quantity, 0);
    const unitPrice = toFiniteNumber(feeForm.unit_price, 0);
    if (!description) {
      toast.error("Vui lòng nhập tên dòng phí.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }
    if (unitPrice < 0) {
      toast.error("Đơn giá không hợp lệ.");
      return;
    }

    const nextRow: FeeRow = {
      row_key:
        editingRowKey ||
        `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: feeForm.source,
      service_fee_id:
        feeForm.source === "SERVICE_FEE" && feeForm.service_fee_id
          ? Number(feeForm.service_fee_id)
          : null,
      description,
      quantity: String(quantity),
      unit_price: String(unitPrice),
      note: feeForm.note.trim(),
      evidence_image_urls: feeForm.evidence_image_urls.filter((item) =>
        item.trim(),
      ),
    };

    setFeeRows((prev) => {
      if (!editingRowKey) return [...prev, nextRow];
      return prev.map((item) =>
        item.row_key === editingRowKey ? nextRow : item,
      );
    });
    closeFeeDialog();
  }

  function removeFeeRow(rowKey: string) {
    setFeeRows((prev) => prev.filter((item) => item.row_key !== rowKey));
  }

  async function handleUploadEvidenceFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingEvidence(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file) =>
          contractsApi.uploadInstallmentAttachment(file),
        ),
      );
      const urls = uploaded.map((item) => item.file_url).filter(Boolean);
      setFeeForm((prev) => ({
        ...prev,
        evidence_image_urls: [...prev.evidence_image_urls, ...urls],
      }));
      toast.success("Đã tải ảnh minh chứng lên MinIO.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải ảnh minh chứng."));
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function saveInstallment() {
    if (!installment || !detail) return;
    if (feeRows.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 dòng phí.");
      return;
    }
    const payloadItems = feeRows.map((row) => ({
      description: row.description.trim(),
      quantity: String(toFiniteNumber(row.quantity, 0)),
      unit_price: String(toFiniteNumber(row.unit_price, 0)),
      note: row.note.trim() || null,
      evidence_image_urls: row.evidence_image_urls.filter((item) =>
        item.trim(),
      ),
    }));
    setSaving(true);
    try {
      await contractsApi.updateInstallment(leaseId, installment.id, {
        status: installmentStatus,
        content: installmentContent.trim(),
        content_html: renderedInvoiceHtml,
        items: payloadItems,
      });
      toast.success("Đã cập nhật chi tiết kỳ thanh toán.");
      await loadDetail();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể cập nhật thông tin kỳ thanh toán."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    !leaseId ||
    !invoiceId ||
    Number.isNaN(leaseId) ||
    Number.isNaN(invoiceId)
  ) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-destructive">
          ID hợp đồng hoặc ID kỳ hóa đơn không hợp lệ.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/contracts")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Quay lại danh sách hợp đồng
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={goBackToContract}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Quay lại hợp đồng
          </Button>
          <h1 className="text-2xl font-semibold">
            Kỳ thanh toán #{invoiceId} - Hợp đồng #{leaseId}
          </h1>
        </div>
        <Button
          type="button"
          onClick={() => void saveInstallment()}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Đang tải dữ liệu kỳ thanh toán...
          </CardContent>
        </Card>
      ) : null}

      {!loading && !installment ? (
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            Không tìm thấy kỳ thanh toán #{invoiceId} trong hợp đồng này.
          </CardContent>
        </Card>
      ) : null}

      {!loading && installment && detail ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={activeTab === "info" ? "default" : "outline"}
              onClick={() => setActiveTab("info")}
            >
              Thông tin hóa đơn
            </Button>
            <Button
              type="button"
              variant={activeTab === "editor" ? "default" : "outline"}
              onClick={() => setActiveTab("editor")}
            >
              Soạn biểu mẫu
            </Button>
          </div>

          {activeTab === "info" ? (
            <Card>
              <CardHeader>
                <CardTitle>Thông tin kỳ hạn hóa đơn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Khách thuê</p>
                    <p className="font-medium">
                      {detail.renter
                        ? `${detail.renter.full_name} - ${detail.renter.phone}`
                        : `#${detail.lease.renter_id}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phòng</p>
                    <p className="font-medium">
                      {detail.room
                        ? `${detail.room.code} (#${detail.room.id})`
                        : `#${detail.lease.room_id}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Kỳ tháng</p>
                    <p className="font-medium">{installment.period_month}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Hạn thanh toán (chỉ đọc)
                    </p>
                    <Input
                      value={formatDateTimeText(installment.due_date)}
                      readOnly
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Đã thanh toán
                    </p>
                    <Input value={toVnd(installment.paid_amount)} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Trạng thái</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={installmentStatus}
                      onChange={(event) =>
                        setInstallmentStatus(
                          event.target.value as LeaseInstallment["status"],
                        )
                      }
                    >
                      {statusOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Nội dung ghi chú kỳ hóa đơn</Label>
                    <textarea
                      className="min-h-[92px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      value={installmentContent}
                      onChange={(event) =>
                        setInstallmentContent(event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    Danh sách dòng phí
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openCreateFeeRow}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Thêm dòng phí
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                        <th className="px-2 py-2">Mô tả phí</th>
                        <th className="px-2 py-2">Số lượng</th>
                        <th className="px-2 py-2">Đơn giá</th>
                        <th className="px-2 py-2">Thành tiền</th>
                        <th className="px-2 py-2">Ghi chú</th>
                        <th className="px-2 py-2">Ảnh minh chứng</th>
                        <th className="px-2 py-2 text-right">Thao tác</th>
                      </tr>
                      <tr className="border-b bg-background">
                        <th
                          className="px-2 py-2 text-right text-sm font-semibold"
                          colSpan={7}
                        >
                          Tổng tiền tất cả dòng phí: {toVnd(feeRowsTotal)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-2 py-5 text-center text-muted-foreground"
                          >
                            Chưa có dòng phí. Nhấn "Thêm dòng phí" để bắt đầu.
                          </td>
                        </tr>
                      ) : null}
                      {feeRows.map((row) => {
                        const amount =
                          toFiniteNumber(row.quantity, 0) *
                          toFiniteNumber(row.unit_price, 0);
                        return (
                          <tr
                            key={row.row_key}
                            className="cursor-pointer border-b hover:bg-muted/30"
                            onClick={() => openEditFeeRow(row)}
                          >
                            <td className="px-2 py-2">
                              <p className="font-medium">{row.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.source === "SERVICE_FEE"
                                  ? "Nguồn: phí dịch vụ"
                                  : "Nguồn: phí tùy chỉnh"}
                              </p>
                            </td>
                            <td className="px-2 py-2">
                              {toQuantityText(row.quantity)}
                            </td>
                            <td className="px-2 py-2">
                              {toVnd(row.unit_price)}
                            </td>
                            <td className="px-2 py-2 font-semibold">
                              {toVnd(amount)}
                            </td>
                            <td className="px-2 py-2">
                              {row.note ? (
                                <span className="line-clamp-2">{row.note}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              {row.evidence_image_urls.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.evidence_image_urls
                                    .slice(0, 3)
                                    .map((url) => (
                                      <img
                                        key={url}
                                        src={resolveEvidenceImageUrl(
                                          url,
                                          accessToken || null,
                                          workspaceKey,
                                        )}
                                        alt="Minh chứng"
                                        className="h-8 w-8 rounded border object-cover"
                                      />
                                    ))}
                                  {row.evidence_image_urls.length > 3 ? (
                                    <span className="text-xs text-muted-foreground">
                                      +{row.evidence_image_urls.length - 3}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openEditFeeRow(row);
                                  }}
                                >
                                  <PencilLine className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeFeeRow(row.row_key);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Soạn biểu mẫu kỳ hóa đơn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-12">
                  <div className="space-y-2 lg:col-span-4">
                    <Label>Chọn mẫu biểu mẫu</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={String(selectedTemplateId || "")}
                      onChange={(event) => {
                        const next = Number(event.target.value || "0");
                        setSelectedTemplateId(next > 0 ? next : null);
                      }}
                    >
                      <option value="">Không chọn mẫu</option>
                      {templates.map((template) => (
                        <option key={template.id} value={String(template.id)}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 lg:col-span-8 lg:justify-end">
                    <Button
                      type="button"
                      variant={editorMode === "edit" ? "default" : "outline"}
                      onClick={() => setEditorMode("edit")}
                    >
                      Chế độ Edit
                    </Button>
                    <Button
                      type="button"
                      variant={editorMode === "view" ? "default" : "outline"}
                      onClick={() => setEditorMode("view")}
                    >
                      Chế độ View
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void saveInstallment()}
                      disabled={saving}
                    >
                      {saving ? "Đang lưu..." : "Lưu kỳ hạn"}
                    </Button>
                  </div>
                </div>

                {selectedTemplate ? (
                  <p className="text-xs text-muted-foreground">
                    Đang dùng mẫu: <strong>{selectedTemplate.name}</strong>
                  </p>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="rounded-md border p-3 lg:col-span-3">
                    <p className="mb-2 text-sm font-medium">Biến kỳ hóa đơn</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Kéo thả biến vào editor hoặc bấm để chèn nhanh.
                    </p>
                    <div className="max-h-[64vh] space-y-2 overflow-auto pr-1">
                      {invoiceVariables.map((variable) => (
                        <button
                          key={variable.token}
                          type="button"
                          draggable={editorMode === "edit"}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "text/template-variable",
                              variable.token,
                            );
                            event.dataTransfer.effectAllowed = "copy";
                            setDraggingVariableToken(variable.token);
                          }}
                          onDragEnd={() => setDraggingVariableToken(null)}
                          onClick={() =>
                            void insertTemplateVariable(variable.token)
                          }
                          className={cn(
                            "w-full rounded-md border p-2 text-left text-xs transition",
                            "hover:border-primary/50 hover:bg-primary/5",
                            draggingVariableToken === variable.token &&
                              "border-primary bg-primary/10",
                            editorMode !== "edit" &&
                              "cursor-not-allowed opacity-60",
                          )}
                          disabled={editorMode !== "edit"}
                        >
                          <p className="font-semibold text-foreground">
                            {variable.label}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {variable.token}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-foreground/80">
                            Giá trị hiện tại: {variable.value}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border p-3 lg:col-span-9">
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={settings.pageSize}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            pageSize: event.target.value as "A3" | "A4",
                          }))
                        }
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                      </select>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={settings.orientation}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            orientation: event.target.value as
                              | "portrait"
                              | "landscape",
                          }))
                        }
                      >
                        <option value="portrait">Dọc</option>
                        <option value="landscape">Ngang</option>
                      </select>
                      <select
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                        value={settings.fontFamily}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            fontFamily: event.target.value,
                          }))
                        }
                        disabled={editorMode === "view"}
                      >
                        <option value="Arial">Arial</option>
                        <option value="'Times New Roman'">
                          Times New Roman
                        </option>
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
                        disabled={editorMode === "view"}
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
                        disabled={editorMode === "view"}
                      />
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          void handleUploadImageFromInput(event)
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={editorMode === "view" || !editorReady}
                      >
                        Chèn ảnh
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={editorMode === "view" || !editorReady}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => editorRef.current?.undo()}
                        title="Undo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={editorMode === "view" || !editorReady}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => editorRef.current?.redo()}
                        title="Redo"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={editorMode === "view" || !editorReady}
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
                        disabled={editorMode === "view" || !editorReady}
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
                        disabled={editorMode === "view" || !editorReady}
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
                        disabled={editorMode === "view" || !editorReady}
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
                          onDropCapture={(event) =>
                            void handleEditorDrop(event)
                          }
                        >
                          {editorMode === "edit" ? (
                            <TemplateEditor
                              ref={editorRef}
                              documentKey={editorDocumentKey}
                              data={editorData}
                              onChange={setEditorData}
                              onReadyChange={setEditorReady}
                            />
                          ) : (
                            <div
                              className="prose max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: renderedInvoiceHtml,
                              }}
                            />
                          )}
                          {editorMode === "edit" && !editorReady ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Đang khởi tạo EditorJS...
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {editorMode === "edit" ? (
                      <div className="rounded-md border p-3">
                        <p className="mb-2 text-sm font-medium">
                          Xem trước dữ liệu thật
                        </p>
                        <div className="max-h-[36vh] overflow-auto rounded-md border bg-white p-4">
                          <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: renderedInvoiceHtml,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRowKey
                ? "Cập nhật dòng phí dịch vụ"
                : "Thêm dòng phí dịch vụ"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nguồn phí</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={feeForm.source}
                  onChange={(event) => {
                    const nextSource = event.target.value as FeeRowSource;
                    setFeeForm((prev) => ({
                      ...prev,
                      source: nextSource,
                      service_fee_id:
                        nextSource === "CUSTOM" ? "" : prev.service_fee_id,
                    }));
                  }}
                >
                  <option value="CUSTOM">Tự thêm phí tùy chỉnh</option>
                  <option value="SERVICE_FEE">Chọn từ API phí dịch vụ</option>
                </select>
              </div>
              {feeForm.source === "SERVICE_FEE" ? (
                <div className="space-y-2">
                  <Label>Chọn phí dịch vụ có sẵn</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={feeForm.service_fee_id}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setFeeForm((prev) => ({
                        ...prev,
                        service_fee_id: nextId,
                      }));
                      fillFromServiceFee(nextId);
                    }}
                  >
                    <option value="">Chọn phí dịch vụ</option>
                    {serviceFees.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-2 md:col-span-2">
                <Label>Tên dòng phí</Label>
                <Input
                  value={feeForm.description}
                  onChange={(event) =>
                    setFeeForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={feeForm.quantity}
                  onChange={(event) =>
                    setFeeForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Đơn giá (VND)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1000"
                  value={feeForm.unit_price}
                  onChange={(event) =>
                    setFeeForm((prev) => ({
                      ...prev,
                      unit_price: event.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Định dạng: {toVnd(feeForm.unit_price || "0")}
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ghi chú</Label>
                <textarea
                  className="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  value={feeForm.note}
                  onChange={(event) =>
                    setFeeForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ảnh minh chứng</Label>
              <input
                ref={evidenceUploadInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  await handleUploadEvidenceFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => evidenceUploadInputRef.current?.click()}
                  disabled={uploadingEvidence}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {uploadingEvidence ? "Đang tải..." : "Tải ảnh lên MinIO"}
                </Button>
              </div>
              {feeForm.evidence_image_urls.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-md border p-2">
                  {feeForm.evidence_image_urls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="relative">
                      <img
                        src={resolveEvidenceImageUrl(
                          url,
                          accessToken || null,
                          workspaceKey,
                        )}
                        alt="Ảnh minh chứng"
                        className="h-20 w-20 rounded border object-cover"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        className="absolute -right-2 -top-2 h-5 w-5"
                        onClick={() =>
                          setFeeForm((prev) => ({
                            ...prev,
                            evidence_image_urls:
                              prev.evidence_image_urls.filter(
                                (_, imageIndex) => imageIndex !== idx,
                              ),
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chưa có ảnh minh chứng.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeFeeDialog}>
              Hủy
            </Button>
            <Button type="button" onClick={saveFeeDialog}>
              {editingRowKey ? "Cập nhật dòng phí" : "Thêm dòng phí"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
