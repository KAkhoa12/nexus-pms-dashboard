import { Navigate, createBrowserRouter, useParams } from "react-router-dom";
import { AreasPage } from "@/features/areas";
import { AppLayout } from "@/app/layout/AppLayout";
import { AuthLayout, NotFoundPage } from "@/app/layout/AuthLayout";
import {
  PackageGuard,
  PermissionGuard,
  ProtectedRoute,
} from "@/app/router/guards";
import { LoginPage } from "@/features/auth";
import { BranchesPage } from "@/features/branches";
import { BuildingsPage } from "@/features/buildings";
import {
  ContractsCreatePage,
  ContractsDetailPage,
  ContractsPage,
} from "@/features/contracts";
import { DeveloperPortalPage } from "@/features/developer-portal";
import {
  ApartmentMapPage,
  AiWorkAssistantPage,
  DashboardPage,
  ExpensesPage,
  NotificationsCenterPage,
  PlaceholderPage,
  ReportsPage,
  TeamChatPage,
} from "@/features/dashboard";
import { DepositDetailPage, DepositsPage } from "@/features/deposits";
import { FormTemplatesPage } from "@/features/form-templates";
import { InvoicesPage } from "@/features/invoices";
import { LandingPage } from "@/features/landing";
import { PermissionsPage } from "@/features/permissions";
import { CustomerAppointmentsPage } from "@/features/customer-appointments";
import { CustomerDetailPage, CustomersPage } from "@/features/customers";
import { RenterMembersPage } from "@/features/renter-members";
import { RentersPage } from "@/features/renters";
import { RoomTypesPage } from "@/features/room-types";
import { RoomsPage } from "@/features/rooms";
import {
  MaterialsAssetsPage,
  MaterialsAssetTypesPage,
  RoomAssetsDetailPage,
  RoomAssetsPage,
} from "@/features/materials-assets";
import { ServiceFeesPage } from "@/features/service-fees";
import { UsersPage } from "@/features/users";

function LegacyDepositRedirect() {
  const { depositId } = useParams<{ depositId?: string }>();
  return (
    <Navigate
      to={
        depositId ? `/dashboard/deposits/${depositId}` : "/dashboard/deposits"
      }
      replace
    />
  );
}

function LegacyFormTemplateEditRedirect() {
  const { templateId } = useParams<{ templateId?: string }>();
  return (
    <Navigate
      to={
        templateId
          ? `/dashboard/settings/forms/${templateId}/edit`
          : "/dashboard/settings/forms"
      }
      replace
    />
  );
}

function LegacyContractDetailRedirect() {
  const { leaseId } = useParams<{ leaseId?: string }>();
  return (
    <Navigate
      to={leaseId ? `/dashboard/contracts/${leaseId}` : "/dashboard/contracts"}
      replace
    />
  );
}

function LegacyRoomAssetsDetailRedirect() {
  const { roomId } = useParams<{ roomId?: string }>();
  return (
    <Navigate
      to={
        roomId ? `/dashboard/room-assets/${roomId}` : "/dashboard/room-assets"
      }
      replace
    />
  );
}

function LegacyRoomAssetEditRedirect() {
  const { roomId, assetId } = useParams<{
    roomId?: string;
    assetId?: string;
  }>();
  return (
    <Navigate
      to={
        roomId && assetId
          ? `/dashboard/room-assets/${roomId}/assets/${assetId}/edit`
          : "/dashboard/room-assets"
      }
      replace
    />
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <Navigate to="/dashboard/login" replace /> },
  {
    path: "/apartment-map",
    element: <Navigate to="/dashboard/apartment-map" replace />,
  },
  { path: "/expenses", element: <Navigate to="/dashboard/expenses" replace /> },
  { path: "/reports", element: <Navigate to="/dashboard/reports" replace /> },
  { path: "/branches", element: <Navigate to="/dashboard/branches" replace /> },
  { path: "/areas", element: <Navigate to="/dashboard/areas" replace /> },
  {
    path: "/buildings",
    element: <Navigate to="/dashboard/buildings" replace />,
  },
  {
    path: "/room-types",
    element: <Navigate to="/dashboard/room-types" replace />,
  },
  { path: "/rooms", element: <Navigate to="/dashboard/rooms" replace /> },
  { path: "/renters", element: <Navigate to="/dashboard/renters" replace /> },
  {
    path: "/renter-members",
    element: <Navigate to="/dashboard/renter-members" replace />,
  },
  { path: "/invoices", element: <Navigate to="/dashboard/invoices" replace /> },
  {
    path: "/customer-appointments",
    element: <Navigate to="/dashboard/customer-appointments" replace />,
  },
  {
    path: "/service-fees",
    element: <Navigate to="/dashboard/service-fees" replace />,
  },
  { path: "/deposits", element: <Navigate to="/dashboard/deposits" replace /> },
  { path: "/deposits/:depositId", element: <LegacyDepositRedirect /> },
  { path: "/deposite/:depositId", element: <LegacyDepositRedirect /> },
  {
    path: "/contracts",
    element: <Navigate to="/dashboard/contracts" replace />,
  },
  {
    path: "/contracts/create",
    element: <Navigate to="/dashboard/contracts/create" replace />,
  },
  {
    path: "/contracts/:leaseId",
    element: <LegacyContractDetailRedirect />,
  },
  {
    path: "/customers",
    element: <Navigate to="/dashboard/customers" replace />,
  },
  {
    path: "/materials-assets",
    element: <Navigate to="/dashboard/materials-assets" replace />,
  },
  {
    path: "/materials-asset-types",
    element: <Navigate to="/dashboard/materials-asset-types" replace />,
  },
  {
    path: "/room-assets",
    element: <Navigate to="/dashboard/room-assets" replace />,
  },
  { path: "/room-assets/:roomId", element: <LegacyRoomAssetsDetailRedirect /> },
  {
    path: "/room-assets/:roomId/assets/:assetId/edit",
    element: <LegacyRoomAssetEditRedirect />,
  },
  {
    path: "/finance-overview",
    element: <Navigate to="/dashboard/finance-overview" replace />,
  },
  { path: "/cashflow", element: <Navigate to="/dashboard/cashflow" replace /> },
  {
    path: "/notifications",
    element: <Navigate to="/dashboard/notifications" replace />,
  },
  {
    path: "/team-chat",
    element: <Navigate to="/dashboard/team-chat" replace />,
  },
  {
    path: "/ai-assistant",
    element: <Navigate to="/dashboard/ai-assistant" replace />,
  },
  {
    path: "/reports/apartments/vacant",
    element: <Navigate to="/dashboard/reports/apartments/vacant" replace />,
  },
  {
    path: "/reports/apartments/upcoming-vacant",
    element: (
      <Navigate to="/dashboard/reports/apartments/upcoming-vacant" replace />
    ),
  },
  {
    path: "/reports/apartments/occupancy-rate",
    element: (
      <Navigate to="/dashboard/reports/apartments/occupancy-rate" replace />
    ),
  },
  {
    path: "/reports/finance/debtors",
    element: <Navigate to="/dashboard/reports/finance/debtors" replace />,
  },
  {
    path: "/reports/finance/payment-schedule",
    element: (
      <Navigate to="/dashboard/reports/finance/payment-schedule" replace />
    ),
  },
  {
    path: "/reports/finance/deposit-list",
    element: <Navigate to="/dashboard/reports/finance/deposit-list" replace />,
  },
  {
    path: "/reports/finance/cashflow",
    element: <Navigate to="/dashboard/reports/finance/cashflow" replace />,
  },
  {
    path: "/settings/forms",
    element: <Navigate to="/dashboard/settings/forms" replace />,
  },
  {
    path: "/settings/forms/new",
    element: <Navigate to="/dashboard/settings/forms/new" replace />,
  },
  {
    path: "/settings/forms/:templateId/edit",
    element: <LegacyFormTemplateEditRedirect />,
  },
  { path: "/users", element: <Navigate to="/dashboard/users" replace /> },
  {
    path: "/permissions",
    element: <Navigate to="/dashboard/permissions" replace />,
  },
  {
    path: "/permision",
    element: <Navigate to="/dashboard/permision" replace />,
  },
  {
    element: <AuthLayout />,
    children: [{ path: "/dashboard/login", element: <LoginPage /> }],
  },
  {
    path: "/dashboard-developer",
    element: <DeveloperPortalPage />,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "expenses", element: <ExpensesPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "apartment-map", element: <ApartmentMapPage /> },
      {
        path: "branches",
        element: (
          <PermissionGuard permissions={["user:mangage", "branches:view"]}>
            <BranchesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "areas",
        element: (
          <PermissionGuard permissions={["user:mangage", "areas:view"]}>
            <AreasPage />
          </PermissionGuard>
        ),
      },
      {
        path: "buildings",
        element: (
          <PermissionGuard permissions={["user:mangage", "buildings:view"]}>
            <BuildingsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "room-types",
        element: (
          <PermissionGuard permissions={["user:mangage", "room_types:view"]}>
            <RoomTypesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "rooms",
        element: (
          <PermissionGuard permissions={["user:mangage", "rooms:view"]}>
            <RoomsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "renters",
        element: (
          <PermissionGuard permissions={["user:mangage", "renters:view"]}>
            <RentersPage />
          </PermissionGuard>
        ),
      },
      {
        path: "renter-members",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "renter_members:view",
              "renters:view",
            ]}
          >
            <RenterMembersPage />
          </PermissionGuard>
        ),
      },
      {
        path: "invoices",
        element: (
          <PermissionGuard permissions={["user:mangage", "invoices:view"]}>
            <InvoicesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "customer-appointments",
        element: (
          <PermissionGuard
            permissions={["user:mangage", "customer_appointments:view"]}
          >
            <CustomerAppointmentsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "service-fees",
        element: (
          <PermissionGuard permissions={["user:mangage", "service_fees:view"]}>
            <ServiceFeesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "deposits",
        element: (
          <PermissionGuard permissions={["user:mangage", "deposits:view"]}>
            <DepositsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "deposite/:depositId",
        element: (
          <PermissionGuard permissions={["user:mangage", "deposits:view"]}>
            <DepositDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "deposits/:depositId",
        element: (
          <PermissionGuard permissions={["user:mangage", "deposits:view"]}>
            <DepositDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "contracts",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "leases:view",
              "lease:view",
              "leases:create",
              "lease:create",
              "leases:manage",
            ]}
          >
            <ContractsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "contracts/create",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "leases:view",
              "lease:view",
              "leases:create",
              "lease:create",
              "leases:manage",
            ]}
          >
            <ContractsCreatePage />
          </PermissionGuard>
        ),
      },
      {
        path: "contracts/:leaseId",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "leases:view",
              "lease:view",
              "leases:create",
              "lease:create",
              "leases:manage",
            ]}
          >
            <ContractsDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "customers",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "renters:view",
              "renter_members:view",
            ]}
          >
            <CustomersPage />
          </PermissionGuard>
        ),
      },
      {
        path: "customers/:customerType/:customerId",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "renters:view",
              "renter_members:view",
            ]}
          >
            <CustomerDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "materials-assets",
        element: (
          <PermissionGuard
            permissions={["user:mangage", "materials_assets:view"]}
          >
            <MaterialsAssetsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "materials-asset-types",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "materials_assets:view",
              "materials_asset_types:view",
            ]}
          >
            <MaterialsAssetTypesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "room-assets",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "materials_assets:view",
              "rooms:view",
              "room:view",
            ]}
          >
            <RoomAssetsPage />
          </PermissionGuard>
        ),
      },
      {
        path: "room-assets/:roomId",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "materials_assets:view",
              "rooms:view",
              "room:view",
            ]}
          >
            <RoomAssetsDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "room-assets/:roomId/assets/:assetId/edit",
        element: (
          <PermissionGuard
            permissions={[
              "user:mangage",
              "materials_assets:view",
              "materials_assets:update",
              "rooms:view",
              "room:view",
            ]}
          >
            <RoomAssetsDetailPage />
          </PermissionGuard>
        ),
      },
      {
        path: "finance-overview",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Tổng quan tài chính" />
          </PermissionGuard>
        ),
      },
      {
        path: "cashflow",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Thu chi" />
          </PermissionGuard>
        ),
      },
      {
        path: "notifications",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <NotificationsCenterPage />
          </PackageGuard>
        ),
      },
      {
        path: "team-chat",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <TeamChatPage />
          </PackageGuard>
        ),
      },
      {
        path: "ai-assistant",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <AiWorkAssistantPage />
          </PackageGuard>
        ),
      },
      {
        path: "reports/apartments/vacant",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Căn hộ trống" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/apartments/upcoming-vacant",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Căn hộ sắp trống" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/apartments/occupancy-rate",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Tỷ lệ lấp đầy" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/finance/debtors",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Khách nợ tiền" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/finance/payment-schedule",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Lịch thanh toán" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/finance/deposit-list",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Danh sách tiền cọc" />
          </PermissionGuard>
        ),
      },
      {
        path: "reports/finance/cashflow",
        element: (
          <PermissionGuard permissions={["user:mangage"]}>
            <PlaceholderPage title="Dòng tiền" />
          </PermissionGuard>
        ),
      },
      {
        path: "settings/forms",
        element: (
          <PermissionGuard
            permissions={["user:mangage", "form_templates:view"]}
          >
            <FormTemplatesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "settings/forms/new",
        element: (
          <PermissionGuard
            permissions={["user:mangage", "form_templates:create"]}
          >
            <FormTemplatesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "settings/forms/:templateId/edit",
        element: (
          <PermissionGuard
            permissions={["user:mangage", "form_templates:update"]}
          >
            <FormTemplatesPage />
          </PermissionGuard>
        ),
      },
      {
        path: "users",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <PermissionGuard permissions={["users:view", "user:mangage"]}>
              <UsersPage />
            </PermissionGuard>
          </PackageGuard>
        ),
      },
      {
        path: "permissions",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <PermissionGuard
              permissions={[
                "users:permissions:manage",
                "users:permissions:create",
                "users:permissions:update",
                "users:permissions:delete",
                "user:permision:view",
                "user:mangage",
              ]}
            >
              <PermissionsPage />
            </PermissionGuard>
          </PackageGuard>
        ),
      },
      {
        path: "permision",
        element: (
          <PackageGuard packageCodes={["BUSINESS"]}>
            <PermissionGuard
              permissions={[
                "users:permissions:manage",
                "users:permissions:create",
                "users:permissions:update",
                "users:permissions:delete",
                "user:permision:view",
                "user:mangage",
              ]}
            >
              <PermissionsPage />
            </PermissionGuard>
          </PackageGuard>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
