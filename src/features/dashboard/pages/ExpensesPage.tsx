import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExpensesPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Chi tiêu</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi khoản thu chi vận hành theo kỳ.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tổng quan chi tiêu</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Khu vực này sẽ hiển thị biểu đồ chi tiêu theo chi nhánh và danh mục.
        </CardContent>
      </Card>
    </section>
  );
}
