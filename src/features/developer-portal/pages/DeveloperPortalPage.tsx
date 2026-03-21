import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowLeft, Loader2, PlusCircle, RefreshCcw, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { developerApi } from "@/features/developer-portal/api/developer.api";
import type {
  DeveloperOverview,
  DeveloperPermission,
  DeveloperUser,
  LandingSection,
  LandingSectionUpsertPayload,
  SaasPackage,
  SaasPackageFeatureInput,
  SaasPackageUpsertPayload,
} from "@/features/developer-portal/types";
import { useDeveloperAuthStore } from "@/store/developer-auth.store";

type ApiErrorBody = {
  message?: string;
};

type EditablePlan = {
  id: number;
  isNew: boolean;
  code: string;
  name: string;
  tagline: string;
  description: string;
  monthly_price: string;
  yearly_price: string;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: string;
  max_users: string;
  max_rooms: string;
  ai_task_management_enabled: boolean;
  ai_quota_monthly: string;
  features: SaasPackageFeatureInput[];
};

type EditableSection = {
  id: number;
  isNew: boolean;
  page_slug: string;
  locale: string;
  section_key: string;
  title: string;
  subtitle: string;
  body_text: string;
  content_json: string;
  cta_label: string;
  cta_url: string;
  is_published: boolean;
  sort_order: string;
};

function toPlanEditor(plan: SaasPackage): EditablePlan {
  return {
    id: plan.id,
    isNew: false,
    code: plan.code,
    name: plan.name,
    tagline: plan.tagline || "",
    description: plan.description || "",
    monthly_price: plan.monthly_price || "0",
    yearly_price: plan.yearly_price || "",
    currency: plan.currency || "VND",
    is_active: plan.is_active,
    is_featured: plan.is_featured,
    sort_order: String(plan.sort_order ?? 0),
    max_users: plan.max_users == null ? "" : String(plan.max_users),
    max_rooms: plan.max_rooms == null ? "" : String(plan.max_rooms),
    ai_task_management_enabled: plan.ai_task_management_enabled,
    ai_quota_monthly:
      plan.ai_quota_monthly == null ? "" : String(plan.ai_quota_monthly),
    features: plan.features.map((item) => ({
      feature_key: item.feature_key,
      feature_name: item.feature_name,
      feature_description: item.feature_description,
      is_included: item.is_included,
      limit_value: item.limit_value,
      sort_order: item.sort_order,
    })),
  };
}

function toSectionEditor(section: LandingSection): EditableSection {
  return {
    id: section.id,
    isNew: false,
    page_slug: section.page_slug,
    locale: section.locale,
    section_key: section.section_key,
    title: section.title || "",
    subtitle: section.subtitle || "",
    body_text: section.body_text || "",
    content_json: section.content_json || "",
    cta_label: section.cta_label || "",
    cta_url: section.cta_url || "",
    is_published: section.is_published,
    sort_order: String(section.sort_order ?? 0),
  };
}

function parseNullableNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("Giá trị số không hợp lệ.");
  }
  return parsed;
}

function parseRequiredNumber(value: string): number {
  const parsed = parseNullableNumber(value);
  if (parsed == null) {
    throw new Error("Trường số bắt buộc không được để trống.");
  }
  return parsed;
}

function toPlanPayload(plan: EditablePlan): SaasPackageUpsertPayload {
  return {
    code: plan.code.trim().toUpperCase(),
    name: plan.name.trim(),
    tagline: plan.tagline.trim() || null,
    description: plan.description.trim() || null,
    monthly_price: parseRequiredNumber(plan.monthly_price),
    yearly_price: parseNullableNumber(plan.yearly_price),
    currency: (plan.currency.trim() || "VND").toUpperCase(),
    is_active: plan.is_active,
    is_featured: plan.is_featured,
    sort_order: parseRequiredNumber(plan.sort_order),
    max_users: parseNullableNumber(plan.max_users),
    max_rooms: parseNullableNumber(plan.max_rooms),
    ai_task_management_enabled: plan.ai_task_management_enabled,
    ai_quota_monthly: parseNullableNumber(plan.ai_quota_monthly),
    features: plan.features,
  };
}

function toSectionPayload(
  section: EditableSection,
): LandingSectionUpsertPayload {
  return {
    page_slug: section.page_slug.trim() || "home",
    locale: section.locale.trim() || "vi-VN",
    section_key: section.section_key.trim(),
    title: section.title.trim() || null,
    subtitle: section.subtitle.trim() || null,
    body_text: section.body_text.trim() || null,
    content_json: section.content_json.trim() || null,
    cta_label: section.cta_label.trim() || null,
    cta_url: section.cta_url.trim() || null,
    is_published: section.is_published,
    sort_order: parseRequiredNumber(section.sort_order),
  };
}

function readErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return (
      error.response?.data?.message || error.message || "Yêu cầu thất bại."
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Yêu cầu thất bại.";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN");
}

function formatMoney(
  value: string | null | undefined,
  currency = "VND",
): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return `0 ${currency}`;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(numeric);
}

export function DeveloperPortalPage() {
  const isAuthenticated = useDeveloperAuthStore(
    (state) => state.isAuthenticated,
  );
  const isFetchingMe = useDeveloperAuthStore((state) => state.isFetchingMe);
  const accessToken = useDeveloperAuthStore((state) => state.accessToken);
  const admin = useDeveloperAuthStore((state) => state.admin);
  const login = useDeveloperAuthStore((state) => state.login);
  const fetchMe = useDeveloperAuthStore((state) => state.fetchMe);
  const logout = useDeveloperAuthStore((state) => state.logout);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [upgradingUserId, setUpgradingUserId] = useState<number | null>(null);
  const [plans, setPlans] = useState<EditablePlan[]>([]);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [permissions, setPermissions] = useState<DeveloperPermission[]>([]);
  const [permissionDescriptions, setPermissionDescriptions] = useState<
    Record<string, string>
  >({});
  const [permissionSearch, setPermissionSearch] = useState("");
  const [updatingPermissionCode, setUpdatingPermissionCode] = useState<
    string | null
  >(null);
  const [overview, setOverview] = useState<DeveloperOverview | null>(null);
  const [users, setUsers] = useState<DeveloperUser[]>([]);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userPlanSelection, setUserPlanSelection] = useState<
    Record<number, string>
  >({});
  const [dataError, setDataError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const planCount = useMemo(() => plans.length, [plans.length]);
  const sectionCount = useMemo(() => sections.length, [sections.length]);
  const filteredPermissions = useMemo(() => {
    const keyword = permissionSearch.trim().toLowerCase();
    if (!keyword) return permissions;
    return permissions.filter((item) => {
      const haystack =
        `${item.code} ${item.module} ${item.module_mean || ""} ${item.description || ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [permissionSearch, permissions]);

  useEffect(() => {
    if (accessToken && !admin) {
      void fetchMe().catch(() => undefined);
    }
  }, [accessToken, admin, fetchMe]);

  async function loadUsers(searchValue = userSearch) {
    const response = await developerApi.getUsers({
      page: 1,
      items_per_page: 50,
      search: searchValue.trim() || undefined,
    });
    setUsers(response.items);
    setUserPlanSelection((prev) => {
      const next = { ...prev };
      response.items.forEach((user) => {
        if (!next[user.id]) {
          next[user.id] = user.subscription?.package_code || "FREE";
        }
      });
      return next;
    });
  }

  async function loadData(searchValue = userSearch) {
    setLoadingData(true);
    setDataError(null);
    setSuccessMessage(null);
    try {
      const [
        overviewResponse,
        planResponse,
        sectionResponse,
        permissionResponse,
      ] = await Promise.all([
        developerApi.getOverview(),
        developerApi.getPlans({ page: 1, items_per_page: 50 }),
        developerApi.getLandingSections({ page: 1, items_per_page: 50 }),
        developerApi.getPermissions({ page: 1, items_per_page: 200 }),
      ]);
      setOverview(overviewResponse);
      setPlans(planResponse.items.map(toPlanEditor));
      setSections(sectionResponse.items.map(toSectionEditor));
      setPermissions(permissionResponse.items);
      setPermissionDescriptions(
        permissionResponse.items.reduce<Record<string, string>>((acc, item) => {
          acc[item.code] = item.description || "";
          return acc;
        }, {}),
      );
      await loadUsers(searchValue);
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated && admin) {
      void loadData();
    }
  }, [isAuthenticated, admin]);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);
    setAuthLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      setAuthError(readErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function savePlan(plan: EditablePlan) {
    try {
      setSavingId(`plan-${plan.id}`);
      const payload = toPlanPayload(plan);
      if (plan.isNew) {
        await developerApi.createPlan(payload);
      } else {
        await developerApi.updatePlan(plan.id, payload);
      }
      setSuccessMessage(`Đã lưu gói ${payload.code}.`);
      await loadData();
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function saveSection(section: EditableSection) {
    try {
      setSavingId(`section-${section.id}`);
      const payload = toSectionPayload(section);
      if (section.isNew) {
        await developerApi.createLandingSection(payload);
      } else {
        await developerApi.updateLandingSection(section.id, payload);
      }
      setSuccessMessage(`Đã lưu section ${payload.section_key}.`);
      await loadData();
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSearchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserSearch(userSearchInput);
    try {
      setLoadingData(true);
      await loadUsers(userSearchInput);
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setLoadingData(false);
    }
  }

  async function handleUpgradeUser(user: DeveloperUser) {
    const packageCode = userPlanSelection[user.id];
    if (!packageCode) {
      setDataError("Vui lòng chọn gói trước khi nâng cấp.");
      return;
    }

    try {
      setUpgradingUserId(user.id);
      await developerApi.updateUserSubscription(user.id, {
        package_code: packageCode,
        billing_cycle: "MONTHLY",
        note: "Manual upgrade from developer dashboard",
      });
      setSuccessMessage(`Đã cập nhật gói ${packageCode} cho ${user.email}.`);
      const [updatedOverview] = await Promise.all([
        developerApi.getOverview(),
        loadUsers(userSearch),
      ]);
      setOverview(updatedOverview);
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setUpgradingUserId(null);
    }
  }

  async function handleUpdatePermissionDescription(permissionCode: string) {
    const description = permissionDescriptions[permissionCode] ?? "";
    try {
      setUpdatingPermissionCode(permissionCode);
      const updated = await developerApi.updatePermissionDescription(
        permissionCode,
        {
          description: description.trim() || null,
        },
      );
      setPermissions((prev) =>
        prev.map((item) => (item.code === updated.code ? updated : item)),
      );
      setPermissionDescriptions((prev) => ({
        ...prev,
        [updated.code]: updated.description || "",
      }));
      setSuccessMessage(`Đã cập nhật mô tả quyền ${updated.code}.`);
    } catch (error) {
      setDataError(readErrorMessage(error));
    } finally {
      setUpdatingPermissionCode(null);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#134e4a] to-[#1d4ed8] px-4 py-12 text-white">
        <div className="mx-auto w-full max-w-lg space-y-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay về landing page
          </Link>
          <Card className="border-white/20 bg-white/10 text-white backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">
                Đăng nhập Dashboard Developer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="developer-email" className="text-white">
                    Email
                  </Label>
                  <Input
                    id="developer-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="developer@quanlyphongtro.local"
                    className="border-white/30 bg-white/90 text-slate-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="developer-password" className="text-white">
                    Mật khẩu
                  </Label>
                  <Input
                    id="developer-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="border-white/30 bg-white/90 text-slate-900"
                  />
                </div>
                {authError ? (
                  <p className="text-sm text-amber-200">{authError}</p>
                ) : null}
                <Button
                  type="submit"
                  className="w-full bg-[#f59e0b] text-slate-900 hover:bg-[#fbbf24]"
                  disabled={authLoading || isFetchingMe}
                >
                  {authLoading || isFetchingMe
                    ? "Đang xử lý..."
                    : "Đăng nhập quản trị"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-6 md:px-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-[#0f766e]">
              Dashboard Developer
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              Quản lý toàn bộ hệ thống SaaS
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Đăng nhập: {admin?.email || "unknown"} - {planCount} gói -{" "}
              {sectionCount} section
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Tải lại
            </Button>
            <Button variant="destructive" onClick={logout}>
              Đăng xuất
            </Button>
          </div>
        </header>

        {dataError ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {dataError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {successMessage}
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Tổng user đăng ký
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">
                {overview?.total_users ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                User đang hoạt động
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">
                {overview?.active_users ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Doanh thu thu về
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-bold text-slate-900">
                {formatMoney(
                  overview?.total_revenue,
                  overview?.currency || "VND",
                )}
              </p>
              <p className="text-xs text-slate-500">
                MRR:{" "}
                {formatMoney(
                  overview?.mrr_estimate,
                  overview?.currency || "VND",
                )}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Teams / Sub trả phí
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-slate-900">
                {overview?.total_teams ?? 0} /{" "}
                {overview?.total_paid_subscriptions ?? 0}
              </p>
              <p className="text-xs text-slate-500">
                User mới nhất: {formatDate(overview?.last_user_registered_at)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Phân bổ user theo gói</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-2 py-2">Mã gói</th>
                    <th className="px-2 py-2">Tên gói</th>
                    <th className="px-2 py-2">User</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.package_distribution || []).map((item) => (
                    <tr key={item.package_id} className="border-b">
                      <td className="px-2 py-2 font-semibold">
                        {item.package_code}
                      </td>
                      <td className="px-2 py-2">{item.package_name}</td>
                      <td className="px-2 py-2">{item.subscriber_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">
                User và nâng cấp gói thủ công
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearchUsers} className="flex gap-2">
                <Input
                  value={userSearchInput}
                  onChange={(event) => setUserSearchInput(event.target.value)}
                  placeholder="Tìm theo email hoặc họ tên"
                />
                <Button type="submit" variant="outline">
                  Tìm
                </Button>
              </form>

              <div className="max-h-[360px] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Gói hiện tại</th>
                      <th className="px-2 py-2">Ngày đăng ký</th>
                      <th className="px-2 py-2">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userItem) => (
                      <tr key={userItem.id} className="border-b">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-slate-900">
                            {userItem.email}
                          </p>
                          <p className="text-xs text-slate-500">
                            {userItem.full_name}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <p className="font-medium">
                            {userItem.subscription?.package_code || "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {userItem.subscription
                              ? formatMoney(
                                  userItem.subscription.price_amount,
                                  userItem.subscription.currency,
                                )
                              : "Chưa có gói"}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-xs text-slate-600">
                          {formatDate(userItem.created_at)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex min-w-[220px] items-center gap-2">
                            <select
                              value={userPlanSelection[userItem.id] || ""}
                              onChange={(event) =>
                                setUserPlanSelection((prev) => ({
                                  ...prev,
                                  [userItem.id]: event.target.value,
                                }))
                              }
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="">Chọn gói</option>
                              {plans
                                .filter((plan) => plan.is_active)
                                .map((plan) => (
                                  <option key={plan.id} value={plan.code}>
                                    {plan.code}
                                  </option>
                                ))}
                            </select>
                            <Button
                              size="sm"
                              className="bg-[#0f766e] text-white hover:bg-[#115e59]"
                              disabled={upgradingUserId === userItem.id}
                              onClick={() => void handleUpgradeUser(userItem)}
                            >
                              {upgradingUserId === userItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Nâng cấp"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-slate-200">
            <CardHeader className="space-y-3">
              <CardTitle className="text-lg">
                Cập nhật mô tả permission
              </CardTitle>
              <p className="text-sm text-slate-600">
                Chỉ chỉnh sửa phần mô tả hiển thị. Mã quyền (`code`) được giữ
                nguyên.
              </p>
              <div className="max-w-md">
                <Input
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder="Lọc theo code, module hoặc mô tả"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Module</th>
                    <th className="px-2 py-2">Nghĩa module</th>
                    <th className="px-2 py-2">Mô tả</th>
                    <th className="px-2 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((permission) => (
                    <tr key={permission.code} className="border-b align-top">
                      <td className="px-2 py-2 font-mono text-xs">
                        {permission.code}
                      </td>
                      <td className="px-2 py-2">{permission.module}</td>
                      <td className="px-2 py-2">
                        {permission.module_mean || "-"}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={permissionDescriptions[permission.code] || ""}
                          onChange={(event) =>
                            setPermissionDescriptions((prev) => ({
                              ...prev,
                              [permission.code]: event.target.value,
                            }))
                          }
                          placeholder="Mô tả quyền hiển thị"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          size="sm"
                          className="bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                          disabled={updatingPermissionCode === permission.code}
                          onClick={() =>
                            void handleUpdatePermissionDescription(
                              permission.code,
                            )
                          }
                        >
                          {updatingPermissionCode === permission.code ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Lưu mô tả"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredPermissions.length === 0 ? (
                    <tr>
                      <td
                        className="px-2 py-3 text-sm text-slate-500"
                        colSpan={5}
                      >
                        Không có permission phù hợp.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Gói dịch vụ
              </h2>
              <Button
                variant="outline"
                onClick={() =>
                  setPlans((prev) => [
                    {
                      id: Date.now() * -1,
                      isNew: true,
                      code: "",
                      name: "",
                      tagline: "",
                      description: "",
                      monthly_price: "0",
                      yearly_price: "",
                      currency: "VND",
                      is_active: true,
                      is_featured: false,
                      sort_order: String(prev.length + 1),
                      max_users: "",
                      max_rooms: "",
                      ai_task_management_enabled: false,
                      ai_quota_monthly: "",
                      features: [],
                    },
                    ...prev,
                  ])
                }
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Thêm gói mới
              </Button>
            </div>

            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải dữ liệu gói...
              </div>
            ) : null}

            {plans.map((plan, index) => (
              <Card key={plan.id} className="border-slate-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">
                    {plan.isNew ? "Gói mới" : `Gói #${index + 1}: ${plan.code}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Mã gói</Label>
                      <Input
                        value={plan.code}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, code: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="FREE / PRO"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tên gói</Label>
                      <Input
                        value={plan.name}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Giá tháng</Label>
                      <Input
                        value={plan.monthly_price}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, monthly_price: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Giá năm</Label>
                      <Input
                        value={plan.yearly_price}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, yearly_price: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Tagline</Label>
                    <Input
                      value={plan.tagline}
                      onChange={(event) =>
                        setPlans((prev) =>
                          prev.map((item) =>
                            item.id === plan.id
                              ? { ...item, tagline: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Mô tả</Label>
                    <textarea
                      value={plan.description}
                      onChange={(event) =>
                        setPlans((prev) =>
                          prev.map((item) =>
                            item.id === plan.id
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plan.is_active}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, is_active: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Kích hoạt
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plan.is_featured}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? { ...item, is_featured: event.target.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Nổi bật
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={plan.ai_task_management_enabled}
                        onChange={(event) =>
                          setPlans((prev) =>
                            prev.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    ai_task_management_enabled:
                                      event.target.checked,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      Có AI quản lý công việc
                    </label>
                  </div>

                  <Button
                    onClick={() => void savePlan(plan)}
                    disabled={savingId === `plan-${plan.id}`}
                    className="bg-[#0f766e] text-white hover:bg-[#115e59]"
                  >
                    {savingId === `plan-${plan.id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Lưu gói
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Landing sections
              </h2>
              <Button
                variant="outline"
                onClick={() =>
                  setSections((prev) => [
                    {
                      id: Date.now() * -1,
                      isNew: true,
                      page_slug: "home",
                      locale: "vi-VN",
                      section_key: "",
                      title: "",
                      subtitle: "",
                      body_text: "",
                      content_json: "",
                      cta_label: "",
                      cta_url: "",
                      is_published: true,
                      sort_order: String(prev.length + 1),
                    },
                    ...prev,
                  ])
                }
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Thêm section
              </Button>
            </div>

            {sections.map((section, index) => (
              <Card key={section.id} className="border-slate-200">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">
                    {section.isNew
                      ? "Section mới"
                      : `Section #${index + 1}: ${section.section_key}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Page slug</Label>
                      <Input
                        value={section.page_slug}
                        onChange={(event) =>
                          setSections((prev) =>
                            prev.map((item) =>
                              item.id === section.id
                                ? { ...item, page_slug: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Section key</Label>
                      <Input
                        value={section.section_key}
                        onChange={(event) =>
                          setSections((prev) =>
                            prev.map((item) =>
                              item.id === section.id
                                ? { ...item, section_key: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Tiêu đề</Label>
                    <Input
                      value={section.title}
                      onChange={(event) =>
                        setSections((prev) =>
                          prev.map((item) =>
                            item.id === section.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Mô tả ngắn</Label>
                    <textarea
                      value={section.subtitle}
                      onChange={(event) =>
                        setSections((prev) =>
                          prev.map((item) =>
                            item.id === section.id
                              ? { ...item, subtitle: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Nội dung chính</Label>
                    <textarea
                      value={section.body_text}
                      onChange={(event) =>
                        setSections((prev) =>
                          prev.map((item) =>
                            item.id === section.id
                              ? { ...item, body_text: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <Button
                    onClick={() => void saveSection(section)}
                    disabled={savingId === `section-${section.id}`}
                    className="bg-[#1d4ed8] text-white hover:bg-[#1e40af]"
                  >
                    {savingId === `section-${section.id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Lưu section
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
