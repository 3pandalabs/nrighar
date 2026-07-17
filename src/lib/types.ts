export type Profile = {
  id: string;
  display_name: string | null;
  country_of_residence: string | null;
  preferred_currency: string;
};

export type Property = {
  id: string;
  owner_id: string;
  nickname: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  property_type: "apartment" | "independent_house" | "villa" | "plot" | "commercial";
  notes: string | null;
  created_at: string;
};

export type Tenant = {
  id: string;
  owner_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  kyc_status: "pending" | "submitted" | "verified";
  notes: string | null;
  created_at: string;
};

export type Lease = {
  id: string;
  owner_id: string;
  property_id: string;
  tenant_id: string;
  rent_amount: number;
  deposit_amount: number | null;
  start_date: string;
  end_date: string | null;
  rent_due_day: number;
  status: "active" | "ended";
  created_at: string;
};

export type RentPayment = {
  id: string;
  owner_id: string;
  lease_id: string;
  period_year: number;
  period_month: number;
  amount_due: number;
  amount_paid: number | null;
  paid_on: string | null;
  method: "bank_transfer" | "upi" | "cash" | "other" | null;
  status: "due" | "paid" | "partial";
  notes: string | null;
};

export type DocumentRow = {
  id: string;
  owner_id: string;
  property_id: string | null;
  lease_id: string | null;
  doc_type: "agreement" | "kyc" | "property_paper" | "tax" | "other";
  title: string;
  storage_path: string;
  created_at: string;
};
