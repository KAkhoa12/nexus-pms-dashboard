import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report</h1>
        <p className="text-sm text-muted-foreground">
          Tổng hợp chỉ số vận hành và báo cáo định kỳ.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo nhanh</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Khu vực này sẽ hiển thị báo cáo doanh thu, công nợ, lấp đầy và bảo trì.
        </CardContent>
      </Card>
    </section>
  );
}
