import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const freeFeatures = [
  "Quản lý phòng trọ, khách thuê, hóa đơn cơ bản",
  "Dashboard vận hành theo chi nhánh/khu vực",
  "Phân quyền nhân sự theo module",
];

const proFeatures = [
  "Tất cả tính năng gói Free",
  "AI quản lý công việc: giao việc, nhắc việc, tổng hợp tiến độ",
  "Theme Sunset Mint cao cấp trong dashboard",
  "Theme Aurora Pro độc quyền lấy cảm hứng từ giao diện gói Pro",
];

const businessFeatures = [
  "Tất cả tính năng gói Pro với quota AI cao hơn",
  "Chat với hệ thống AI để hỗ trợ vận hành",
  "Chat nội bộ giữa các user trong doanh nghiệp",
  "Ưu đãi chi phí theo năm cho đội nhóm lớn",
];

const highlights = [
  {
    icon: Building2,
    title: "Chuẩn SaaS đa tenant",
    description:
      "Mỗi doanh nghiệp vận hành độc lập, an toàn dữ liệu và dễ mở rộng.",
  },
  {
    icon: Bot,
    title: "AI cho vận hành",
    description:
      "Tự động hóa nhắc việc, ưu tiên việc tồn đọng và hỗ trợ điều phối đội vận hành.",
  },
  {
    icon: Wand2,
    title: "Bắt đầu nhanh",
    description:
      "Chọn gói, tạo cấu trúc chi nhánh, đưa hệ thống vào dùng ngay trong ngày.",
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f7f5ef] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-[#f6c87f]/55 blur-3xl" />
        <div className="absolute right-0 top-32 h-80 w-80 rounded-full bg-[#66c7b4]/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#ffc59f]/40 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-8 md:px-6 lg:px-10">
        <header className="mb-16 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <img
              src="/logo.png"
              alt="QuanLyPhongTro"
              className="h-16 w-auto object-contain"
            />
            <span className="text-2xl font-bold">House Smart Business</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              className="bg-[#0f766e] text-white hover:bg-[#115e59]"
            >
              <Link to="/dashboard/login">
                Đăng nhập hệ thống <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/85 px-6 py-12 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] md:px-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#fff1d8] px-3 py-1 text-xs font-semibold text-[#8a4f00]">
            <Sparkles className="h-3.5 w-3.5" />
            Nền tảng cho cá nhân và doanh nghiệp cho thuê phòng
          </div>
          <h1 className="max-w-4xl font-['Space_Grotesk'] text-4xl font-bold leading-tight md:text-6xl">
            Quản lý phòng trọ thông minh với{" "}
            <span className="text-[#0f766e]">3 gói Free, Pro và Business</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
            Gói Free giúp bạn vận hành nhà trọ ổn định. Gói Pro mở rộng AI quản
            lý công việc và theme cao cấp. Gói Business thêm chat nội bộ và chat
            với hệ thống cho doanh nghiệp.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              asChild
              className="h-11 bg-[#0f766e] px-5 text-white hover:bg-[#115e59]"
            >
              <Link to="/dashboard/login">
                Vào dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] hover:bg-[#e0e7ff]"
            >
              <Link to="#pricing">Xem bảng giá</Link>
            </Button>
          </div>
        </section>

        <section className="mt-14 grid gap-5 md:grid-cols-3">
          {highlights.map((item) => (
            <Card
              key={item.title}
              className="border-slate-200/80 bg-white/80 backdrop-blur"
            >
              <CardHeader className="pb-3">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0fdfa] text-[#0f766e]">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl text-[#0f766e] font-bold">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                {item.description}
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="pricing" className="mt-16 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#0f766e]">
              Pricing
            </p>
            <h2 className="font-['Space_Grotesk'] text-3xl font-bold md:text-4xl">
              Chọn gói phù hợp quy mô vận hành
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-2xl">
                  Gói Free
                  <span className="rounded-full bg-[#ecfeff] px-3 py-1 text-sm font-medium text-[#0f766e]">
                    0đ/tháng
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {freeFeatures.map((feature) => (
                  <p key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#0f766e]" />
                    <span>{feature}</span>
                  </p>
                ))}
                <Button
                  asChild
                  className="mt-3 w-full bg-[#0f766e] text-white hover:bg-[#115e59]"
                >
                  <Link to="/dashboard/login">Dùng ngay gói Free</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="relative border-[#f59e0b] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f766e] text-slate-100 shadow-xl">
              <div className="absolute right-4 top-4 rounded-full bg-[#f59e0b] px-3 py-1 text-xs font-semibold text-slate-900">
                Phổ biến
              </div>
              <CardHeader className="mt-5">
                <CardTitle className="flex items-center justify-between text-2xl">
                  Gói Pro
                  <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
                    299.000đ/tháng
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-100/95">
                {proFeatures.map((feature) => (
                  <p key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#fcd34d]" />
                    <span>{feature}</span>
                  </p>
                ))}
                <Button
                  asChild
                  className="mt-3 w-full bg-white text-slate-900 hover:bg-slate-100"
                >
                  <Link to="/dashboard/login">Đăng ký gói Pro</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-[#fb923c]/60 bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-[#fffbeb]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-2xl text-[#9a3412]">
                  Gói Business
                  <span className="rounded-full bg-[#fed7aa] px-3 py-1 text-sm font-medium text-[#9a3412]">
                    599.000đ/tháng
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {businessFeatures.map((feature) => (
                  <p key={feature} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#c2410c]" />
                    <span>{feature}</span>
                  </p>
                ))}
                <Button
                  asChild
                  className="mt-3 w-full bg-[#c2410c] text-white hover:bg-[#9a3412]"
                >
                  <Link to="/dashboard/login">Đăng ký gói Business</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
