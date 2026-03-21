export type DeletedMode = "active" | "trash" | "all";

export type Area = {
  id: number;
  tenant_id: number;
  branch_id: number;
  name: string;
  address: string | null;
  deleted_at: string | null;
};

export type Branch = {
  id: number;
  tenant_id: number;
  name: string;
  deleted_at: string | null;
};

export type Building = {
  id: number;
  tenant_id: number;
  area_id: number;
  name: string;
  total_floors: number;
  deleted_at: string | null;
};

export type RoomType = {
  id: number;
  tenant_id: number;
  name: string;
  base_price: string;
  pricing_mode: "FIXED" | "PER_PERSON";
  default_occupancy: number;
  max_occupancy: number;
  deleted_at: string | null;
};

export type Room = {
  id: number;
  tenant_id: number;
  branch_id: number;
  area_id: number;
  building_id: number;
  room_type_id: number;
  floor_number: number;
  code: string;
  current_status: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
  current_price: string;
  deleted_at: string | null;
};

export type Renter = {
  id: number;
  tenant_id: number;
  full_name: string;
  phone: string;
  identity_type: string | null;
  id_number: string | null;
  email: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  deleted_at: string | null;
};

export type RenterMember = {
  id: number;
  tenant_id: number;
  renter_id: number;
  full_name: string;
  phone: string;
  identity_type: string | null;
  id_number: string | null;
  email: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  relation: string | null;
  deleted_at: string | null;
};

export type InvoiceItem = {
  id: number;
  tenant_id: number;
  invoice_id: number;
  fee_type_id: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  deleted_at: string | null;
};

export type Invoice = {
  id: number;
  tenant_id: number;
  branch_id: number;
  room_id: number;
  renter_id: number;
  period_month: string;
  due_date: string;
  total_amount: string;
  paid_amount: string;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  content: string;
  content_html: string;
  deleted_at: string | null;
  items: InvoiceItem[];
};

export type Lease = {
  id: number;
  tenant_id: number;
  branch_id: number;
  room_id: number;
  room_code: string | null;
  renter_id: number;
  renter_full_name: string | null;
  renter_phone: string | null;
  created_by_user_id: number | null;
  lease_years: number;
  handover_at: string | null;
  start_date: string;
  end_date: string | null;
  rent_price: string;
  pricing_mode: "FIXED" | "PER_PERSON";
  status: "ACTIVE" | "ENDED" | "CANCELLED";
  content: string;
  content_html: string;
  security_deposit_amount: string;
  security_deposit_paid_amount: string;
  security_deposit_payment_method: "CASH" | "BANK" | "QR" | null;
  security_deposit_paid_at: string | null;
  security_deposit_note: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Deposit = {
  id: number;
  tenant_id: number;
  lease_id: number | null;
  room_id: number;
  renter_id: number | null;
  branch_id: number;
  amount: string;
  method: "CASH" | "BANK" | "QR";
  status: "HELD" | "REFUNDED" | "FORFEITED";
  paid_at: string;
  content_html: string;
  deleted_at: string | null;
};
