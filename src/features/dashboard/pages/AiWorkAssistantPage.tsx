import { Bot, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AiWorkAssistantPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bot className="h-5 w-5 text-primary" />
          AI xử lý công việc
        </h1>
        <p className="text-sm text-muted-foreground">
          Trợ lý AI hỗ trợ phân tích công việc vận hành và gợi ý hành động theo
          dữ liệu workspace Business.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Hỏi trợ lý AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
              Ví dụ: "Tóm tắt công việc bảo trì cần ưu tiên tuần này theo team
              hiện tại."
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Nhập yêu cầu cho trợ lý AI..." />
              <Button>Gửi</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wand2 className="h-4 w-4 text-primary" />
              Tác vụ nhanh
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline">
              Tạo checklist vận hành hôm nay
            </Button>
            <Button className="w-full justify-start" variant="outline">
              Tổng hợp cảnh báo hóa đơn trễ hạn
            </Button>
            <Button className="w-full justify-start" variant="outline">
              Đề xuất phân công theo team
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
