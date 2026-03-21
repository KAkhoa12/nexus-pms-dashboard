import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  CalendarIcon,
  Check,
  Minus,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { areasApi } from "@/features/areas/api/areas.api";
import { branchesApi } from "@/features/branches/api/branches.api";
import { buildingsApi } from "@/features/buildings/api/buildings.api";
import { contractsApi } from "@/features/contracts/api/contracts.api";
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
import type {
  Area,
  Branch,
  Building,
  Lease,
  Renter,
  Room,
  RoomType,
} from "@/features/ops/types";
import { rentersApi } from "@/features/renters/api/renters.api";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";
import {
  serviceFeesApi,
  type ServiceFee,
} from "@/features/service-fees/api/service-fees.api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorBody = { message?: string };

type NewRenterFormState = {
  full_name: string;
  phone: string;
  identity_type: string;
  id_number: string;
  email: string;
  address: string;
};

const DEFAULT_NEW_RENTER_FORM: NewRenterFormState = {
  full_name: "",
  phone: "",
  identity_type: "",
  id_number: "",
  email: "",
  address: "",
};

type ContractFlowStep = {
  title: string;
  description: string;
};

type ContractEditorVariable = {
  label: string;
  token: string;
  value: string;
};

type DepositMode = "PERCENT" | "CUSTOM";

type ServiceFeeSelectionState = {
  enabled: boolean;
  quantity: string;
  unitPrice: string;
};

type SelectedServiceFeeLine = {
  serviceFeeId: number;
  name: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
};

const CONTRACT_FLOW_STEPS: ContractFlowStep[] = [
  {
    title: "Khách thuê",
    description: "Chọn khách thuê có sẵn hoặc tạo mới nhanh.",
  },
  {
    title: "Thời hạn bàn giao",
    description: "Chọn phòng, số năm thuê và thời điểm giao nhận.",
  },
  {
    title: "Đặt cọc",
    description: "Nhập tiền cọc, phương thức thanh toán và xác nhận.",
  },
  {
    title: "Phí dịch vụ",
    description: "Chọn các phí đi kèm và số lượng áp dụng.",
  },
  {
    title: "Hợp đồng",
    description: "Tổng hợp thông tin, biểu mẫu và lưu hợp đồng.",
  },
];

const DEPOSIT_PERCENT_OPTIONS = [30, 40, 50, 60, 70, 80, 90, 100];

const ROOM_STATUS_LABELS: Record<Room["current_status"], string> = {
  VACANT: "Trống",
  DEPOSITED: "Đã đặt cọc",
  RENTED: "Đã thuê",
  MAINTENANCE: "Đang sửa chữa",
};

function getRoomStatusLabel(status: Room["current_status"]): string {
  return ROOM_STATUS_LABELS[status] ?? status;
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

function formatMoney(value: number): string {
  return value.toLocaleString("vi-VN");
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
        const toCells = (row: unknown, isHead: boolean) =>
          Array.isArray(row)
            ? row
                .map((cell) =>
                  isHead
                    ? `<th style="border:1px solid #cbd5e1;padding:6px 8px;text-align:left;background:#f8fafc;">${String(cell ?? "")}</th>`
                    : `<td style="border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;">${String(cell ?? "")}</td>`,
                )
                .join("")
            : "";
        if (withHeadings) {
          const [head, ...body] = rows;
          const headCells = toCells(head, true);
          const bodyRows = body
            .map((row) => `<tr>${toCells(row, false)}</tr>`)
            .join("");
          return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        }
        const bodyRows = rows
          .map((row) => `<tr>${toCells(row, false)}</tr>`)
          .join("");
        return `<table${buildAlignStyle(block.data.align)} style="width:100%;border-collapse:collapse;"><tbody>${bodyRows}</tbody></table>`;
      }
      if (block.type === "delimiter") return "<hr />";
      if (block.type === "variableToken") {
        const token = String(block.data.token || "");
        return `<strong>${escapeHtml(token)}</strong>`;
      }
      if (block.type === "simpleImage" || block.type === "resizableImage") {
        const url = String(block.data.url || "");
        if (!url) return "";
        const caption = String(block.data.caption || "");
        return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(caption || "image")}" style="max-width:100%;" />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure>`;
      }
      return "";
    })
    .join("\n");
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

async function fetchAllRoomsActive(): Promise<Room[]> {
  const allItems: Room[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await roomsApi.list({
      mode: "active",
      page,
      itemsPerPage: 200,
    });
    allItems.push(...response.items);
    totalPages = response.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return allItems;
}

export function ContractsCreatePage() {
  const [searchParams] = useSearchParams();
  const roomIdFromQuery = Number(searchParams.get("room_id") || "0");
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingRenter, setCreatingRenter] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [renters, setRenters] = useState<Renter[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [serviceFees, setServiceFees] = useState<ServiceFee[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);

  const [activeStep, setActiveStep] = useState(1);
  const [activeContractTab, setActiveContractTab] = useState<"info" | "editor">(
    "info",
  );
  const [editorMode, setEditorMode] = useState<"edit" | "view">("edit");
  const [editorData, setEditorData] = useState<EditorJsData>(
    cloneEditorData(EMPTY_EDITOR_DATA),
  );
  const [settings, setSettings] = useState<TemplateSettings>({
    ...DEFAULT_SETTINGS,
    showGrid: false,
  });
  const [editorScale, setEditorScale] = useState(1);
  const [editorReady, setEditorReady] = useState(false);
  const [editorDocumentKey, setEditorDocumentKey] = useState("contract-new");
  const editorRef = useRef<TemplateEditorHandle | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<number>(0);
  const [renterKeyword, setRenterKeyword] = useState("");
  const [selectedRenterId, setSelectedRenterId] = useState<number>(0);
  const [isCreateRenterDialogOpen, setIsCreateRenterDialogOpen] =
    useState(false);
  const [newRenterForm, setNewRenterForm] = useState<NewRenterFormState>(
    DEFAULT_NEW_RENTER_FORM,
  );

  const [leaseYears, setLeaseYears] = useState("1");
  const [handoverDate, setHandoverDate] = useState<Date | undefined>(
    new Date(),
  );
  const [rentPrice, setRentPrice] = useState("0");
  const [pricingMode, setPricingMode] = useState<"FIXED" | "PER_PERSON">(
    "FIXED",
  );

  const [depositMode, setDepositMode] = useState<DepositMode>("PERCENT");
  const [depositPercent, setDepositPercent] = useState("50");
  const [depositAmount, setDepositAmount] = useState("0");
  const [depositMethod, setDepositMethod] = useState<"CASH" | "BANK" | "QR">(
    "CASH",
  );
  const [depositNote, setDepositNote] = useState("");
  const [depositConfirmed, setDepositConfirmed] = useState(false);

  const [serviceFeeSelections, setServiceFeeSelections] = useState<
    Record<number, ServiceFeeSelectionState>
  >({});

  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(0);
  const [createdLease, setCreatedLease] = useState<Lease | null>(null);
  const [draggingVariableToken, setDraggingVariableToken] = useState<
    string | null
  >(null);
  const totalSteps = CONTRACT_FLOW_STEPS.length;
  const stepProgressPercent =
    totalSteps > 1 ? ((activeStep - 1) / (totalSteps - 1)) * 100 : 0;

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!roomIdFromQuery || Number.isNaN(roomIdFromQuery)) return;
    setSelectedRoomId(roomIdFromQuery);
  }, [roomIdFromQuery]);

  const selectedRoom = useMemo(
    () => rooms.find((item) => item.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );
  const selectedRenter = useMemo(
    () => renters.find((item) => item.id === selectedRenterId) ?? null,
    [renters, selectedRenterId],
  );
  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );
  const selectedRoomType = useMemo(
    () =>
      roomTypes.find(
        (item) => item.id === Number(selectedRoom?.room_type_id),
      ) ?? null,
    [roomTypes, selectedRoom?.room_type_id],
  );
  const selectedBuilding = useMemo(
    () =>
      buildings.find((item) => item.id === Number(selectedRoom?.building_id)) ??
      null,
    [buildings, selectedRoom?.building_id],
  );
  const selectedArea = useMemo(
    () =>
      areas.find((item) => item.id === Number(selectedRoom?.area_id)) ?? null,
    [areas, selectedRoom?.area_id],
  );
  const selectedBranch = useMemo(
    () =>
      branches.find((item) => item.id === Number(selectedRoom?.branch_id)) ??
      null,
    [branches, selectedRoom?.branch_id],
  );
  const rentPriceNumber = useMemo(
    () => toFiniteNumber(rentPrice, 0),
    [rentPrice],
  );
  const selectedServiceFeeLines = useMemo<SelectedServiceFeeLine[]>(() => {
    return serviceFees
      .map((fee) => {
        const selection = serviceFeeSelections[fee.id];
        if (!selection?.enabled) return null;
        const quantity = toFiniteNumber(selection.quantity, 0);
        const unitPrice = toFiniteNumber(selection.unitPrice, 0);
        if (quantity <= 0 || unitPrice < 0) return null;
        return {
          serviceFeeId: fee.id,
          name: fee.name,
          unit: fee.unit,
          quantity,
          unitPrice,
          amount: quantity * unitPrice,
        };
      })
      .filter((line): line is SelectedServiceFeeLine => line !== null);
  }, [serviceFeeSelections, serviceFees]);
  const selectedServiceFeesTotal = useMemo(
    () =>
      selectedServiceFeeLines.reduce((total, line) => total + line.amount, 0),
    [selectedServiceFeeLines],
  );
  const selectedServiceFeesSummary = useMemo(() => {
    if (!selectedServiceFeeLines.length) return "Không chọn phí dịch vụ";
    return selectedServiceFeeLines
      .map((line) => {
        const unitText = line.unit ? ` ${line.unit}` : "";
        return `${line.name}: ${line.quantity}${unitText} x ${formatMoney(
          line.unitPrice,
        )} = ${formatMoney(line.amount)}`;
      })
      .join("; ");
  }, [selectedServiceFeeLines]);

  const contractVariables = useMemo<ContractEditorVariable[]>(
    () => [
      {
        label: "Người tạo hợp đồng",
        token: "{{user.full_name}}",
        value: user?.fullName || "-",
      },
      {
        label: "Email người tạo",
        token: "{{user.email}}",
        value: user?.email || "-",
      },
      {
        label: "Tên khách thuê",
        token: "{{renter.full_name}}",
        value: selectedRenter?.full_name || "-",
      },
      {
        label: "SĐT khách thuê",
        token: "{{renter.phone}}",
        value: selectedRenter?.phone || "-",
      },
      {
        label: "Email khách thuê",
        token: "{{renter.email}}",
        value: selectedRenter?.email || "-",
      },
      {
        label: "Mã phòng",
        token: "{{room.code}}",
        value: selectedRoom?.code || "-",
      },
      {
        label: "Loại phòng",
        token: "{{room_type.name}}",
        value: selectedRoomType?.name || "-",
      },
      {
        label: "Giá thuê",
        token: "{{lease.rent_price}}",
        value: rentPrice,
      },
      {
        label: "Số năm thuê",
        token: "{{lease.years}}",
        value: leaseYears,
      },
      {
        label: "Ngày giao nhận",
        token: "{{lease.handover_date}}",
        value: handoverDate
          ? format(handoverDate, "dd/MM/yyyy", { locale: vi })
          : "-",
      },
      {
        label: "Tiền đặt cọc",
        token: "{{lease.deposit_amount}}",
        value: formatMoney(toFiniteNumber(depositAmount, 0)),
      },
      {
        label: "Phương thức cọc",
        token: "{{lease.deposit_method}}",
        value:
          depositMethod === "CASH"
            ? "Tiền mặt"
            : depositMethod === "BANK"
              ? "Chuyển khoản"
              : "QR code",
      },
      {
        label: "Chi nhánh",
        token: "{{branch.name}}",
        value: selectedBranch?.name || "-",
      },
      {
        label: "Khu vực",
        token: "{{area.name}}",
        value: selectedArea?.name || "-",
      },
      {
        label: "Tòa nhà",
        token: "{{building.name}}",
        value: selectedBuilding?.name || "-",
      },
      {
        label: "Tổng phí dịch vụ",
        token: "{{lease.service_fees_total}}",
        value: formatMoney(selectedServiceFeesTotal),
      },
      {
        label: "Chi tiết phí dịch vụ",
        token: "{{lease.service_fees_summary}}",
        value: selectedServiceFeesSummary,
      },
    ],
    [
      user?.fullName,
      user?.email,
      selectedRenter?.full_name,
      selectedRenter?.phone,
      selectedRenter?.email,
      selectedRoom?.code,
      selectedRoomType?.name,
      rentPrice,
      leaseYears,
      handoverDate,
      depositAmount,
      depositMethod,
      selectedBranch?.name,
      selectedArea?.name,
      selectedBuilding?.name,
      selectedServiceFeesSummary,
      selectedServiceFeesTotal,
    ],
  );

  const pageDims = useMemo(
    () => PAGE_DIMENSIONS[settings.pageSize][settings.orientation],
    [settings.orientation, settings.pageSize],
  );

  const pageBoxStyle = useMemo(
    () => ({
      width: `${pageDims.width}px`,
      minHeight: `${pageDims.height}px`,
      color: settings.textColor,
      fontFamily: settings.fontFamily,
      fontSize: `${settings.fontSize}px`,
    }),
    [
      pageDims.height,
      pageDims.width,
      settings.fontFamily,
      settings.fontSize,
      settings.textColor,
    ],
  );

  const contractTokenMap = useMemo(() => {
    const map: Record<string, string> = {
      "{{system.today}}": format(new Date(), "dd/MM/yyyy", { locale: vi }),
    };
    contractVariables.forEach((item) => {
      map[item.token] = item.value === "-" ? "" : item.value;
    });
    return map;
  }, [contractVariables]);

  const renderedContractHtml = useMemo(() => {
    const html = editorDataToHtml(editorData);
    return replaceTemplateTokens(html, contractTokenMap);
  }, [contractTokenMap, editorData]);

  const filteredRenters = useMemo(() => {
    const keyword = renterKeyword.trim().toLowerCase();
    if (!keyword) return renters.slice(0, 12);
    return renters
      .filter((item) =>
        [item.full_name, item.phone, item.email || "", item.id_number || ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      )
      .slice(0, 12);
  }, [renters, renterKeyword]);

  async function loadData() {
    setLoading(true);
    try {
      const [
        roomItems,
        renterItems,
        branchItems,
        areaItems,
        buildingItems,
        roomTypeItems,
        serviceFeeResp,
        templateResp,
      ] = await Promise.all([
        fetchAllRoomsActive(),
        rentersApi.list("active"),
        branchesApi.list("active", { itemsPerPage: 200 }),
        areasApi
          .list({
            mode: "active",
            page: 1,
            itemsPerPage: 200,
          })
          .then((res) => res.items),
        buildingsApi.list("active"),
        roomTypesApi.list("active"),
        serviceFeesApi.list({
          mode: "active",
          page: 1,
          itemsPerPage: 200,
        }),
        formTemplatesApi.list({
          mode: "active",
          page: 1,
          itemsPerPage: 200,
        }),
      ]);
      setRooms(roomItems);
      setRenters(renterItems);
      setBranches(branchItems);
      setAreas(areaItems);
      setBuildings(buildingItems);
      setRoomTypes(roomTypeItems);
      setServiceFees(serviceFeeResp.items.filter((item) => item.is_active));
      setTemplates(
        templateResp.items.filter(
          (item) =>
            item.template_type === "CONTRACT" ||
            item.template_type === "GENERAL",
        ),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải dữ liệu hợp đồng."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRoom) return;
    setRentPrice(String(selectedRoom.current_price));
    const roomType = roomTypes.find(
      (item) => item.id === selectedRoom.room_type_id,
    );
    if (roomType) setPricingMode(roomType.pricing_mode);
  }, [selectedRoomId, selectedRoom, roomTypes]);

  useEffect(() => {
    if (!serviceFees.length) return;
    setServiceFeeSelections((previous) => {
      const next: Record<number, ServiceFeeSelectionState> = { ...previous };
      let changed = false;
      serviceFees.forEach((fee) => {
        if (next[fee.id]) return;
        next[fee.id] = {
          enabled: false,
          quantity: String(
            Math.max(0.01, toFiniteNumber(fee.default_quantity, 1)),
          ),
          unitPrice: String(Math.max(0, toFiniteNumber(fee.default_price, 0))),
        };
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [serviceFees]);

  useEffect(() => {
    if (depositMode !== "PERCENT") return;
    const price = Math.max(0, rentPriceNumber);
    const percent = Math.max(0, toFiniteNumber(depositPercent, 0));
    const computed = (price * percent) / 100;
    const normalized = Number.isFinite(computed) ? String(computed) : "0";
    setDepositAmount((previous) =>
      previous === normalized ? previous : normalized,
    );
    setDepositConfirmed(false);
  }, [depositMode, depositPercent, rentPriceNumber]);

  function selectRenter(renter: Renter) {
    setSelectedRenterId(renter.id);
    setRenterKeyword(renter.full_name);
  }

  async function createNewRenter(): Promise<boolean> {
    if (!newRenterForm.full_name.trim() || !newRenterForm.phone.trim()) {
      toast.error("Vui lòng nhập họ tên và số điện thoại khách thuê.");
      return false;
    }
    setCreatingRenter(true);
    try {
      const created = await rentersApi.create({
        full_name: newRenterForm.full_name.trim(),
        phone: newRenterForm.phone.trim(),
        identity_type: newRenterForm.identity_type.trim() || undefined,
        id_number: newRenterForm.id_number.trim() || undefined,
        email: newRenterForm.email.trim() || undefined,
        address: newRenterForm.address.trim() || undefined,
      });
      setRenters((prev) => [created, ...prev]);
      setSelectedRenterId(created.id);
      setRenterKeyword(created.full_name);
      setNewRenterForm(DEFAULT_NEW_RENTER_FORM);
      toast.success("Đã thêm khách thuê mới.");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo khách thuê."));
      return false;
    } finally {
      setCreatingRenter(false);
    }
  }

  function toggleServiceFeeEnabled(serviceFeeId: number, enabled: boolean) {
    setServiceFeeSelections((previous) => ({
      ...previous,
      [serviceFeeId]: {
        ...(previous[serviceFeeId] || {
          enabled: false,
          quantity: "1",
          unitPrice: "0",
        }),
        enabled,
      },
    }));
  }

  function updateServiceFeeSelection(
    serviceFeeId: number,
    patch: Partial<ServiceFeeSelectionState>,
  ) {
    setServiceFeeSelections((previous) => ({
      ...previous,
      [serviceFeeId]: {
        ...(previous[serviceFeeId] || {
          enabled: false,
          quantity: "1",
          unitPrice: "0",
        }),
        ...patch,
      },
    }));
  }

  function confirmDeposit() {
    const amount = Number(depositAmount);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Số tiền đặt cọc không hợp lệ.");
      return;
    }
    if (amount > rentPriceNumber) {
      toast.error("Tiền đặt cọc không được lớn hơn tiền thuê phòng.");
      return;
    }
    if (amount > 0 && !depositMethod) {
      toast.error("Vui lòng chọn phương thức đặt cọc.");
      return;
    }
    setDepositConfirmed(true);
    toast.success("Đã xác nhận thông tin đặt cọc.");
  }

  function validateStep(step: number): boolean {
    if (step === 1) {
      if (!selectedRenterId) {
        toast.error("Vui lòng chọn khách thuê.");
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!selectedRoomId) {
        toast.error("Vui lòng chọn phòng.");
        return false;
      }
      const years = Number(leaseYears);
      if (Number.isNaN(years) || years < 1) {
        toast.error("Số năm thuê phải lớn hơn hoặc bằng 1.");
        return false;
      }
      if (!handoverDate || Number.isNaN(handoverDate.getTime())) {
        toast.error("Vui lòng chọn thời điểm giao nhận nhà.");
        return false;
      }
      const price = Number(rentPrice);
      if (Number.isNaN(price) || price <= 0) {
        toast.error("Giá thuê phải lớn hơn 0.");
        return false;
      }
      return true;
    }
    if (step === 3) {
      const amount = Number(depositAmount);
      if (Number.isNaN(amount) || amount < 0) {
        toast.error("Số tiền đặt cọc không hợp lệ.");
        return false;
      }
      if (amount > rentPriceNumber) {
        toast.error("Tiền đặt cọc không được lớn hơn tiền thuê phòng.");
        return false;
      }
      if (!depositConfirmed) {
        toast.error("Vui lòng nhấn xác nhận đặt cọc trước khi tiếp tục.");
        return false;
      }
      return true;
    }
    if (step === 4) {
      const hasInvalidSelection = Object.entries(serviceFeeSelections).some(
        ([, selection]) =>
          selection.enabled &&
          (toFiniteNumber(selection.quantity, 0) <= 0 ||
            toFiniteNumber(selection.unitPrice, -1) < 0),
      );
      if (hasInvalidSelection) {
        toast.error("Số lượng hoặc đơn giá phí dịch vụ không hợp lệ.");
        return false;
      }
      return true;
    }
    return true;
  }

  function goNextStep() {
    if (!validateStep(activeStep)) return;
    setActiveStep((prev) => Math.min(totalSteps, prev + 1));
  }

  function goPrevStep() {
    setActiveStep((prev) => Math.max(1, prev - 1));
  }

  async function handleSelectTemplate(templateId: number) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId) ?? null;
    if (!template) {
      setEditorData(cloneEditorData(EMPTY_EDITOR_DATA));
      setEditorDocumentKey(`contract-reset-${Date.now()}`);
      setSettings(DEFAULT_SETTINGS);
      setEditorScale(1);
      return;
    }
    setEditorData(parseTemplateEditorData(template));
    setSettings(parseTemplateSettings(template));
    setEditorScale(1);
    setEditorDocumentKey(`contract-template-${template.id}-${Date.now()}`);
  }

  async function insertTemplateVariable(
    token: string,
    point?: { x: number; y: number },
  ) {
    await editorRef.current?.insertVariable(token, point);
    editorRef.current?.focus();
  }

  async function handleEditorDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const droppedToken = event.dataTransfer.getData("text/template-variable");
    if (!droppedToken) return;
    await insertTemplateVariable(droppedToken, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function zoomOutEditor() {
    setEditorScale((prev) => Math.max(0.8, Math.round((prev - 0.1) * 10) / 10));
  }

  function zoomInEditor() {
    setEditorScale((prev) => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10));
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
    const applied = await editorRef.current?.applyAlign(align);
    if (!applied) {
      toast.error(
        "Không tìm thấy đoạn cần căn lề. Hãy bôi đen lại nội dung rồi thử lại.",
      );
    }
  }

  async function handleUploadImageFromInput(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) return;
      editorRef.current?.insertImageFromDataUrl(dataUrl);
    };
    reader.onerror = () => {
      toast.error("Không đọc được file ảnh.");
    };
    reader.readAsDataURL(file);
  }

  async function saveContract() {
    if (
      !validateStep(1) ||
      !validateStep(2) ||
      !validateStep(3) ||
      !validateStep(4)
    ) {
      return;
    }
    if (!selectedRoom || !selectedRenter) {
      toast.error("Thiếu dữ liệu phòng hoặc khách thuê.");
      return;
    }

    setSaving(true);
    try {
      const latestEditorData = (await editorRef.current?.save()) || editorData;
      setEditorData(latestEditorData);
      const renderedHtml = replaceTemplateTokens(
        editorDataToHtml(latestEditorData),
        contractTokenMap,
      );
      if (!handoverDate || Number.isNaN(handoverDate.getTime())) {
        toast.error("Vui lòng chọn thời điểm giao nhận nhà.");
        return;
      }
      const handoverAtValue = handoverDate;
      const amount = Number(depositAmount);
      const years = Number(leaseYears);
      const selectedServiceFeePayload = selectedServiceFeeLines.map((line) => ({
        service_fee_id: line.serviceFeeId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
      }));
      const summaryContent = [
        `Khách thuê: ${selectedRenter.full_name} (${selectedRenter.phone})`,
        `Phòng: ${selectedRoom.code}`,
        `Số năm thuê: ${years}`,
        `Thời điểm giao nhận: ${handoverAtValue.toLocaleString("vi-VN")}`,
        `Tiền cọc: ${formatMoney(amount)} (${depositMethod})`,
        `Phí dịch vụ: ${selectedServiceFeesSummary}`,
        `Tổng phí dịch vụ: ${formatMoney(selectedServiceFeesTotal)}`,
      ].join("\n");

      const created = await contractsApi.create({
        branch_id: selectedRoom.branch_id,
        room_id: selectedRoom.id,
        renter_id: selectedRenter.id,
        lease_years: years,
        handover_at: handoverAtValue.toISOString(),
        start_date: handoverAtValue.toISOString(),
        rent_price: String(rentPrice),
        pricing_mode: pricingMode,
        status: "ACTIVE",
        content: summaryContent,
        content_html: renderedHtml,
        security_deposit_amount: String(amount),
        security_deposit_paid_amount: String(amount),
        security_deposit_payment_method: depositMethod,
        security_deposit_paid_at:
          amount > 0 ? new Date().toISOString() : undefined,
        security_deposit_note: depositNote.trim(),
        mark_room_as_deposited: true,
        selected_service_fees: selectedServiceFeePayload,
      });
      setCreatedLease(created);
      toast.success(`Đã lưu hợp đồng thuê #${created.id} thành công.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể lưu hợp đồng thuê."));
    } finally {
      setSaving(false);
    }
  }

  async function printContract() {
    const latestEditorData = (await editorRef.current?.save()) || editorData;
    const html = replaceTemplateTokens(
      editorDataToHtml(latestEditorData),
      contractTokenMap,
    );
    const popup = window.open("", "_blank", "width=1200,height=900");
    if (!popup) {
      toast.error("Không mở được cửa sổ in hợp đồng.");
      return;
    }
    popup.document.write(`
      <html>
        <head>
          <title>In hợp đồng thuê</title>
          <style>
            body {
              font-family: ${settings.fontFamily}, sans-serif;
              font-size: ${settings.fontSize}px;
              color: ${settings.textColor};
              padding: 24px;
              line-height: 1.5;
            }
            h1,h2,h3,h4 { margin: 0 0 8px; }
            p { margin: 0 0 10px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tạo hợp đồng thuê phòng</h1>
        <p className="text-sm text-muted-foreground">
          Hoàn tất quy trình khách thuê, chọn phòng, đặt cọc, phí dịch vụ và nội
          dung hợp đồng.
        </p>
      </div>

      <div className="space-y-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/10">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Quy trình tạo hợp đồng</CardTitle>
              <p className="text-sm text-muted-foreground">
                Bước {activeStep}/{totalSteps}
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${stepProgressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hoàn thành {Math.round(stepProgressPercent)}%
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {CONTRACT_FLOW_STEPS.map((item, index) => {
                const step = index + 1;
                const isDone = step < activeStep;
                const isCurrent = step === activeStep;
                const isClickable = step <= activeStep;
                return (
                  <li key={item.title}>
                    <button
                      type="button"
                      className={`flex h-full w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                        isCurrent
                          ? "border-primary bg-primary/5 shadow-sm"
                          : isDone
                            ? "border-emerald-300 bg-emerald-50/70"
                            : "border-border bg-background"
                      } ${isClickable ? "hover:border-primary/60" : "opacity-60"}`}
                      disabled={!isClickable}
                      onClick={() => setActiveStep(step)}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : isCurrent
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : step}
                      </span>
                      <span>
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {activeStep === 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Khách thuê</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Tìm khách thuê theo tên, SĐT, email hoặc CCCD</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsCreateRenterDialogOpen(true)}
                    >
                      Thêm khách hàng mới
                    </Button>
                  </div>
                  <Input
                    placeholder="Nhập để lọc khách thuê..."
                    value={renterKeyword}
                    onChange={(event) => setRenterKeyword(event.target.value)}
                  />
                  <div className="max-h-60 overflow-auto rounded-md border">
                    {filteredRenters.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`flex w-full items-start justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                          selectedRenterId === item.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => selectRenter(item)}
                      >
                        <span>
                          <strong>{item.full_name}</strong>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {item.phone} {item.email ? `• ${item.email}` : ""}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          #{item.id}
                        </span>
                      </button>
                    ))}
                    {filteredRenters.length === 0 ? (
                      <div className="space-y-2 px-3 py-3 text-sm text-muted-foreground">
                        <p>Không có khách thuê phù hợp.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setIsCreateRenterDialogOpen(true)}
                        >
                          Thêm khách hàng mới
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedRenter ? (
                  <div className="rounded-md border p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">
                      Thông tin khách thuê đã chọn
                    </p>
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">Họ tên:</span>{" "}
                        <span className="font-medium">
                          {selectedRenter.full_name || "-"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">SĐT:</span>{" "}
                        <span className="font-medium">
                          {selectedRenter.phone || "-"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        <span className="font-medium">
                          {selectedRenter.email || "-"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Loại giấy tờ:
                        </span>{" "}
                        <span className="font-medium">
                          {selectedRenter.identity_type || "-"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Số giấy tờ:
                        </span>{" "}
                        <span className="font-medium">
                          {selectedRenter.id_number || "-"}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Ngày sinh:
                        </span>{" "}
                        <span className="font-medium">
                          {selectedRenter.date_of_birth
                            ? new Date(
                                selectedRenter.date_of_birth,
                              ).toLocaleDateString("vi-VN")
                            : "-"}
                        </span>
                      </p>
                      <p className="md:col-span-2">
                        <span className="text-muted-foreground">Địa chỉ:</span>{" "}
                        <span className="font-medium">
                          {selectedRenter.address || "-"}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Chưa chọn khách thuê. Vui lòng chọn trong danh sách hoặc tạo
                    khách hàng mới.
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 2 ? (
            <Card>
              <CardHeader>
                <CardTitle>Thời hạn và giao nhận</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Chọn phòng</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={String(selectedRoomId || "")}
                    onChange={(event) =>
                      setSelectedRoomId(Number(event.target.value))
                    }
                  >
                    <option value="">Chọn phòng</option>
                    {rooms
                      .filter(
                        (item) =>
                          item.current_status === "VACANT" ||
                          item.current_status === "DEPOSITED",
                      )
                      .map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.code} •{" "}
                          {getRoomStatusLabel(item.current_status)} • Giá{" "}
                          {formatMoney(toFiniteNumber(item.current_price, 0))}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Thuê bao nhiêu năm?</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={leaseYears}
                    onChange={(event) => setLeaseYears(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Thời điểm giao nhận nhà</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "w-full justify-start rounded-md border-input bg-background text-left font-normal shadow-sm hover:bg-accent hover:text-accent-foreground",
                          !handoverDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {handoverDate
                          ? format(handoverDate, "dd/MM/yyyy", { locale: vi })
                          : "Chọn ngày giao nhận"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto rounded-md border p-0 shadow-md"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={handoverDate}
                        onSelect={setHandoverDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Giá thuê</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rentPrice}
                    onChange={(event) => setRentPrice(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cách tính giá</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={pricingMode}
                    onChange={(event) =>
                      setPricingMode(
                        event.target.value as "FIXED" | "PER_PERSON",
                      )
                    }
                  >
                    <option value="FIXED">Cố định theo phòng</option>
                    <option value="PER_PERSON">Theo số người</option>
                  </select>
                </div>
                <div className="md:col-span-2 rounded-md border p-3 text-sm text-muted-foreground">
                  {selectedRoom ? (
                    <p>
                      Phòng <strong>{selectedRoom.code}</strong> • Loại phòng{" "}
                      <strong>{selectedRoomType?.name ?? "-"}</strong> • Tầng{" "}
                      <strong>{selectedRoom.floor_number}</strong> • Tòa{" "}
                      <strong>{selectedBuilding?.name ?? "-"}</strong> • Chi
                      nhánh <strong>{selectedBranch?.name ?? "-"}</strong> • Khu
                      vực <strong>{selectedArea?.name ?? "-"}</strong>
                    </p>
                  ) : (
                    <p>Vui lòng chọn phòng trước khi qua bước đặt cọc.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 3 ? (
            <Card>
              <CardHeader>
                <CardTitle>Đặt cọc</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kiểu đặt cọc</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={depositMode}
                    onChange={(event) => {
                      setDepositMode(event.target.value as DepositMode);
                      setDepositConfirmed(false);
                    }}
                  >
                    <option value="PERCENT">Theo phần trăm giá thuê</option>
                    <option value="CUSTOM">Tùy chỉnh thủ công</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tiền thuê phòng</Label>
                  <Input value={formatMoney(rentPriceNumber)} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Tỷ lệ đặt cọc</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={depositPercent}
                    onChange={(event) => {
                      setDepositPercent(event.target.value);
                      setDepositConfirmed(false);
                    }}
                    disabled={depositMode !== "PERCENT"}
                  >
                    {DEPOSIT_PERCENT_OPTIONS.map((percent) => (
                      <option key={percent} value={String(percent)}>
                        {percent}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Số tiền đặt cọc</Label>
                  <Input
                    type="number"
                    min={0}
                    value={depositAmount}
                    readOnly={depositMode === "PERCENT"}
                    onChange={(event) => {
                      setDepositAmount(event.target.value);
                      setDepositConfirmed(false);
                    }}
                    disabled={depositMode === "PERCENT"}
                  />
                  {toFiniteNumber(depositAmount, 0) > rentPriceNumber ? (
                    <p className="text-xs text-destructive">
                      Tiền đặt cọc không được lớn hơn tiền thuê phòng.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Phương thức đặt cọc</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={depositMethod}
                    onChange={(event) => {
                      setDepositMethod(
                        event.target.value as "CASH" | "BANK" | "QR",
                      );
                      setDepositConfirmed(false);
                    }}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK">Chuyển khoản</option>
                    <option value="QR">QR code (sẽ nâng cấp)</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Ghi chú đặt cọc</Label>
                  <textarea
                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={depositNote}
                    onChange={(event) => {
                      setDepositNote(event.target.value);
                      setDepositConfirmed(false);
                    }}
                    placeholder="Ghi chú thêm nếu cần..."
                  />
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm md:col-span-2">
                  <p className="font-medium">Tổng quan đặt cọc</p>
                  <p className="text-muted-foreground">
                    Giá thuê: <strong>{formatMoney(rentPriceNumber)}</strong> •
                    Tỷ lệ:{" "}
                    <strong>
                      {depositMode === "PERCENT"
                        ? `${depositPercent}%`
                        : "Tùy chỉnh"}
                    </strong>{" "}
                    • Tiền cọc:{" "}
                    <strong>
                      {formatMoney(toFiniteNumber(depositAmount, 0))}
                    </strong>
                  </p>
                </div>
                <div className="md:col-span-2 flex items-center gap-3">
                  <Button type="button" onClick={confirmDeposit}>
                    Xác nhận đặt cọc
                  </Button>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      depositConfirmed
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {depositConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 4 ? (
            <Card>
              <CardHeader>
                <CardTitle>Phí dịch vụ đi kèm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Chọn các phí muốn áp dụng cho hợp đồng. Bạn có thể chỉnh số
                  lượng và đơn giá cho từng phí.
                </p>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                        <th className="px-2 py-2">Áp dụng</th>
                        <th className="px-2 py-2">Phí dịch vụ</th>
                        <th className="px-2 py-2">Chu kỳ</th>
                        <th className="px-2 py-2">Số lượng</th>
                        <th className="px-2 py-2">Đơn giá</th>
                        <th className="px-2 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceFees.map((fee) => {
                        const selection = serviceFeeSelections[fee.id] || {
                          enabled: false,
                          quantity: String(
                            Math.max(
                              0.01,
                              toFiniteNumber(fee.default_quantity, 1),
                            ),
                          ),
                          unitPrice: String(
                            Math.max(0, toFiniteNumber(fee.default_price, 0)),
                          ),
                        };
                        const amount =
                          toFiniteNumber(selection.quantity, 0) *
                          toFiniteNumber(selection.unitPrice, 0);
                        const cycleLabel =
                          fee.billing_cycle === "ONE_TIME"
                            ? "Một lần"
                            : fee.billing_cycle === "CUSTOM_MONTHS"
                              ? `Mỗi ${fee.cycle_interval_months || 1} tháng`
                              : "Hàng tháng";
                        return (
                          <tr key={fee.id} className="border-b">
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={selection.enabled}
                                onChange={(event) =>
                                  toggleServiceFeeEnabled(
                                    fee.id,
                                    event.target.checked,
                                  )
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <p className="font-medium">{fee.name}</p>
                              {fee.description ? (
                                <p className="text-xs text-muted-foreground">
                                  {fee.description}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2">{cycleLabel}</td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={selection.quantity}
                                disabled={!selection.enabled}
                                onChange={(event) =>
                                  updateServiceFeeSelection(fee.id, {
                                    quantity: event.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step="1000"
                                value={selection.unitPrice}
                                disabled={!selection.enabled}
                                onChange={(event) =>
                                  updateServiceFeeSelection(fee.id, {
                                    unitPrice: event.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">
                              {selection.enabled ? formatMoney(amount) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {serviceFees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-2 py-6 text-center text-muted-foreground"
                          >
                            Chưa có phí dịch vụ hoạt động.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm">
                    Đã chọn <strong>{selectedServiceFeeLines.length}</strong>{" "}
                    phí • Tổng phí dịch vụ{" "}
                    <strong>{formatMoney(selectedServiceFeesTotal)}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {activeStep === 5 ? (
            <Card>
              <CardHeader>
                <CardTitle>Hợp đồng thuê</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={
                      activeContractTab === "info" ? "default" : "outline"
                    }
                    onClick={() => setActiveContractTab("info")}
                  >
                    Thông tin hợp đồng
                  </Button>
                  <Button
                    type="button"
                    variant={
                      activeContractTab === "editor" ? "default" : "outline"
                    }
                    onClick={() => setActiveContractTab("editor")}
                  >
                    Soạn biểu mẫu
                  </Button>
                </div>

                {activeContractTab === "info" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-muted-foreground">Khách thuê</p>
                      <p className="font-medium">
                        {selectedRenter?.full_name || "-"}{" "}
                        {selectedRenter ? `(${selectedRenter.phone})` : ""}
                      </p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-muted-foreground">Phòng</p>
                      <p className="font-medium">{selectedRoom?.code || "-"}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-muted-foreground">Thời hạn thuê</p>
                      <p className="font-medium">{leaseYears} năm</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-muted-foreground">Giao nhận nhà</p>
                      <p className="font-medium">
                        {handoverDate
                          ? format(handoverDate, "dd/MM/yyyy", { locale: vi })
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-md border p-3 text-sm md:col-span-2">
                      <p className="text-muted-foreground">Đặt cọc</p>
                      <p className="font-medium">
                        {formatMoney(toFiniteNumber(depositAmount, 0))} -{" "}
                        {depositMethod === "CASH"
                          ? "Tiền mặt"
                          : depositMethod === "BANK"
                            ? "Chuyển khoản"
                            : "QR code"}
                      </p>
                      {depositNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ghi chú: {depositNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-md border p-3 text-sm md:col-span-2">
                      <p className="text-muted-foreground">Dịch vụ đi kèm</p>
                      {selectedServiceFeeLines.length ? (
                        <div className="space-y-1">
                          {selectedServiceFeeLines.map((line) => (
                            <p key={line.serviceFeeId}>
                              <span className="font-medium">{line.name}</span>:{" "}
                              {line.quantity}
                              {line.unit ? ` ${line.unit}` : ""} x{" "}
                              {formatMoney(line.unitPrice)} ={" "}
                              {formatMoney(line.amount)}
                            </p>
                          ))}
                          <p className="pt-1 text-xs text-muted-foreground">
                            Tổng phí dịch vụ:{" "}
                            {formatMoney(selectedServiceFeesTotal)}
                          </p>
                        </div>
                      ) : (
                        <p className="font-medium">Không chọn phí dịch vụ.</p>
                      )}
                    </div>
                    {createdLease ? (
                      <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm md:col-span-2">
                        Đã tạo hợp đồng thành công với mã #{createdLease.id}.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 lg:grid-cols-12">
                      <div className="space-y-2 lg:col-span-4">
                        <Label>Chọn mẫu biểu mẫu</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3"
                          value={String(selectedTemplateId || "")}
                          onChange={(event) =>
                            void handleSelectTemplate(
                              Number(event.target.value || "0"),
                            )
                          }
                        >
                          <option value="">Không chọn mẫu</option>
                          {templates.map((item) => (
                            <option key={item.id} value={String(item.id)}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-end gap-2 lg:col-span-8 lg:justify-end">
                        <Button
                          type="button"
                          variant={
                            editorMode === "edit" ? "default" : "outline"
                          }
                          onClick={() => setEditorMode("edit")}
                        >
                          Chế độ Edit
                        </Button>
                        <Button
                          type="button"
                          variant={
                            editorMode === "view" ? "default" : "outline"
                          }
                          onClick={() => setEditorMode("view")}
                        >
                          Chế độ View
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void printContract()}
                        >
                          In hợp đồng
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void saveContract()}
                          disabled={saving}
                        >
                          {saving ? "Đang lưu..." : "Lưu hợp đồng"}
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
                        <p className="mb-2 text-sm font-medium">
                          Biến hợp đồng từ các bước
                        </p>
                        <p className="mb-3 text-xs text-muted-foreground">
                          Kéo thả biến vào editor hoặc bấm để chèn nhanh.
                        </p>
                        <div className="max-h-[64vh] space-y-2 overflow-auto pr-1">
                          {contractVariables.map((variable) => (
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
                            onClick={() =>
                              void applyAlignCommand("justifyLeft")
                            }
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
                            onClick={() =>
                              void applyAlignCommand("justifyCenter")
                            }
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
                            onClick={() =>
                              void applyAlignCommand("justifyRight")
                            }
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
                            onClick={() =>
                              void applyAlignCommand("justifyFull")
                            }
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
                              onDragOverCapture={(event) =>
                                event.preventDefault()
                              }
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
                                    __html: renderedContractHtml,
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
                                  __html: renderedContractHtml,
                                }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={activeStep <= 1}
              onClick={goPrevStep}
            >
              Quay lại
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (activeStep === totalSteps) {
                  void saveContract();
                  return;
                }
                goNextStep();
              }}
              disabled={loading || saving}
            >
              {activeStep === totalSteps ? "Lưu hợp đồng" : "Tiếp tục"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={isCreateRenterDialogOpen}
        onOpenChange={setIsCreateRenterDialogOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm khách hàng thuê mới</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input
                value={newRenterForm.full_name}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                value={newRenterForm.phone}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={newRenterForm.email}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Loại giấy tờ</Label>
              <Input
                value={newRenterForm.identity_type}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    identity_type: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Số giấy tờ</Label>
              <Input
                value={newRenterForm.id_number}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    id_number: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              <Input
                value={newRenterForm.address}
                onChange={(event) =>
                  setNewRenterForm((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateRenterDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const ok = await createNewRenter();
                if (ok) setIsCreateRenterDialogOpen(false);
              }}
              disabled={creatingRenter}
            >
              {creatingRenter ? "Đang tạo..." : "Lưu khách hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
