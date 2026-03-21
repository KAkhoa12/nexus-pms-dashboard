import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth.store";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome, {user?.fullName ?? user?.email ?? "User"}.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Occupied Rooms</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">120</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending Invoices</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">18</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Open Tickets</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">7</CardContent>
        </Card>
      </div>
    </section>
  );
}
