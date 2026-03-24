import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PublicHeader } from "@/features/landing/components/PublicHeader";

type DemoItem = {
  title: string;
  imageUrl: string;
  description: string;
};

type DemoSection = {
  packageCode: "FREE" | "PRO" | "BUSINESS";
  packageName: string;
  packageTag: string;
  accentClass: string;
  items: DemoItem[];
};

const freeDemoFiles = [
  "free_dashboard.png",
  "free_dashboard_apartment-map.png",
  "free_dashboad_search.png",
  "free_dashboad_areas.png",
  "free_dashboad_branchs.png",
  "free_dashboad_buildings.png",
  "free_dashboad_rooms.png",
  "free_dashboad_room_types.png",
  "free_dashboad_contract.png",
  "free_dashboad_contract_detail.png",
  "free_dashboad_contract_installments_detail.png",
  "free_dashboad_customers.png",
  "free_dashboad_customers_detail.png",
  "free_dashboad_customer-appointments.png",
  "free_dashboad_form_template.png",
  "free_dashboad_form_template_edit.png",
  "free_dashboad_services_fee.png",
  "free_dashboad_materials_assets_types_customer.png",
  "free_dashboad_materials_assets_types_room.png",
  "free_dashboad_room-assets.png",
  "free_dashboad_room-assets_detail.png",
];

const proDemoFiles = ["pro_theme_sunset_mint.png", "pro_theme_aurora.png"];

const businessDemoFiles = [
  "bussiness_users.png",
  "bussiness_permision.png",
  "bussiness_notifycation.png",
  "bussiness_chat_team.png",
  "bussiness_chat_ai.png",
];

function toTitleFromFileName(fileName: string): string {
  const normalized = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^free_dashboad_/, "")
    .replace(/^free_dashboard_/, "")
    .replace(/^free_/, "")
    .replace(/^pro_/, "")
    .replace(/^bussiness_/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!normalized) return "Demo chức năng";
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildDemoItems(
  files: string[],
  packageName: string,
  packageDescription: string,
): DemoItem[] {
  return files.map((fileName) => ({
    title: toTitleFromFileName(fileName),
    imageUrl: `/demo/${fileName}`,
    description: `${packageName} - ${packageDescription}`,
  }));
}

const demoSections: DemoSection[] = [
  {
    packageCode: "FREE",
    packageName: "Gói Free",
    packageTag: "Quản lý phòng trọ cơ bản",
    accentClass: "from-[#ecfeff] to-[#f0fdfa] text-[#0f766e]",
    items: buildDemoItems(
      freeDemoFiles,
      "Gói Free",
      "Nghiệp vụ quản lý vận hành nhà trọ cơ bản",
    ),
  },
  {
    packageCode: "PRO",
    packageName: "Gói Pro",
    packageTag: "Thêm AI + giao diện nâng cao",
    accentClass: "from-[#0f172a] to-[#0f766e] text-white",
    items: buildDemoItems(
      proDemoFiles,
      "Gói Pro",
      "Theme nâng cao và trải nghiệm vận hành cao cấp",
    ),
  },
  {
    packageCode: "BUSINESS",
    packageName: "Gói Business",
    packageTag: "Nâng cấp cộng tác đội nhóm",
    accentClass: "from-[#fff7ed] to-[#ffedd5] text-[#9a3412]",
    items: buildDemoItems(
      businessDemoFiles,
      "Gói Business",
      "Quản lý nhân sự, thông báo, chat nội bộ và AI team",
    ),
  },
];

export function DemoPage() {
  const [viewerState, setViewerState] = useState<{
    sectionCode: DemoSection["packageCode"];
    itemIndex: number;
  } | null>(null);

  const activeSection = useMemo(() => {
    if (!viewerState) return null;
    return (
      demoSections.find(
        (item) => item.packageCode === viewerState.sectionCode,
      ) || null
    );
  }, [viewerState]);

  const activeItem = useMemo(() => {
    if (!activeSection || !viewerState) return null;
    return activeSection.items[viewerState.itemIndex] || null;
  }, [activeSection, viewerState]);

  function handleOpenViewer(
    sectionCode: DemoSection["packageCode"],
    itemIndex: number,
  ) {
    setViewerState({ sectionCode, itemIndex });
  }

  function handleSlide(direction: "prev" | "next") {
    if (!activeSection || !viewerState) return;
    const total = activeSection.items.length;
    if (total <= 1) return;
    const step = direction === "next" ? 1 : -1;
    const nextIndex = (viewerState.itemIndex + step + total) % total;
    setViewerState({
      sectionCode: viewerState.sectionCode,
      itemIndex: nextIndex,
    });
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f6f1] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-20 h-80 w-80 rounded-full bg-[#99f6e4]/45 blur-3xl" />
        <div className="absolute right-0 top-16 h-96 w-96 rounded-full bg-[#fde68a]/45 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-8 md:px-6 lg:px-10">
        <PublicHeader />

        <section className="mb-10 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)] md:p-10">
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold md:text-5xl">
            Demo giao diện theo từng gói
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
            Mỗi section mô tả nhóm tính năng tương ứng từng gói. Nhấn vào ảnh để
            xem chi tiết và slide qua lại trong cùng section đó.
          </p>
        </section>

        <section className="space-y-7">
          {demoSections.map((section) => (
            <Card
              key={section.packageCode}
              className="border-slate-200 bg-white/95"
            >
              <CardHeader>
                <div
                  className={`inline-flex w-fit rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold ${section.accentClass}`}
                >
                  {section.packageName}
                </div>
                <CardTitle className="font-['Space_Grotesk'] text-2xl">
                  {section.packageTag}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() =>
                        handleOpenViewer(section.packageCode, index)
                      }
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="relative aspect-video w-full overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-black/60 to-transparent p-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-900">
                            <Eye className="h-3.5 w-3.5" />
                            Xem
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-slate-600">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <p className="mt-8 text-center text-sm font-medium text-slate-600">
          Chúng tôi vẫn đang phát triển các tính năng mới sau.
        </p>
      </main>

      <Dialog
        open={Boolean(viewerState && activeItem && activeSection)}
        onOpenChange={(open) => {
          if (!open) setViewerState(null);
        }}
      >
        <DialogContent className="max-w-5xl border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>{activeItem?.title || "Chi tiết demo"}</DialogTitle>
            <DialogDescription>
              {activeSection?.packageName || "--"} -{" "}
              {activeItem?.description || ""}
            </DialogDescription>
          </DialogHeader>

          <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <img
              src={activeItem?.imageUrl}
              alt={activeItem?.title}
              className="h-auto max-h-[68vh] w-full rounded-xl object-contain"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2"
              onClick={() => handleSlide("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={() => handleSlide("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {activeSection ? (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
              {activeSection.items.map((item, index) => {
                const isActive = index === viewerState?.itemIndex;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() =>
                      setViewerState((prev) =>
                        prev
                          ? {
                              sectionCode: prev.sectionCode,
                              itemIndex: index,
                            }
                          : null,
                      )
                    }
                    className={`overflow-hidden rounded-lg border transition ${
                      isActive
                        ? "border-[#0f766e] ring-2 ring-[#0f766e]/35"
                        : "border-slate-200"
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-16 w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
