import { Fragment, createElement } from "react";
import type {
  EditorJsBlock,
  EditorJsData,
  ResizableImageBlockData,
  TableBlockData,
  VariableTokenBlockData,
} from "@/features/form-templates/editor/types";

type TemplatePreviewProps = {
  data: EditorJsData;
};

type ListItemNode =
  | string
  | {
      content?: string;
      items?: ListItemNode[];
    };

function normalizeListItems(raw: unknown): ListItemNode[] {
  return Array.isArray(raw) ? (raw as ListItemNode[]) : [];
}

function renderListItems(items: ListItemNode[]) {
  return items.map((item, index) => {
    if (typeof item === "string") {
      return <li key={index} dangerouslySetInnerHTML={{ __html: item }} />;
    }
    const nested = normalizeListItems(item.items);
    return (
      <li key={index}>
        {item.content ? (
          <span dangerouslySetInnerHTML={{ __html: item.content }} />
        ) : null}
        {nested.length > 0 ? (
          <ul className="list-disc pl-6">{renderListItems(nested)}</ul>
        ) : null}
      </li>
    );
  });
}

function renderBlock(block: EditorJsBlock, index: number) {
  if (block.type === "rich_text") {
    return (
      <div
        key={`${block.id || block.type}-${index}`}
        dangerouslySetInnerHTML={{
          __html: String((block.data.html as string | undefined) || ""),
        }}
      />
    );
  }

  const align =
    block.data.align === "left" ||
    block.data.align === "center" ||
    block.data.align === "right" ||
    block.data.align === "justify"
      ? block.data.align
      : undefined;
  const alignStyle = align ? ({ textAlign: align } as const) : undefined;

  if (block.type === "header") {
    const text = String((block.data.text as string | undefined) || "");
    const level = Number(block.data.level || 2);
    const tag = `h${Math.min(6, Math.max(1, level))}`;
    return createElement(tag, {
      key: `${block.id || block.type}-${index}`,
      dangerouslySetInnerHTML: { __html: text },
      className: "font-semibold",
      style: alignStyle,
    });
  }

  if (block.type === "paragraph") {
    return (
      <p
        key={`${block.id || block.type}-${index}`}
        style={alignStyle}
        dangerouslySetInnerHTML={{
          __html: String((block.data.text as string | undefined) || ""),
        }}
      />
    );
  }

  if (block.type === "list") {
    const style = String(
      (block.data.style as string | undefined) || "unordered",
    );
    const items = normalizeListItems(block.data.items);
    const key = `${block.id || block.type}-${index}`;
    if (style === "ordered") {
      return (
        <ol key={key} className="list-decimal pl-6" style={alignStyle}>
          {renderListItems(items)}
        </ol>
      );
    }
    return (
      <ul key={key} className="list-disc pl-6" style={alignStyle}>
        {renderListItems(items)}
      </ul>
    );
  }

  if (block.type === "delimiter") {
    return <hr key={`${block.id || block.type}-${index}`} />;
  }

  if (block.type === "variableToken") {
    const data = block.data as VariableTokenBlockData;
    return (
      <div
        key={`${block.id || block.type}-${index}`}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-400 bg-slate-100 px-2 py-1 text-sm"
      >
        <span className="font-medium">{data.label || "Biến dữ liệu"}</span>
        <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">
          {data.token}
        </code>
      </div>
    );
  }

  if (block.type === "resizableImage") {
    const data = block.data as ResizableImageBlockData;
    if (!data.url) return null;
    return (
      <figure key={`${block.id || block.type}-${index}`} className="my-3">
        <img
          src={data.url}
          alt={data.caption || "template-image"}
          style={{ width: `${Math.min(100, Math.max(20, data.width || 60))}%` }}
          className="mx-auto h-auto max-w-full rounded"
        />
        {data.caption ? (
          <figcaption className="mt-1 text-center text-xs text-slate-600">
            {data.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === "simpleImage") {
    const url = String((block.data.url as string | undefined) || "");
    if (!url) return null;
    const caption = String((block.data.caption as string | undefined) || "");
    return (
      <figure key={`${block.id || block.type}-${index}`} className="my-3">
        <img
          src={url}
          alt={caption || "simple-image"}
          className="mx-auto h-auto max-w-full rounded"
        />
        {caption ? (
          <figcaption className="mt-1 text-center text-xs text-slate-600">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (block.type === "columns") {
    const columnsRaw = block.data.columns as
      | Array<{ span?: number; blocks?: EditorJsBlock[] }>
      | undefined;
    const columns = Array.isArray(columnsRaw) ? columnsRaw : [];
    if (columns.length === 0) return null;
    return (
      <div
        key={`${block.id || block.type}-${index}`}
        className="my-3 flex gap-3"
      >
        {columns.map((columnData, columnIndex) => {
          const span = Math.min(12, Math.max(1, Number(columnData.span || 1)));
          const widthPercent = (span / 12) * 100;
          return (
            <div
              key={`${columnIndex}-${span}`}
              style={{
                flex: `0 0 ${widthPercent}%`,
                maxWidth: `${widthPercent}%`,
              }}
              className="min-w-0 rounded border border-slate-200 p-2"
            >
              <TemplatePreview
                data={{
                  blocks: Array.isArray(columnData.blocks)
                    ? columnData.blocks
                    : [],
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === "table") {
    const data = block.data as TableBlockData;
    const rows = Array.isArray(data.content) ? data.content : [];
    if (rows.length === 0) return null;
    const bodyRows =
      data.withHeadings && rows.length > 1 ? rows.slice(1) : rows;
    return (
      <div
        key={`${block.id || block.type}-${index}`}
        className="my-3 overflow-x-auto"
      >
        <table className="w-full border-collapse border border-slate-300 text-sm">
          {data.withHeadings ? (
            <thead className="bg-slate-100">
              <tr>
                {rows[0]?.map((cell, cellIndex) => (
                  <th
                    key={`th-${cellIndex}`}
                    className="border border-slate-300 px-2 py-1 text-left font-semibold"
                    dangerouslySetInnerHTML={{ __html: cell || "" }}
                  />
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={`tr-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`td-${rowIndex}-${cellIndex}`}
                    className="border border-slate-300 px-2 py-1 align-top"
                    dangerouslySetInnerHTML={{ __html: cell || "" }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Fragment key={`${block.id || block.type}-${index}`}>
      <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Block chưa hỗ trợ preview: {block.type}
      </div>
    </Fragment>
  );
}

export function TemplatePreview({ data }: TemplatePreviewProps) {
  return (
    <div className="space-y-3">
      {data.blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
