import ColumnsTool from "@/features/form-templates/editor/tools/ColumnsTool";
import ResizableImageTool from "@/features/form-templates/editor/tools/ResizableImageTool";
import VariableTokenTool from "@/features/form-templates/editor/tools/VariableTokenTool";

async function getTemplateColumnTools() {
  const [
    HeaderModule,
    ListModule,
    ParagraphModule,
    DelimiterModule,
    TableModule,
  ] = await Promise.all([
    import("@editorjs/header"),
    import("@editorjs/list"),
    import("@editorjs/paragraph"),
    import("@editorjs/delimiter"),
    import("@editorjs/table"),
  ]);

  return {
    header: {
      class: HeaderModule.default,
      inlineToolbar: true,
      config: {
        levels: [2, 3, 4],
        defaultLevel: 3,
      },
    },
    paragraph: {
      class: ParagraphModule.default,
      inlineToolbar: true,
    },
    list: {
      class: ListModule.default,
      inlineToolbar: true,
      config: { defaultStyle: "unordered" },
    },
    delimiter: {
      class: DelimiterModule.default,
    },
    table: {
      class: TableModule.default,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 2,
      },
    },
    variableToken: {
      class: VariableTokenTool,
      inlineToolbar: false,
    },
    resizableImage: {
      class: ResizableImageTool,
      inlineToolbar: false,
    },
  };
}

export async function getTemplateEditorTools() {
  const [
    HeaderModule,
    ListModule,
    ParagraphModule,
    DelimiterModule,
    SimpleImageModule,
    TableModule,
    columnTools,
  ] = await Promise.all([
    import("@editorjs/header"),
    import("@editorjs/list"),
    import("@editorjs/paragraph"),
    import("@editorjs/delimiter"),
    import("@editorjs/simple-image"),
    import("@editorjs/table"),
    getTemplateColumnTools(),
  ]);

  return {
    header: {
      class: HeaderModule.default,
      inlineToolbar: true,
      config: {
        levels: [1, 2, 3, 4],
        defaultLevel: 2,
      },
    },
    paragraph: {
      class: ParagraphModule.default,
      inlineToolbar: true,
    },
    list: {
      class: ListModule.default,
      inlineToolbar: true,
      config: {
        defaultStyle: "unordered",
      },
    },
    delimiter: {
      class: DelimiterModule.default,
    },
    table: {
      class: TableModule.default,
      inlineToolbar: true,
      config: {
        rows: 2,
        cols: 2,
      },
    },
    simpleImage: {
      class: SimpleImageModule.default,
      inlineToolbar: true,
    },
    variableToken: {
      class: VariableTokenTool,
      inlineToolbar: false,
    },
    resizableImage: {
      class: ResizableImageTool,
      inlineToolbar: false,
    },
    columns: {
      class: ColumnsTool,
      inlineToolbar: false,
      config: {
        tools: columnTools,
      },
    },
  };
}
