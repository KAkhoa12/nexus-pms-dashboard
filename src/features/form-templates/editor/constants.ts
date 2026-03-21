import type { EditorJsData, TemplateVariable } from "./types";
import type { TemplateSettings } from "@/features/form-templates/types";

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { label: "Tên khách thuê", token: "{{renter.full_name}}" },
  { label: "Số điện thoại", token: "{{renter.phone}}" },
  { label: "Mã phòng", token: "{{room.code}}" },
  { label: "Tên chi nhánh", token: "{{branch.name}}" },
  { label: "Tên khu vực", token: "{{area.name}}" },
  { label: "Tên tòa nhà", token: "{{building.name}}" },
  { label: "Kỳ hóa đơn", token: "{{invoice.period_month}}" },
  { label: "Tổng tiền", token: "{{invoice.total_amount}}" },
  { label: "Ngày thanh toán", token: "{{invoice.due_date}}" },
  { label: "Ngày hiện tại", token: "{{system.today}}" },
];

export const DEFAULT_SETTINGS: TemplateSettings = {
  pageSize: "A4",
  orientation: "portrait",
  fontFamily: "Arial",
  fontSize: 14,
  textColor: "#111827",
  showGrid: true,
};

export const PAGE_DIMENSIONS = {
  A4: {
    portrait: { width: 794, height: 1123 },
    landscape: { width: 1123, height: 794 },
  },
  A3: {
    portrait: { width: 1123, height: 1587 },
    landscape: { width: 1587, height: 1123 },
  },
} as const;

export const EMPTY_EDITOR_DATA: EditorJsData = {
  blocks: [
    {
      type: "paragraph",
      data: {
        text: "Bắt đầu soạn mẫu tại đây...",
      },
    },
  ],
};
