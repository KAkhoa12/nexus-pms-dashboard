export type FormTemplate = {
  id: number;
  tenant_id: number;
  name: string;
  template_type: string;
  page_size: string;
  orientation: string;
  font_family: string;
  font_size: number;
  text_color: string;
  content_html: string;
  config_json: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TemplateSettings = {
  pageSize: "A3" | "A4";
  orientation: "portrait" | "landscape";
  fontFamily: string;
  fontSize: number;
  textColor: string;
  showGrid: boolean;
};
