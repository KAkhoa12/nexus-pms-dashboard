import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ImagePlus,
  Redo2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { depositsApi } from "@/features/deposits/api/deposits.api";
import { formTemplatesApi } from "@/features/form-templates/api/form-templates.api";
import {
  DEFAULT_SETTINGS,
  EMPTY_EDITOR_DATA,
  PAGE_DIMENSIONS,
} from "@/features/form-templates/editor/constants";
import {
  TemplateEditor,
  type TemplateEditorHandle,
} from "@/features/form-templates/editor/TemplateEditor";
import { TemplatePreview } from "@/features/form-templates/editor/TemplatePreview";
import type { EditorJsData } from "@/features/form-templates/editor/types";
import type {
  FormTemplate,
  TemplateSettings,
} from "@/features/form-templates/types";
import type { Deposit, Renter } from "@/features/ops/types";
import { renterMembersApi } from "@/features/renter-members/api/renter-members.api";
import { rentersApi } from "@/features/renters/api/renters.api";

type ApiErrorBody = { message?: string };

type DepositInfoFormState = {
  room_id: string;
  renter_id: string;
  lease_id: string;
  amount: string;
  method: "CASH" | "BANK" | "QR";
  status: "HELD" | "REFUNDED" | "FORFEITED";
  paid_at: string;
};

type NewRenterFormState = {
  full_name: string;
  phone: string;
  identity_type: string;
  id_number: string;
  email: string;
  avatar_url: string;
  date_of_birth: string;
  address: string;
};

type NewRenterMemberFormState = {
  full_name: string;
  phone: string;
  identity_type: string;
  id_number: string;
  email: string;
  avatar_url: string;
  date_of_birth: string;
  address: string;
  relation: string;
};

type AlignCommand =
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull";

const DEFAULT_INFO_FORM: DepositInfoFormState = {
  room_id: "",
  renter_id: "",
  lease_id: "",
  amount: "0",
  method: "CASH",
  status: "HELD",
  paid_at: "",
};

const DEFAULT_NEW_RENTER_FORM: NewRenterFormState = {
  full_name: "",
  phone: "",
  identity_type: "CCCD",
  id_number: "",
  email: "",
  avatar_url: "",
  date_of_birth: "",
  address: "",
};

const DEFAULT_NEW_RENTER_MEMBER_FORM: NewRenterMemberFormState = {
  full_name: "",
  phone: "",
  identity_type: "CCCD",
  id_number: "",
  email: "",
  avatar_url: "",
  date_of_birth: "",
  address: "",
  relation: "",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toDatetimeLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromDatetimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function toIsoFromDateOnly(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
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

function parseDepositContractEditorData(value: string): EditorJsData {
  const parsed = parseJsonObject(value);
  if (isEditorJsData(parsed)) {
    return cloneEditorData(parsed);
  }

  if (value.trim()) {
    return {
      blocks: [
        {
          type: "rich_text",
          data: { html: value },
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

function translateTemplateType(value: string): string {
  if (value === "INVOICE") return "Hóa đơn";
  if (value === "CONTRACT") return "Hợp đồng";
  if (value === "GENERAL") return "Biểu mẫu chung";
  return value;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không thể đọc file ảnh."));
    reader.readAsDataURL(file);
  });
}

export function DepositDetailPage() {
  const navigate = useNavigate();
  const { depositId } = useParams();
  const parsedDepositId = Number(depositId);

  const [loading, setLoading] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [renters, setRenters] = useState<Renter[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [tab, setTab] = useState<"info" | "contract">("info");
  const [renterKeyword, setRenterKeyword] = useState("");
  const [templateIdToApply, setTemplateIdToApply] = useState<string>("");
  const [contractMode, setContractMode] = useState<"edit" | "view">("edit");

  const [infoForm, setInfoForm] =
    useState<DepositInfoFormState>(DEFAULT_INFO_FORM);
  const [contractEditorData, setContractEditorData] = useState<EditorJsData>(
    cloneEditorData(EMPTY_EDITOR_DATA),
  );
  const [contractSettings, setContractSettings] =
    useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [editorDocumentKey, setEditorDocumentKey] = useState(
    "deposit-contract-new",
  );
  const [editorReady, setEditorReady] = useState(false);

  const [isAddRenterOpen, setIsAddRenterOpen] = useState(false);
  const [addRenterTab, setAddRenterTab] = useState<"renter" | "companions">(
    "renter",
  );
  const [newRenterForm, setNewRenterForm] = useState<NewRenterFormState>(
    DEFAULT_NEW_RENTER_FORM,
  );
  const [newRenterMembers, setNewRenterMembers] = useState<
    NewRenterMemberFormState[]
  >([
    {
      ...DEFAULT_NEW_RENTER_MEMBER_FORM,
    },
  ]);
  const [addingRenter, setAddingRenter] = useState(false);

  const editorRef = useRef<TemplateEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const pageDims = useMemo(
    () =>
      PAGE_DIMENSIONS[contractSettings.pageSize][contractSettings.orientation],
    [contractSettings.pageSize, contractSettings.orientation],
  );

  const pageBoxStyle = useMemo(
    () =>
      ({
        width: `${pageDims.width}px`,
        minHeight: `${pageDims.height}px`,
        color: contractSettings.textColor,
        fontFamily: contractSettings.fontFamily,
        fontSize: `${contractSettings.fontSize}px`,
      }) as const,
    [
      pageDims.height,
      pageDims.width,
      contractSettings.textColor,
      contractSettings.fontFamily,
      contractSettings.fontSize,
    ],
  );

  useEffect(() => {
    if (!parsedDepositId || Number.isNaN(parsedDepositId)) return;
    void loadData(parsedDepositId);
  }, [parsedDepositId]);

  async function loadData(id: number) {
    setLoading(true);
    try {
      const [depositItem, renterItems] = await Promise.all([
        depositsApi.getById(id),
        rentersApi.list("active"),
      ]);

      setDeposit(depositItem);
      setRenters(renterItems);
      setInfoForm({
        room_id: String(depositItem.room_id),
        renter_id: depositItem.renter_id ? String(depositItem.renter_id) : "",
        lease_id: depositItem.lease_id ? String(depositItem.lease_id) : "",
        amount: depositItem.amount,
        method: depositItem.method,
        status: depositItem.status,
        paid_at: toDatetimeLocal(depositItem.paid_at),
      });
      setContractEditorData(
        parseDepositContractEditorData(depositItem.content_html || ""),
      );
      setEditorDocumentKey(`deposit-${id}-${Date.now()}`);
      setContractMode("edit");
      setTemplateIdToApply("");

      try {
        const templatesResp = await formTemplatesApi.list({
          mode: "active",
          page: 1,
          itemsPerPage: 200,
        });
        setTemplates(templatesResp.items);
      } catch (error) {
        setTemplates([]);
        toast.error(
          getErrorMessage(
            error,
            "Không thể tải danh sách biểu mẫu để áp dụng.",
          ),
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải chi tiết đặt cọc."));
    } finally {
      setLoading(false);
    }
  }

  const filteredRenters = useMemo(() => {
    const keyword = renterKeyword.trim().toLowerCase();
    if (!keyword) return renters;
    return renters.filter(
      (item) =>
        item.full_name.toLowerCase().includes(keyword) ||
        item.phone.toLowerCase().includes(keyword),
    );
  }, [renters, renterKeyword]);

  const contractTemplates = useMemo(() => templates, [templates]);

  async function saveDepositInfo() {
    if (!deposit) return;
    setSavingInfo(true);
    try {
      const payload = {
        renter_id: infoForm.renter_id ? Number(infoForm.renter_id) : undefined,
        lease_id: infoForm.lease_id ? Number(infoForm.lease_id) : undefined,
        amount: infoForm.amount,
        method: infoForm.method,
        status: infoForm.status,
        paid_at: toIsoFromDatetimeLocal(infoForm.paid_at),
      };
      const updated = await depositsApi.update(deposit.id, payload);
      setDeposit(updated);
      setInfoForm((prev) => ({
        ...prev,
        renter_id: updated.renter_id ? String(updated.renter_id) : "",
        lease_id: updated.lease_id ? String(updated.lease_id) : "",
        amount: updated.amount,
        method: updated.method,
        status: updated.status,
        paid_at: toDatetimeLocal(updated.paid_at),
      }));
      toast.success("Cập nhật thông tin đặt cọc thành công.");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Cập nhật thông tin đặt cọc thất bại."),
      );
    } finally {
      setSavingInfo(false);
    }
  }

  async function saveDepositContract() {
    if (!deposit) return;
    setSavingContract(true);
    try {
      const latestEditorData =
        (await editorRef.current?.save()) || contractEditorData;
      const htmlContent = editorDataToHtml(latestEditorData);
      const updated = await depositsApi.update(deposit.id, {
        content_html: htmlContent,
      });
      setDeposit(updated);
      setContractEditorData(latestEditorData);
      toast.success("Lưu hợp đồng đặt cọc thành công.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu hợp đồng đặt cọc thất bại."));
    } finally {
      setSavingContract(false);
    }
  }

  function applyTemplate() {
    const selectedTemplate = contractTemplates.find(
      (item) => String(item.id) === templateIdToApply,
    );
    if (!selectedTemplate) {
      toast.error("Vui lòng chọn mẫu biểu trước khi áp dụng.");
      return;
    }

    setContractEditorData(parseTemplateEditorData(selectedTemplate));
    setContractSettings(parseTemplateSettings(selectedTemplate));
    setEditorDocumentKey(
      `deposit-${parsedDepositId}-template-${selectedTemplate.id}-${Date.now()}`,
    );
    setContractMode("edit");
    toast.success("Đã áp dụng biểu mẫu vào hợp đồng đặt cọc.");
  }

  function resetAddRenterDialogState() {
    setAddRenterTab("renter");
    setNewRenterForm(DEFAULT_NEW_RENTER_FORM);
    setNewRenterMembers([{ ...DEFAULT_NEW_RENTER_MEMBER_FORM }]);
  }

  function addCompanionRow() {
    setNewRenterMembers((prev) => [
      ...prev,
      { ...DEFAULT_NEW_RENTER_MEMBER_FORM },
    ]);
  }

  function removeCompanionRow(index: number) {
    setNewRenterMembers((prev) => {
      if (prev.length <= 1) return [{ ...DEFAULT_NEW_RENTER_MEMBER_FORM }];
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function addRenter() {
    if (!newRenterForm.full_name.trim()) {
      toast.error("Vui lòng nhập họ tên khách hàng.");
      return;
    }
    if (!newRenterForm.phone.trim()) {
      toast.error("Vui lòng nhập số điện thoại khách hàng.");
      return;
    }
    setAddingRenter(true);
    try {
      const created = await rentersApi.create({
        full_name: newRenterForm.full_name.trim(),
        phone: newRenterForm.phone.trim(),
        identity_type: newRenterForm.identity_type.trim() || undefined,
        id_number: newRenterForm.id_number.trim() || undefined,
        email: newRenterForm.email.trim() || undefined,
        avatar_url: newRenterForm.avatar_url.trim() || undefined,
        date_of_birth: toIsoFromDateOnly(newRenterForm.date_of_birth),
        address: newRenterForm.address.trim() || undefined,
      });

      const companionPayloads = newRenterMembers
        .map((item) => ({
          full_name: item.full_name.trim(),
          phone: item.phone.trim(),
          identity_type: item.identity_type.trim(),
          id_number: item.id_number.trim(),
          email: item.email.trim(),
          avatar_url: item.avatar_url.trim(),
          date_of_birth: item.date_of_birth.trim(),
          address: item.address.trim(),
          relation: item.relation.trim(),
        }))
        .filter((item) => item.full_name && item.phone);

      let companionCreatedCount = 0;
      let companionFailedCount = 0;
      for (const companion of companionPayloads) {
        try {
          await renterMembersApi.create({
            renter_id: created.id,
            full_name: companion.full_name,
            phone: companion.phone,
            identity_type: companion.identity_type || undefined,
            id_number: companion.id_number || undefined,
            email: companion.email || undefined,
            avatar_url: companion.avatar_url || undefined,
            date_of_birth: toIsoFromDateOnly(companion.date_of_birth),
            address: companion.address || undefined,
            relation: companion.relation || undefined,
          });
          companionCreatedCount += 1;
        } catch {
          companionFailedCount += 1;
        }
      }

      setRenters((prev) => [created, ...prev]);
      setInfoForm((prev) => ({ ...prev, renter_id: String(created.id) }));
      setIsAddRenterOpen(false);
      resetAddRenterDialogState();

      if (companionCreatedCount > 0 && companionFailedCount === 0) {
        toast.success(
          `Thêm khách hàng mới thành công (${companionCreatedCount} người đi cùng).`,
        );
      } else if (companionCreatedCount > 0 && companionFailedCount > 0) {
        toast.warning(
          `Đã thêm khách hàng, nhưng chỉ tạo được ${companionCreatedCount} người đi cùng.`,
        );
      } else if (companionFailedCount > 0) {
        toast.warning(
          "Đã thêm khách hàng, nhưng chưa thêm được người đi cùng. Bạn có thể cập nhật sau.",
        );
      } else {
        toast.success("Thêm khách hàng mới thành công.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm khách hàng mới."));
    } finally {
      setAddingRenter(false);
    }
  }

  async function applyAlignCommand(command: AlignCommand) {
    if (contractMode !== "edit" || !editorReady) return;
    const align =
      command === "justifyLeft"
        ? "left"
        : command === "justifyCenter"
          ? "center"
          : command === "justifyRight"
            ? "right"
            : "justify";
    const applied = await editorRef.current?.applyAlign(align);
    if (applied === false) {
      toast.error("Không thể áp dụng canh lề cho vùng đang chọn.");
    }
  }

  function handleUndoEditor() {
    if (contractMode !== "edit" || !editorReady) return;
    editorRef.current?.undo();
  }

  function handleRedoEditor() {
    if (contractMode !== "edit" || !editorReady) return;
    editorRef.current?.redo();
  }

  function insertImage(dataUrl: string) {
    if (contractMode !== "edit" || !editorReady) return;
    editorRef.current?.insertImageFromDataUrl(dataUrl);
    editorRef.current?.focus();
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
      toast.error(getErrorMessage(error, "Không thể thêm ảnh vào hợp đồng."));
    } finally {
      event.target.value = "";
    }
  }

  if (!parsedDepositId || Number.isNaN(parsedDepositId)) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-destructive">
          ID phiếu đặt cọc không hợp lệ.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/deposits")}
        >
          Quay lại danh sách
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Chi tiết đặt cọc #{deposit?.id ?? parsedDepositId}
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý thông tin đặt cọc và nội dung hợp đồng trên cùng một trang.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/deposits")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Đang tải chi tiết đặt cọc...
        </p>
      ) : null}

      {!loading && !deposit ? (
        <p className="text-sm text-muted-foreground">
          Không tìm thấy phiếu đặt cọc.
        </p>
      ) : null}

      {deposit ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={tab === "info" ? "default" : "outline"}
                  onClick={() => setTab("info")}
                >
                  Thông tin đặt cọc
                </Button>
                <Button
                  type="button"
                  variant={tab === "contract" ? "default" : "outline"}
                  onClick={() => setTab("contract")}
                >
                  Hợp đồng đặt cọc
                </Button>
              </div>
            </CardContent>
          </Card>

          {tab === "info" ? (
            <Card>
              <CardHeader>
                <CardTitle>Thông tin đặt cọc</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phòng</Label>
                  <Input value={infoForm.room_id} disabled />
                </div>

                <div className="space-y-2">
                  <Label>Hợp đồng thuê (tùy chọn)</Label>
                  <Input
                    value={infoForm.lease_id}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        lease_id: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Khách hàng đặt phòng</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddRenterOpen(true)}
                    >
                      Thêm khách hàng mới
                    </Button>
                  </div>
                  <Input
                    placeholder="Tìm khách hàng theo tên hoặc số điện thoại..."
                    value={renterKeyword}
                    onChange={(e) => setRenterKeyword(e.target.value)}
                  />
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={infoForm.renter_id}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        renter_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Chọn khách hàng</option>
                    {filteredRenters.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.full_name} - {item.phone}
                      </option>
                    ))}
                  </select>
                  {renters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Chưa có khách hàng nào, vui lòng thêm mới.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Số tiền đặt cọc</Label>
                  <Input
                    value={infoForm.amount}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phương thức</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={infoForm.method}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        method: e.target.value as "CASH" | "BANK" | "QR",
                      }))
                    }
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK">Chuyển khoản</option>
                    <option value="QR">QR</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={infoForm.status}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        status: e.target.value as
                          | "HELD"
                          | "REFUNDED"
                          | "FORFEITED",
                      }))
                    }
                  >
                    <option value="HELD">Đang giữ cọc</option>
                    <option value="REFUNDED">Đã hoàn cọc</option>
                    <option value="FORFEITED">Mất cọc</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Thời điểm đặt cọc</Label>
                  <Input
                    type="datetime-local"
                    value={infoForm.paid_at}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        paid_at: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    onClick={() => void saveDepositInfo()}
                    disabled={savingInfo}
                  >
                    {savingInfo ? "Đang lưu..." : "Lưu thông tin đặt cọc"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === "contract" ? (
            <Card>
              <CardHeader className="space-y-4">
                <CardTitle>Hợp đồng đặt cọc</CardTitle>
                <div className="grid gap-3 md:grid-cols-12">
                  <div className="space-y-2 md:col-span-6">
                    <Label>Chọn mẫu biểu</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={templateIdToApply}
                      onChange={(e) => setTemplateIdToApply(e.target.value)}
                    >
                      <option value="">Chọn biểu mẫu để áp dụng</option>
                      {contractTemplates.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          #{item.id} - {item.name} (
                          {translateTemplateType(item.template_type)})
                        </option>
                      ))}
                    </select>
                    {contractTemplates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Chưa có biểu mẫu nào đang hoạt động. Vui lòng tạo ở
                        trang Cài đặt biểu mẫu.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-end md:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={applyTemplate}
                    >
                      Áp dụng mẫu
                    </Button>
                  </div>
                  <div className="flex items-end md:col-span-2">
                    <Button
                      type="button"
                      variant={contractMode === "edit" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setContractMode("edit")}
                    >
                      Chế độ sửa
                    </Button>
                  </div>
                  <div className="flex items-end md:col-span-2">
                    <Button
                      type="button"
                      variant={contractMode === "view" ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setContractMode("view")}
                    >
                      Chế độ xem
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={contractSettings.fontFamily}
                    onChange={(e) =>
                      setContractSettings((prev) => ({
                        ...prev,
                        fontFamily: e.target.value,
                      }))
                    }
                    disabled={contractMode === "view"}
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
                    value={contractSettings.fontSize}
                    onChange={(e) =>
                      setContractSettings((prev) => ({
                        ...prev,
                        fontSize: Number(e.target.value) || 14,
                      }))
                    }
                    disabled={contractMode === "view"}
                  />
                  <input
                    type="color"
                    value={contractSettings.textColor}
                    onChange={(e) =>
                      setContractSettings((prev) => ({
                        ...prev,
                        textColor: e.target.value,
                      }))
                    }
                    className="h-9 w-12 cursor-pointer rounded border bg-background p-1"
                    disabled={contractMode === "view"}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void handleUploadImageFromInput(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={contractMode === "view" || !editorReady}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Chèn ảnh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleUndoEditor}
                    title="Undo"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleRedoEditor}
                    title="Redo"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void applyAlignCommand("justifyLeft")}
                    title="Canh trái"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void applyAlignCommand("justifyCenter")}
                    title="Canh giữa"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void applyAlignCommand("justifyRight")}
                    title="Canh phải"
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={contractMode === "view" || !editorReady}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void applyAlignCommand("justifyFull")}
                    title="Canh đều"
                  >
                    <AlignJustify className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="max-h-[78vh] overflow-auto rounded-lg border bg-muted/20 p-4">
                  <div
                    className="mx-auto"
                    style={{
                      width: `${pageDims.width}px`,
                      minHeight: `${pageDims.height}px`,
                    }}
                  >
                    <div
                      className="bg-white p-8 shadow-sm"
                      style={pageBoxStyle}
                    >
                      {contractMode === "edit" ? (
                        <TemplateEditor
                          ref={editorRef}
                          documentKey={editorDocumentKey}
                          data={contractEditorData}
                          onChange={setContractEditorData}
                          onReadyChange={setEditorReady}
                        />
                      ) : (
                        <TemplatePreview data={contractEditorData} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => void saveDepositContract()}
                    disabled={savingContract || contractMode === "view"}
                  >
                    {savingContract ? "Đang lưu..." : "Lưu hợp đồng đặt cọc"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={isAddRenterOpen}
        onOpenChange={(open) => {
          setIsAddRenterOpen(open);
          if (!open) {
            resetAddRenterDialogState();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Thêm khách hàng mới</DialogTitle>
            <DialogDescription>
              Thêm nhanh khách hàng để gán cho phiếu đặt cọc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={addRenterTab === "renter" ? "default" : "outline"}
                onClick={() => setAddRenterTab("renter")}
              >
                Tab 1: Người thuê
              </Button>
              <Button
                type="button"
                variant={addRenterTab === "companions" ? "default" : "outline"}
                onClick={() => setAddRenterTab("companions")}
              >
                Tab 2: Người đi cùng
              </Button>
            </div>

            {addRenterTab === "renter" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Họ và tên</Label>
                  <Input
                    value={newRenterForm.full_name}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Số điện thoại</Label>
                  <Input
                    value={newRenterForm.phone}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Loại giấy tờ</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={newRenterForm.identity_type}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        identity_type: e.target.value,
                      }))
                    }
                  >
                    <option value="CCCD">CCCD</option>
                    <option value="CMND">CMND</option>
                    <option value="PASSPORT">Hộ chiếu</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Số giấy tờ</Label>
                  <Input
                    value={newRenterForm.id_number}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        id_number: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={newRenterForm.email}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ngày sinh</Label>
                  <Input
                    type="date"
                    value={newRenterForm.date_of_birth}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        date_of_birth: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Avatar URL</Label>
                  <Input
                    value={newRenterForm.avatar_url}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        avatar_url: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Địa chỉ</Label>
                  <Input
                    value={newRenterForm.address}
                    onChange={(e) =>
                      setNewRenterForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Khai báo người đi cùng với đầy đủ thông tin. Bỏ trống họ tên
                  hoặc số điện thoại thì bản ghi đó sẽ không được tạo.
                </p>
                {newRenterMembers.map((member, index) => (
                  <div
                    key={`member-row-${index}`}
                    className="space-y-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Người đi cùng #{index + 1}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCompanionRow(index)}
                      >
                        Xóa dòng
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Họ và tên</Label>
                        <Input
                          value={member.full_name}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, full_name: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Số điện thoại</Label>
                        <Input
                          value={member.phone}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, phone: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Loại giấy tờ</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3"
                          value={member.identity_type}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, identity_type: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="CCCD">CCCD</option>
                          <option value="CMND">CMND</option>
                          <option value="PASSPORT">Hộ chiếu</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Số giấy tờ</Label>
                        <Input
                          value={member.id_number}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, id_number: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={member.email}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, email: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ngày sinh</Label>
                        <Input
                          type="date"
                          value={member.date_of_birth}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      date_of_birth: e.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Avatar URL</Label>
                        <Input
                          value={member.avatar_url}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, avatar_url: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Địa chỉ</Label>
                        <Input
                          value={member.address}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, address: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quan hệ</Label>
                        <Input
                          value={member.relation}
                          onChange={(e) =>
                            setNewRenterMembers((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, relation: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addCompanionRow()}
                >
                  Thêm người đi cùng
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddRenterOpen(false);
                resetAddRenterDialogState();
              }}
            >
              Hủy
            </Button>
            <Button onClick={() => void addRenter()} disabled={addingRenter}>
              Lưu khách hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
