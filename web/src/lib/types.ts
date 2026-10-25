// Mirrors api/ROUTES.md response shapes (camelCase) — this API is now the
// source of truth for these shapes, not a Postgres/Supabase table anymore.

export type Profile = {
  id: string;
  displayName: string | null;
  countryOfResidence: string | null;
  preferredCurrency: string;
  upiVpa: string | null;
  upiName: string | null;
  role: "owner" | "tenant";
};

export type TenantProfile = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  currentCity: string | null;
  employer: string | null;
  kycStatus: "pending" | "submitted" | "verified";
  createdAt: string;
};

export type TenantDocument = {
  id: string;
  tenantUserId: string;
  docType: "agreement" | "kyc" | "property_paper" | "tax" | "other";
  title: string;
  storagePath: string;
  createdAt: string;
};

export type ProfileShare = {
  id: string;
  tenantUserId: string;
  ownerId: string | null;
  status: "open" | "claimed" | "revoked";
  createdAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
};

export type PayLink = {
  id: string;
  ownerId: string;
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  openedAt: string | null;
  claimedPaidAt: string | null;
  createdAt: string;
};

export type Property = {
  id: string;
  ownerId: string;
  nickname: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  propertyType: "apartment" | "independent_house" | "villa" | "plot" | "commercial";
  bedrooms: number | null;
  notes: string | null;
  createdAt: string;
};

export type Tenant = {
  id: string;
  ownerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  kycStatus: "pending" | "submitted" | "verified";
  notes: string | null;
  tenantUserId: string | null;
  createdAt: string;
};

export type Lease = {
  id: string;
  ownerId: string;
  propertyId: string;
  tenantId: string;
  rentAmount: number;
  depositAmount: number | null;
  startDate: string;
  endDate: string | null;
  rentDueDay: number;
  status: "active" | "ended";
  createdAt: string;
};

export type RentPayment = {
  id: string;
  ownerId: string;
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid: number | null;
  paidOn: string | null;
  method: "bank_transfer" | "upi" | "cash" | "other" | null;
  status: "due" | "paid" | "partial";
  notes: string | null;
};

export type IntakeLink = {
  id: string;
  ownerId: string;
  propertyId: string | null;
  status: "pending" | "submitted";
  tenantId: string | null;
  createdAt: string;
  submittedAt: string | null;
  expiresAt: string;
};

export type PropertyListing = {
  id: string;
  ownerId: string;
  propertyId: string;
  baseRentAsk: number;
  minLeaseMonths: number | null;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
};

export type PublicListing = {
  id: string;
  baseRentAsk: number;
  minLeaseMonths: number | null;
  createdAt: string;
  title: string;
  city: string;
  state: string;
  pincode: string;
  propertyType: Property["propertyType"];
  bedrooms: number | null;
  // Presigned R2 URL, minted per request and valid ~10 minutes — render it,
  // don't cache it. null when the owner hasn't uploaded any photos.
  coverPhotoUrl: string | null;
  photoCount: number;
};

// Owner-side photo row, from GET /properties/:id/photos.
export type PropertyPhoto = {
  id: string;
  propertyId: string;
  ownerId: string;
  storagePath: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
  url: string;
};

// Tenant-side view of the same photo, from GET /listings/:id/photos. Carries
// no storagePath — the raw R2 key starts with the owner's user id and is never
// exposed to a tenant.
export type ListingPhoto = {
  id: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
  url: string;
};

export type PropertyApplication = {
  id: string;
  listingId: string;
  ownerId: string;
  applicantUserId: string;
  proposedRent: number;
  moveInDate: string;
  monthlyIncome: number | null;
  profileHighlights: string | null;
  status: "under_review" | "kyc_requested" | "approved" | "rejected" | "withdrawn";
  intakeLinkId: string | null;
  createdAt: string;
  rentVariancePct: number;
};

export type ApplicationMessage = {
  id: string;
  applicationId: string;
  senderUserId: string;
  senderRole: "owner" | "tenant";
  body: string;
  createdAt: string;
};

export type OwnApplication = PropertyApplication & {
  propertyNickname: string;
  propertyCity: string;
};

export type ListingApplicant = PropertyApplication & {
  incomeToRentRatio: number | null;
  creditScoreRange: null;
  applicantFullName: string | null;
  applicantCurrentCity: string | null;
  applicantEmployer: string | null;
  applicantKycStatus: TenantProfile["kycStatus"] | null;
};

export type ListingApplicationsResponse = {
  listing: PropertyListing;
  marketSignals: {
    offerVolume: number;
    highestProposedRent: number | null;
    averageProposedRent: number | null;
    earliestMoveInDate: string | null;
  };
  applicants: ListingApplicant[];
};

export type DocumentRow = {
  id: string;
  ownerId: string;
  propertyId: string | null;
  leaseId: string | null;
  docType: "agreement" | "kyc" | "property_paper" | "tax" | "other";
  title: string;
  storagePath: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Identity KYC (PAN / Aadhaar OTP) — api/ROUTES.md "Identity KYC"
// ---------------------------------------------------------------------------

// Note there is no full document number anywhere in this type, by design: the
// API stores only a masked form and a keyed fingerprint, so there is nothing
// sensitive for the browser to receive or for us to accidentally cache.
export type IdentityVerification = {
  id: string;
  kind: "pan" | "aadhaar";
  tenantId: string | null;
  tenantUserId: string | null;
  ownerId: string | null;
  numberMasked: string;
  status: "pending" | "verified" | "name_mismatch" | "not_found" | "failed" | "not_configured";
  provider: string | null;
  verifiedName: string | null;
  expectedName: string | null;
  nameMatchScore: string | null;
  errorMessage: string | null;
  verifiedAt: string | null;
  createdAt: string;
  // Only present on the response to a fresh check — true means an earlier
  // result inside its freshness window was reused instead of paying again.
  cached?: boolean;
};

export type AadhaarOtpStart = {
  alreadyVerified: boolean;
  // true when a live session was handed back rather than a new OTP being sent.
  reused: boolean;
  sessionId: string | null;
  numberMasked: string;
  expiresAt: string | null;
};

// ---------------------------------------------------------------------------
// e-Sign lease agreements — api/ROUTES.md "e-Sign lease agreements"
// ---------------------------------------------------------------------------

export type LeaseAgreementSigner = {
  id: string;
  agreementId: string;
  role: "landlord" | "tenant";
  signOrder: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: "pending" | "notified" | "signed" | "declined";
  signUrl: string | null;
  signUrlExpiresAt: string | null;
  notifiedAt: string | null;
  signedAt: string | null;
  createdAt: string;
};

export type LeaseAgreement = {
  id: string;
  leaseId: string;
  ownerId: string;
  status: "draft" | "sent" | "partially_signed" | "completed" | "declined" | "expired" | "failed";
  provider: string | null;
  providerRef: string | null;
  unsignedStoragePath: string;
  signedStoragePath: string | null;
  contentHash: string;
  sentAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type LeaseAgreementResponse = {
  agreement: LeaseAgreement;
  signers: LeaseAgreementSigner[];
  // Presigned R2 URL for whichever PDF exists — signed copy if there is one,
  // else the draft. Valid ~10 minutes; render it, don't store it.
  downloadUrl: string;
};

// ---------------------------------------------------------------------------
// Utility bills (BBPS) — api/ROUTES.md "Utility bills"
// ---------------------------------------------------------------------------

export type UtilityCategory =
  | "electricity"
  | "water"
  | "gas"
  | "broadband"
  | "dth"
  | "mobile"
  | "maintenance"
  | "other";

export type UtilityAccount = {
  id: string;
  propertyId: string;
  ownerId: string;
  category: UtilityCategory;
  billerId: string;
  billerName: string | null;
  // Masked by the API (****1234) — the full consumer number is never returned.
  consumerNumber: string;
  nickname: string | null;
  active: boolean;
  lastFetchedAt: string | null;
  nextFetchAfter: string | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
  createdAt: string;
};

export type UtilityBill = {
  id: string;
  accountId: string;
  ownerId: string;
  billPeriodKey: string;
  billNumber: string | null;
  billDate: string | null;
  dueDate: string | null;
  amountDue: string;
  status: "PAID" | "UNPAID" | "UNKNOWN";
  provider: string | null;
  fetchedAt: string;
  lastAlertedAt: string | null;
  alertCount: number;
  createdAt: string;
};
