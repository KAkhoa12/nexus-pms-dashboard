import { CheckCircle2, Copy, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicHeader } from "@/features/landing/components/PublicHeader";

type SetupStep = {
  step: string;
  title: string;
  description: string;
  commands?: string[];
};

const setupSteps: SetupStep[] = [
  {
    step: "Bước 1",
    title: "Chuẩn bị môi trường",
    description:
      "Cài Node.js 20+, pnpm, Python 3.11+, Docker Desktop và Git. Mở được terminal PowerShell.",
  },
  {
    step: "Bước 2",
    title: "Tạo thư mục cá nhân cho dự án",
    description: "Tạo thư mục bất kỳ trong máy để chuẩn bị clone 2 dự án về.",
    commands: ["mkdir smart-tenant-ai-platform", "cd smart-tenant-ai-platform"],
  },
  {
    step: "Bước 3",
    title: "Clone dự án Front End",
    description: "Lấy source code FE về thư mục đã tạo",
    commands: ["git clone https://github.com/KAkhoa12/nexus-pms-dashboard.git"],
  },
  {
    step: "Bước 4",
    title: "Clone dự án Back End",
    description: "Lấy source code BE về thư mục đã tạo",
    commands: ["git clone https://github.com/KAkhoa12/nexus-pms-service.git"],
  },
  {
    step: "Bước 5",
    title: "Cấu hình backend",
    description:
      "Tạo file .env từ .env.example, sau đó thiết lập Database, JWT secret và Google client ID.",
    commands: [
      "cd nexus-pms-service",
      "copy .env.example .env",
      "# Sau đó sửa các biến trong file .env",
    ],
  },
  {
    step: "Bước 6",
    title: "Chạy hạ tầng MySQL, Redis, MinIO trên docker",
    description:
      "Khởi động stack local bằng Docker Compose để backend có đủ services phụ trợ.",
    commands: ["docker compose up -d"],
  },
  {
    step: "Bước 7",
    title: "Cài package và migrate database",
    description:
      "Dùng uv để cài dependencies backend và chạy Alembic migration.",
    commands: ["uv sync", "alembic upgrade head"],
  },
  {
    step: "Bước 8",
    title: "Import data vào database",
    description:
      "Import data cần thiết vào database để phân quyền RABC tại file quan_ly_phong_tro.sql",
  },
  {
    step: "Bước 9",
    title: "Khởi chạy backend API",
    description: "Backend mặc định chạy ở cổng 8000.",
    commands: ["uv run uvicorn main:app --reload --port 8000"],
  },
  {
    step: "Bước 10",
    title: "Cấu hình và chạy frontend",
    description:
      "Thiết lập VITE_API_BASE_URL trỏ tới backend local, sau đó chạy app React.",
    commands: [
      "cd ..\\nexus-pms-dashboard",
      "copy .env.example .env",
      "pnpm install",
      "pnpm dev",
    ],
  },
];

const quickChecks = [
  "Frontend mở tại http://localhost:5173",
  "Backend API mở tại http://localhost:8000",
  "MySQL, Redis, MinIO đều ở trạng thái running",
  "Đăng nhập Google cần cấu hình đúng domain localhost trong Google Cloud",
];

async function copyCommandBlock(commands: string[]) {
  if (!navigator?.clipboard) return;
  try {
    await navigator.clipboard.writeText(commands.join("\n"));
  } catch {
    // no-op
  }
}

export function DocsPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f6f1] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#7dd3fc]/40 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[#86efac]/35 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-6 lg:px-10">
        <PublicHeader />

        <section className="mb-10 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] md:p-10">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-semibold text-[#166534]">
            <TerminalSquare className="h-3.5 w-3.5" />
            Self-host guide
          </p>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold md:text-5xl">
            Hướng dẫn cài đặt dự án để tự chạy local
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
            Trang này dành cho người muốn test hệ thống nhưng chưa triển khai
            cloud. Chỉ cần máy cá nhân và làm theo đúng các bước bên dưới.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {setupSteps.map((item) => (
            <Card key={item.step} className="border-slate-200 bg-white/90">
              <CardHeader className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0f766e]">
                  {item.step}
                </p>
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <p className="text-sm text-slate-600">{item.description}</p>
              </CardHeader>
              {item.commands?.length ? (
                <CardContent className="space-y-3">
                  <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
                    <code>{item.commands.join("\n")}</code>
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => void copyCommandBlock(item.commands || [])}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy lệnh
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-6">
          <h2 className="font-['Space_Grotesk'] text-2xl font-bold md:text-3xl">
            Kiểm tra nhanh sau khi setup
          </h2>
          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            {quickChecks.map((item) => (
              <p
                key={item}
                className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#0f766e]" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
