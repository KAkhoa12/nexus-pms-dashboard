import type { TemplateSettings } from "@/features/form-templates/types";

export type TemplateVariable = {
  label: string;
  token: string;
};

export type EditorJsBlockData = Record<string, unknown>;

export type EditorJsBlock<TData extends EditorJsBlockData = EditorJsBlockData> =
  {
    id?: string;
    type: string;
    data: TData;
  };

export type EditorJsData = {
  time?: number;
  version?: string;
  blocks: EditorJsBlock[];
};

export type VariableTokenBlockData = {
  token: string;
  label?: string;
};

export type ResizableImageBlockData = {
  url: string;
  width?: number;
  caption?: string;
};

export type ColumnsBlockData = {
  columns: Array<{
    id?: string;
    span: number;
    blocks: EditorJsBlock[];
  }>;
};

export type TableBlockData = {
  withHeadings?: boolean;
  stretched?: boolean;
  content?: string[][];
};

export type TemplateConfigJson = {
  version: number;
  settings: TemplateSettings;
  variables: string[];
  shortcuts: {
    save: string;
    copy: string;
    paste: string;
  };
  editor_data: EditorJsData;
  updated_at: string;
};
