import { toast } from "sonner";

// Keep API requests on the dashboard origin. The dev-server and hosting
// rewrites proxy this path to the API, avoiding browser CORS checks.
const API_BASE_URL = "/api/v1";
const SESSION_KEY = "safishapro_admin_session";
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function isUploadWithinLimit(file: File, maxBytes: number, label: string) {
  if (file.size <= maxBytes) return true;
  const maxMegabytes = Math.floor(maxBytes / (1024 * 1024));
  toast.error(`${label} must be ${maxMegabytes} MB or smaller.`);
  return false;
}

export function dispatchLiveUrl() {
  const session = getStoredSession();
  if (!session?.access_token) return null;
  const url = new URL(`${API_BASE_URL}/bookings/dispatch/live`, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", session.access_token);
  return url.toString();
}

export type Permission = {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
  is_active: boolean;
};
export type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
};
export type ApiUser = {
  id: string;
  full_name: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  role: Pick<Role, "id" | "name" | "slug">;
  permissions: Permission[];
  is_active: boolean;
  phone_verified: boolean;
  email_verified: boolean;
  profile_photo_url: string | null;
  has_reference_form: boolean;
  has_contract: boolean;
  has_identity_document: boolean;
  has_kra_document: boolean;
  has_good_conduct_document: boolean;
  last_login_at: string | null;
  gender: "male" | "female" | "non_binary" | "other" | "prefer_not_to_say" | null;
  nationality: string | null;
  residency_latitude: number | null;
  residency_longitude: number | null;
  date_of_birth: string | null;
  address_description: string | null;
  city: string | null;
  preferred_language: string | null;
  registration_data: Record<string, unknown>;
  password_set: boolean;
  profile_complete: boolean;
  missing_required_fields: MissingRegistrationField[];
  created_at: string;
  updated_at: string;
};
export type MissingRegistrationField = {
  field: string;
  label: string;
  input_type: string;
  required: boolean;
  options: string[];
};
export type PropertyTypeField = {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "boolean";
  required: boolean;
  options: string[];
};
export type PropertyType = {
  id: string;
  name: string;
  pricing_property_size: string;
  is_active: boolean;
  fields: PropertyTypeField[];
  created_at: string;
  updated_at: string;
};
export type RegistrationField = {
  id: string;
  key: string;
  label: string;
  input_type: "text" | "email" | "number" | "date" | "boolean" | "single_choice" | "multiple_choice" | "password";
  required: boolean;
  options: string[];
  help_text: string | null;
  position: number;
  is_active: boolean;
};
export type TokenData = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  app_type?: "web" | "mobile";
  expires_in_seconds: number;
  profile_complete: boolean;
  missing_required_fields: MissingRegistrationField[];
  role: ApiUser["role"];
  permissions: Permission[];
  user: ApiUser;
};
export type Session = TokenData & { expires_at: number };
export type OtpLog = {
  id: string;
  phone: string;
  otp: string | null;
  attempts: number;
  consumed: boolean;
  expires_at: string;
  created_at: string;
  state: "active" | "verified" | "expired" | "locked";
};
export type OtpSummary = {
  total_sent: number;
  verified: number;
  active: number;
  expired: number;
  locked: number;
};
export type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
export type UserActivity = { user_id: string; last_login_at: string | null; events: AuditLog[] };
export type AdminUserDetails = {
  user: ApiUser;
  active_bookings: Array<{ id: string; status: string; [key: string]: unknown }>;
  past_bookings: Array<{ id: string; status: string; [key: string]: unknown }>;
  active_subscriptions: Array<{ id: string; status: string; [key: string]: unknown }>;
  past_subscriptions: Array<{ id: string; status: string; [key: string]: unknown }>;
};
export type DashboardKpi = {
  key: string;
  label: string;
  value: number | string;
  unit: string | null;
  delta_percentage: number | null;
  direction: "up" | "down" | "flat" | "new" | null;
  description: string | null;
};
export type DashboardSection = {
  key: string;
  title: string;
  description: string;
  kpis: DashboardKpi[];
  trends: Array<{ key: string; label: string; points: Array<{ date: string; value: number }> }>;
  breakdowns: Array<{ key: string; label: string; value: number; percentage: number | null }>;
};
export type DashboardSummary = {
  generated_at: string;
  period: {
    mode: string;
    timezone: string;
    start_date: string;
    end_date: string;
    days: number | null;
  };
  applied_filters: Record<string, string | boolean | null>;
  scope: {
    user_id: string;
    role: string;
    is_system_administrator: boolean;
    permission_slugs: string[];
    visible_sections: string[];
  };
  sections: DashboardSection[];
  user_performance: {
    metric: "audit_log_actions";
    disclaimer: string;
    total_contributors: number;
    users: Array<{
      rank: number;
      user_id: string;
      full_name: string;
      role: string;
      is_active: boolean;
      recorded_actions: number;
      previous_recorded_actions: number;
      delta_percentage: number | null;
      direction: "up" | "down" | "flat" | "new";
      last_action_at: string | null;
      top_action: string | null;
    }>;
  } | null;
};
export type DecisionKpi = {
  key?: string;
  label?: string;
  value?: number | string | null;
  previous_value?: number | string | null;
  delta_percentage?: number | null;
  direction?: "up" | "down" | "flat" | "new" | null;
  [key: string]: unknown;
};
export type DecisionPoint = { date: string; value: number; [key: string]: unknown };
export type DecisionSection = {
  key: "bookings" | "payments" | "finance" | "operations";
  title: string;
  decision_use: string;
  kpis: DecisionKpi[];
  series: Array<{ key: string; label: string; unit: string | null; points: DecisionPoint[] }>;
  breakdowns: Array<{ key: string; label: string; value: number; percentage: number | null }>;
};
export type DecisionSummary = {
  start_date: string;
  end_date: string;
  comparison_start_date: string;
  comparison_end_date: string;
  currency: string | null;
  granularity: "daily" | "weekly" | "monthly";
  sections: DecisionSection[];
  limitations: string[];
};
export type Booking = {
  id: string;
  customer_id: string;
  service_type_id: string;
  service_package_id: string;
  service_name: string;
  package_name: string | null;
  cleaner: { id: string; full_name: string; phone: string | null; rating: number | null } | null;
  assigned_at?: string | null;
  assignment_status?: "not_ready" | "awaiting_assignment" | "assigned";
  recurring_plan?: Subscription | null;
  cycle_number?: number | null;
  session_number?: number | null;
  status: string;
  scheduled_for: string;
  quoted_price: string | number;
  currency: string;
  city: string | null;
  address_line: string | null;
  latitude?: number | null;
  longitude?: number | null;
  special_instructions: string | null;
  additional_notes?: string | null;
  property_size?: string | null;
  property_type?: PropertyType | null;
  property_details?: Record<string, unknown>;
  rooms?: number | null;
  bathrooms?: number | null;
  pricing_snapshot?: Record<string, unknown> | null;
  additional_services?: Array<{ name?: string; quantity?: number; amount?: string | number; [key: string]: unknown }>;
  status_events: Array<{ created_at: string; status?: string; from_status?: string | null; to_status?: string | null; note: string | null }>;
};
export type Payment = {
  gateway_environment?: "sandbox" | "production" | null;
  reconciliation_required?: boolean;
  payment_channel?: string;
  wallet_amount?: string | number;
  external_amount?: string | number;
  id: string;
  payment_number: string;
  booking_id: string;
  booking_invoice: string;
  customer_id: string;
  customer_name: string;
  amount: string | number;
  currency: string;
  provider: "simulated" | "mpesa";
  status: string;
  phone_number: string | null;
  checkout_request_id?: string | null;
  receipt_number: string | null;
  result_code?: string | null;
  result_description?: string | null;
  failure_reason?: string | null;
  retry_count?: number;
  initiated_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at?: string;
  booking_status: string | null;
  events: Array<{
    event_key: string;
    from_status: string | null;
    to_status: string | null;
    note: string | null;
    created_at: string;
  }>;
};
export type Payout = {
  id: string;
  booking_id: string;
  booking: {
    id: string;
    name: string;
    location: {
      address_line: string;
      city: string | null;
      latitude: number;
      longitude: number;
    };
  };
  cleaner_id: string;
  cleaner_name: string;
  amount: string | number;
  currency: string;
  status: "pending" | "approved" | "paid" | "voided" | string;
  provider: string;
  provider_reference: string | null;
  note: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  events: Array<{
    from_status: string | null;
    to_status: string;
    note: string | null;
    created_at: string;
  }>;
};
export type SupportTicket = {
  id: string;
  customer_id: string;
  customer_name: string;
  booking_id: string | null;
  assigned_to_user_id: string | null;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
};
export type ServicePackage = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  currency: string;
  pricing_model: string;
  billing_cycle: string;
  category?: string | null;
  visits_per_cycle?: number | null;
  commitment_cycles?: number | null;
  included_items?: string[];
  is_active: boolean;
  price_tiers: Array<{
    id: string;
    name: string;
    minimum_quantity: number;
    maximum_quantity: number | null;
    price: string | number;
    is_active: boolean;
  }>;
};
export type ServiceAddon = {
  id: string;
  name: string;
  description: string | null;
  rate: string | number;
  currency: string;
  applies_per_session: boolean;
  maximum_quantity: number | null;
  is_active: boolean;
};
export type Service = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  base_price: string | number;
  estimated_duration_minutes: number;
  is_active: boolean;
  packages: ServicePackage[];
  sub_services: Service[];
  additional_services: ServiceAddon[];
};
export type CleanerSkill = {
  id: string;
  name: string;
  description: string | null;
  service_ids: string[];
  services: Array<Pick<Service, "id" | "name" | "slug">>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type Cleaner = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  national_id: string | null;
  kra_pin: string | null;
  passport_number: string | null;
  good_conduct_certificate_number: string | null;
  other_document_reference: string | null;
  profile_photo_url: string | null;
  has_kyc_document: boolean;
  has_identity_document: boolean;
  has_kra_document: boolean;
  has_good_conduct_document: boolean;
  has_reference_form: boolean;
  has_contract: boolean;
  custom_kyc_document_types?: string[];
  service_area: string;
  skill_ids: string[];
  skills: CleanerSkill[];
  status: "active" | "inactive" | "suspended";
  last_completed_job_at?: string | null;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  rating: string | number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stats?: {
    total_sessions: number;
    completed_sessions: number;
    upcoming_sessions: number;
    cancelled_sessions: number;
    no_show_sessions: number;
    total_reviews: number;
    average_rating: string | number;
    completion_rate: number;
    paid_payouts: number;
    pending_payouts: number;
    total_earnings_by_currency: Record<string, string | number>;
  };
  recent_reviews?: Array<{ rating: number; review: string | null; created_at: string }>;
  job_history?: Array<{
    booking_id: string;
    service_name: string;
    package_name: string | null;
    status: string;
    scheduled_for: string;
    city: string | null;
    address_line: string;
    quoted_price: string | number;
    currency: string;
    assigned_at: string | null;
    completed_at: string | null;
  }>;
  payout_history?: Array<{
    payout_id: string;
    booking_id: string;
    amount: string | number;
    currency: string;
    status: string;
    provider_reference: string | null;
    note: string | null;
    approved_at: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  audit_history?: Array<{
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    action: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }>;
};
export type CleanerKycDocumentType = { code: string; label: string; required: boolean; is_active: boolean; position: number };
export type Subscription = {
  subscription_name: string;
  customer_name: string;
  service_package_id: string;
  visits_per_cycle: number;
  commitment_cycles: number;
  id: string;
  customer_id: string;
  package_id: string;
  status: "active" | "paused" | "cancelled" | "completed";
  billing_cycle: string;
  price_per_cycle: string | number;
  currency: string;
  starts_on: string;
  ends_on: string | null;
  next_service_date: string | null;
  session_days_of_month: number[];
  visit_count: number;
  commitment_total: number | null;
};
export type SubscriptionDetails = {
  subscription: Subscription;
  sessions: Booking[];
  session_count: number;
  commitment_total: string | number;
};
export type SubscriptionPage = {
  subscriptions: Subscription[];
  status_counts: Record<string, number>;
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};
type ApiEnvelope<T> = { isSucces: boolean; message: string; data: T };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Array<{ loc: string[]; msg: string }>,
  ) {
    super(message);
  }
}

export function getStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(data: TokenData) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ ...data, expires_at: Date.now() + data.expires_in_seconds * 1000 }),
  );
}
export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean; retry?: boolean } = {},
): Promise<T> {
  const { authenticated = true, retry = true, headers, ...init } = options;
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes((init.method ?? "GET").toUpperCase());
  const notify = (kind: "success" | "error", message: string) => {
    if (typeof window !== "undefined" && isMutation) toast[kind](message);
  };
  let session = getStoredSession();
  if (
    authenticated &&
    retry &&
    session?.refresh_token &&
    session.expires_at - Date.now() < 60_000
  ) {
    try {
      await authApi.refresh(session.refresh_token);
      session = getStoredSession();
    } catch {
      clearStoredSession();
      window.dispatchEvent(new Event("safishapro:session-expired"));
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(authenticated && session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...headers,
      },
    });
  } catch (cause) {
    notify("error", "Network error. Please check your connection and try again.");
    throw cause;
  }
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (response.status === 401 && authenticated && retry && session?.refresh_token) {
    try {
      await authApi.refresh(session.refresh_token);
      return request<T>(path, { ...options, retry: false });
    } catch {
      clearStoredSession();
      window.dispatchEvent(new Event("safishapro:session-expired"));
    }
  }
  if (response.status === 403 && authenticated)
    window.dispatchEvent(new Event("safishapro:access-changed"));
  if (!response.ok || !payload?.isSucces) {
    const errors =
      payload?.data && typeof payload.data === "object" && "errors" in payload.data
        ? (payload.data as { errors?: Array<{ loc: string[]; msg: string }> }).errors
        : undefined;
    const message = payload?.message ?? "The request could not be completed.";
    const detail = errors?.[0]?.msg;
    notify("error", detail ? `${message}: ${detail}` : message);
    throw new ApiError(response.status, detail ? `${message}: ${detail}` : message, errors);
  }
  notify("success", payload.message || "Operation completed successfully.");
  return payload.data;
}
const json = (method: string, body?: unknown) => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function authenticatedFileBlob(path: string) {
  let session = getStoredSession();
  if (!session) throw new ApiError(401, "Please sign in to view this document.");
  if (session.refresh_token && session.expires_at - Date.now() < 60_000) {
    await authApi.refresh(session.refresh_token);
    session = getStoredSession();
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new ApiError(response.status, payload?.message ?? "Unable to open this document.");
  }
  return response.blob();
}

async function openAuthenticatedFile(path: string) {
  const viewer = window.open("about:blank", "_blank");
  if (!viewer) throw new ApiError(0, "Allow pop-ups to view the KYC document.");
  try {
    const objectUrl = URL.createObjectURL(await authenticatedFileBlob(path));
    viewer.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (cause) {
    viewer.close();
    throw cause;
  }
}

export const authApi = {
  login: async (identifier: string, password: string) => {
    const data = await request<TokenData>("/auth/login", {
      ...json("POST", { identifier, password, appType: "web" }),
      authenticated: false,
    });
    saveSession(data);
    return data;
  },
  me: () => request<ApiUser>("/auth/me"),
  access: () => request<{ role: ApiUser["role"]; permissions: Permission[] }>("/users/me/access"),
  refresh: async (refresh_token: string) => {
    const data = await request<TokenData>("/auth/refresh", {
      ...json("POST", { refresh_token, appType: "web" }),
      authenticated: false,
    });
    saveSession(data);
    return data;
  },
  logout: (refresh_token: string) =>
    request<null>("/auth/logout", { ...json("POST", { refresh_token }), authenticated: false }),
  requestPasswordReset: (email: string) =>
    request<{ development_token: string | null }>("/auth/password-reset/request", {
      ...json("POST", { email }),
      authenticated: false,
    }),
  confirmPasswordReset: (token: string, new_password: string) =>
    request<null>("/auth/password-reset/confirm", {
      ...json("POST", { token, new_password }),
      authenticated: false,
    }),
  requestPhoneOtp: (phone: string) =>
    request<{
      expires_in_seconds: number;
      resend_after_seconds: number;
      development_otp: string | null;
    }>("/auth/register/phone", { ...json("POST", { phone }), authenticated: false }),
  verifyPhoneOtp: (phone: string, code: string, full_name?: string) =>
    request<TokenData>("/auth/verify-otp", {
      ...json("POST", { phone, code, appType: "web", ...(full_name ? { full_name } : {}) }),
      authenticated: false,
    }),
};

export const rolesApi = {
  permissions: () => request<Permission[]>("/admin/permissions"),
  groupedPermissions: () =>
    request<Array<{ group: string; resource: string; permissions: Permission[] }>>(
      "/admin/permissions/grouped",
    ),
  getPermission: (id: string) => request<Permission>(`/admin/permissions/${id}`),
  list: () => request<Role[]>("/admin/roles"),
  get: (id: string) => request<Role>(`/admin/roles/${id}`),
  create: (body: { name: string; description?: string; permission_ids: string[] }) =>
    request<Role>("/admin/roles", json("POST", body)),
  update: (id: string, body: Partial<Pick<Role, "name" | "description" | "is_active">>) =>
    request<Role>(`/admin/roles/${id}`, json("PATCH", body)),
  remove: (id: string) => request<null>(`/admin/roles/${id}`, { method: "DELETE" }),
  replacePermissions: (id: string, permission_ids: string[]) =>
    request<Role>(`/admin/roles/${id}/permissions`, json("PUT", { permission_ids })),
  addPermission: (id: string, permissionId: string) =>
    request<Role>(`/admin/roles/${id}/permissions/${permissionId}`, { method: "POST" }),
  removePermission: (id: string, permissionId: string) =>
    request<Role>(`/admin/roles/${id}/permissions/${permissionId}`, { method: "DELETE" }),
};

export const propertyTypesApi = {
  list: (includeInactive = true) => request<PropertyType[]>(`/admin/property-types${query({ include_inactive: includeInactive })}`),
  create: (body: Omit<PropertyType, "id" | "created_at" | "updated_at">) => request<PropertyType>("/admin/property-types", json("POST", body)),
  update: (id: string, body: Partial<Omit<PropertyType, "id" | "created_at" | "updated_at">>) => request<PropertyType>(`/admin/property-types/${id}`, json("PATCH", body)),
  deactivate: (id: string) => request<PropertyType>(`/admin/property-types/${id}`, { method: "DELETE" }),
};

export const registrationFieldsApi = {
  list: () => request<RegistrationField[]>("/admin/registration-fields"),
  replace: (fields: Array<Omit<RegistrationField, "id">>) =>
    request<RegistrationField[]>("/admin/registration-fields", json("PUT", { fields })),
};

export const usersApi = {
  list: (accountType?: "staff" | "client" | "customer" | "cleaner", search?: string) =>
    request<ApiUser[]>(`/admin/users${query({ account_type: accountType, search })}`),
  staffPhotoUrl: (id: string) => request<{ url: string }>(`/users/${id}/profile-photo-url`),
  uploadStaffPhoto: (id: string, photo: File) => {
    const body = new FormData();
    body.append("photo", photo);
    return request<ApiUser>(`/users/staff/${id}/profile-photo`, { method: "POST", body });
  },
  clientPlaceholder: () => request<{ url: string }>("/users/client-placeholder"),
  cleanerPlaceholder: () => request<{ url: string }>("/users/cleaner-placeholder"),
  myProfilePhotoUrl: () => request<{ url: string }>("/users/me/profile-photo-url"),
  uploadMyProfilePhoto: (photo: File) => {
    const body = new FormData();
    body.append("photo", photo);
    return request<ApiUser>("/users/me/profile-photo", { method: "POST", body });
  },
  uploadMyStaffDocument: (type: "reference-form" | "contract", document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<ApiUser>(`/users/me/staff-documents/${type}`, { method: "POST", body });
  },
  viewMyStaffDocument: (type: "reference-form" | "contract") =>
    openAuthenticatedFile(`/users/me/staff-documents/${type}/content`),
  getMyStaffDocumentPreview: (type: "reference-form" | "contract") =>
    authenticatedFileBlob(`/users/me/staff-documents/${type}/content`),
  uploadMyStaffKycDocument: (type: "identity" | "kra" | "good-conduct", document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<ApiUser>(`/users/me/staff-kyc-documents/${type}`, { method: "POST", body });
  },
  viewMyStaffKycDocument: (type: "identity" | "kra" | "good-conduct") =>
    openAuthenticatedFile(`/users/me/staff-kyc-documents/${type}/content`),
  getMyStaffKycDocumentPreview: (type: "identity" | "kra" | "good-conduct") =>
    authenticatedFileBlob(`/users/me/staff-kyc-documents/${type}/content`),
  get: (id: string) => request<AdminUserDetails>(`/admin/users/${id}`),
  uploadStaffDocument: (id: string, type: "reference-form" | "contract", document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<ApiUser>(`/users/${id}/staff-documents/${type}`, { method: "POST", body });
  },
  viewStaffDocument: (id: string, type: "reference-form" | "contract") =>
    openAuthenticatedFile(`/users/${id}/staff-documents/${type}/content`),
  getStaffDocumentPreview: (id: string, type: "reference-form" | "contract") =>
    authenticatedFileBlob(`/users/${id}/staff-documents/${type}/content`),
  uploadStaffKycDocument: (id: string, type: "identity" | "kra" | "good-conduct", document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<ApiUser>(`/users/${id}/staff-kyc-documents/${type}`, { method: "POST", body });
  },
  viewStaffKycDocument: (id: string, type: "identity" | "kra" | "good-conduct") =>
    openAuthenticatedFile(`/users/${id}/staff-kyc-documents/${type}/content`),
  getStaffKycDocumentPreview: (id: string, type: "identity" | "kra" | "good-conduct") =>
    authenticatedFileBlob(`/users/${id}/staff-kyc-documents/${type}/content`),
  updateMyProfile: (
    body: Partial<{
      address_description: string;
      city: string;
      date_of_birth: string;
      email: string;
      full_name: string;
      gender: "male" | "female" | "non_binary" | "other" | "prefer_not_to_say";
      nationality: string;
      password: string;
      preferred_language: string;
      residency_latitude: number;
      residency_longitude: number;
      username: string;
    }>,
  ) => request<ApiUser>("/users/me", json("PATCH", body)),
  createStaff: (body: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    role_id: string;
  }) => request<ApiUser>("/admin/staff", json("POST", body)),
  update: (
    id: string,
    body: Partial<
      Pick<
        ApiUser,
        | "full_name"
        | "username"
        | "email"
        | "phone"
        | "gender"
        | "nationality"
        | "residency_latitude"
        | "residency_longitude"
        | "city"
      >
    >,
  ) => request<ApiUser>(`/admin/users/${id}`, json("PATCH", body)),
  assignRole: (id: string, role_id: string) =>
    request<ApiUser>(`/admin/users/${id}/role`, json("PATCH", { role_id })),
  suspend: (id: string) => request<ApiUser>(`/admin/users/${id}/suspend`, { method: "POST" }),
  reactivate: (id: string) => request<ApiUser>(`/admin/users/${id}/reactivate`, { method: "POST" }),
  deactivate: (id: string) => request<ApiUser>(`/admin/users/${id}`, { method: "DELETE" }),
  ban: (id: string, reason: string) =>
    request<ApiUser>(`/admin/users/${id}/ban`, json("POST", { reason })),
  unban: (id: string) => request<ApiUser>(`/admin/users/${id}/unban`, { method: "POST" }),
  activity: (id: string, limit = 100) =>
    request<UserActivity>(`/admin/users/${id}/activity?limit=${Math.min(100, Math.max(1, limit))}`),
  setStaffStatus: (id: string, is_active: boolean) =>
    request<ApiUser>(`/admin/staff/${id}/status`, json("PATCH", { is_active })),
  setStaffPassword: (id: string, new_password: string, confirm_password: string) =>
    request<null>(`/admin/staff/${id}/password`, json("PUT", { new_password, confirm_password })),
};
export const monitoringApi = {
  otpLogs: (limit = 100) =>
    request<OtpLog[]>(`/admin/otp-logs?limit=${Math.min(500, Math.max(1, limit))}`),
  otpSummary: () => request<OtpSummary>("/admin/otp-logs/summary"),
  auditLogs: (params: { limit?: number; action?: string; target_type?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.limit) search.set("limit", String(Math.min(500, Math.max(1, params.limit))));
    if (params.action) search.set("action", params.action);
    if (params.target_type) search.set("target_type", params.target_type);
    return request<AuditLog[]>(`/admin/audit-logs${search.size ? `?${search}` : ""}`);
  },
};
const query = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return search.size ? `?${search}` : "";
};
export const bookingsApi = {
  list: (
    params: {
      status?: string;
      start_date?: string;
      end_date?: string;
      city?: string;
      cleaner_id?: string;
      service_type_id?: string;
      customer_id?: string;
      assignment_status?: "not_ready" | "awaiting_assignment" | "assigned";
      search?: string;
      active_only?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) => request<Booking[]>(`/bookings${query(params)}`),
  get: (id: string) => request<Booking>(`/bookings/${id}`),
  propertyTypes: () => request<PropertyType[]>("/bookings/property-types"),
  propertySizes: () => request<Array<{ value: string; label: string }>>("/bookings/property-sizes"),
  create: (body: Record<string, unknown>) => request<Booking>("/bookings", json("POST", body)),
  quote: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/bookings/quote", json("POST", body)),
  reschedule: (id: string, scheduled_for: string) =>
    request<Booking>(`/bookings/${id}/reschedule`, json("PATCH", { scheduled_for })),
  cancel: (id: string, reason: string) =>
    request<Booking>(`/bookings/${id}/cancel`, json("POST", { reason })),
  statusTransitions: (id: string) => request<{ booking_id: string; current_status: string; allowed_transitions: Array<{ status: string; action_label: string }> }>(`/bookings/${id}/status-transitions`),
  changeStatus: (id: string, status: string, note?: string) =>
    request<Booking>(
      `/bookings/${id}/status`,
      json("PATCH", { status, ...(note ? { note } : {}) }),
    ),
  assignCleaner: (id: string, cleaner_id: string, note?: string) =>
    request<Booking>(
      `/bookings/${id}/assignment`,
      json("PUT", { cleaner_id, ...(note ? { note } : {}) }),
    ),
  packageSummary: (params: Record<string, string>) =>
    request<Record<string, unknown>>(`/bookings/package-summary${query(params)}`),
  focusedSession: () =>
    request<{ mode: "active" | "upcoming" | "none"; booking: Booking | null; message: string }>(
      "/bookings/sessions/focus",
    ),
  matches: (id: string) =>
    request<
      Array<{
        cleaner_id: string;
        full_name: string;
        service_area: string;
        rating: number | null;
        distance_km: number | null;
        current_assignments: number;
        score: number;
      }>
    >(`/bookings/${id}/matches`),
  autoDispatch: (id: string) =>
    request<Booking>(`/bookings/${id}/auto-dispatch`, { method: "POST" }),
  dispatchCalendar: (params: {
    start_date: string;
    end_date: string;
    cleaner_id?: string;
    status?: string;
  }) => request<Array<Record<string, unknown>>>(`/bookings/dispatch/calendar${query(params)}`),
  createCleanerChange: (id: string, body: { reason: string; requested_cleaner_id?: string }) =>
    request<Record<string, unknown>>(`/bookings/${id}/cleaner-change-requests`, json("POST", body)),
  resolveCleanerChange: (
    id: string,
    body: { status: "approved" | "rejected"; cleaner_id?: string; note?: string },
  ) =>
    request<Record<string, unknown>>(
      `/bookings/cleaner-change-requests/${id}`,
      json("PATCH", body),
    ),
  raiseAlarm: (
    id: string,
    body: {
      alarm_type: string;
      severity: "low" | "medium" | "high" | "emergency";
      message: string;
    },
  ) => request<Record<string, unknown>>(`/bookings/${id}/alarms`, json("POST", body)),
  resolveAlarm: (id: string, body: { status: "acknowledged" | "resolved"; note?: string }) =>
    request<Record<string, unknown>>(`/bookings/alarms/${id}`, json("PATCH", body)),
  contacts: (id: string) => request<Array<Record<string, unknown>>>(`/bookings/${id}/contacts`),
  logContact: (
    id: string,
    body: { cleaner_id: string; channel: "call" | "sms" | "whatsapp"; outcome?: string },
  ) => request<Record<string, unknown>>(`/bookings/${id}/contacts`, json("POST", body)),
};
export const paymentsApi = {
  list: (
    params: {
      status?: string;
      booking_id?: string;
      customer_id?: string;
      method?: "simulated" | "mpesa";
      date_from?: string;
      date_to?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) => request<Payment[]>(`/payments${query(params)}`),
  customerPayments: (customerId: string, params: { status?: string; limit?: number; offset?: number } = {}) =>
    request<Payment[]>(`/payments/customers/${customerId}${query(params)}`),
  get: (id: string) => request<Payment>(`/payments/${id}`),
  initiate: (booking_id: string, phone_number?: string) =>
    request<Payment>(
      "/payments",
      json("POST", { booking_id, ...(phone_number ? { phone_number } : {}) }),
    ),
  subscriptionHistory: (subscriptionId: string) => request<Payment[]>(`/payments/subscriptions/${subscriptionId}`),
  initiateSubscription: (subscriptionId: string, booking_id?: string, phone_number?: string) =>
    request<Payment>(`/payments/subscriptions/${subscriptionId}/initiate`, json("POST", {
      ...(booking_id ? { booking_id } : {}),
      ...(phone_number ? { phone_number } : {}),
    })),
  refresh: (id: string) => request<Payment>(`/payments/${id}/refresh`, json("POST", {})),
  retryStk: (booking_id: string, phone_number: string) =>
    request<Payment>("/payments", json("POST", { booking_id, phone_number, use_wallet: false })),
  markBookingPaid: (
    bookingId: string,
    body: { receipt_number: string; note?: string; idempotency_key: string },
  ) => request<Payment>(`/payments/bookings/${bookingId}/mark-paid`, json("POST", body)),
  simulate: (
    id: string,
    outcome: "successful" | "failed" | "timed_out",
    reason?: string,
    idempotency_key?: string,
  ) =>
    request<Payment>(
      `/payments/${id}/simulate`,
      json("POST", {
        outcome,
        ...(reason ? { reason } : {}),
        ...(idempotency_key ? { idempotency_key } : {}),
      }),
    ),
  summary: (params: Record<string, string> = {}) =>
    request<Record<string, unknown>>(`/payments/summary${query(params)}`),
  failed: (params: Record<string, string | number> = {}) =>
    request<Record<string, unknown>>(`/payments/failed${query(params)}`),
  receipt: (id: string) => request<Record<string, unknown>>(`/payments/${id}/receipt`),
  exportUrl: (params: Record<string, string>) => `${API_BASE_URL}/payments/export${query(params)}`,
  receiptPdfUrl: (id: string) => `${API_BASE_URL}/payments/${id}/receipt.pdf`,
};
export type CommissionSetting = { commission_rate_percent: number | string };
export const financeSettingsApi = {
  get: () => request<CommissionSetting>("/admin/commission-settings"),
  update: (body: CommissionSetting) => request<CommissionSetting>("/admin/commission-settings", json("PUT", body)),
};
export const payoutsApi = {
  list: (params: { cleaner_id?: string; status?: string; date_from?: string; date_to?: string } = {}) =>
    request<Payout[]>(`/payouts${query(params)}`),
  create: (body: { booking_id: string; amount: number; note?: string }) =>
    request<Payout>("/payouts", json("POST", body)),
  approve: (id: string, body: { note?: string; idempotency_key: string }) =>
    request<Payout>(`/payouts/${id}/approve`, json("POST", body)),
  simulatePayment: (id: string, body: { note?: string; idempotency_key: string }) =>
    request<Payout>(`/payouts/${id}/simulate-payment`, json("POST", body)),
  void: (id: string, body: { note?: string; idempotency_key: string }) =>
    request<Payout>(`/payouts/${id}/void`, json("POST", body)),
};
export const supportTicketsApi = {
  list: (status?: SupportTicket["status"]) =>
    request<SupportTicket[]>(`/support-tickets${query({ status })}`),
  update: (
    id: string,
    body: Partial<Pick<SupportTicket, "status" | "priority" | "assigned_to_user_id">>,
  ) => request<SupportTicket>(`/support-tickets/${id}`, json("PATCH", body)),
};
export const cleanersApi = {
  kycDocumentTypes: () => request<CleanerKycDocumentType[]>("/cleaners/kyc-document-types"),
  saveKycDocumentTypes: (documents: CleanerKycDocumentType[]) =>
    request<CleanerKycDocumentType[]>("/cleaners/kyc-document-types", json("PUT", { documents })),
  list: (params: Record<string, string | boolean> = {}) =>
    request<Cleaner[]>(`/cleaners${query(params)}`),
  get: (id: string) => request<Cleaner>(`/cleaners/${id}`),
  create: (body: Record<string, unknown>) =>
    request<Cleaner>("/cleaners", json("POST", body)),
  uploadPhoto: (id: string, photo: File) => {
    const body = new FormData();
    body.append("photo", photo);
    return request<Cleaner>(`/cleaners/${id}/photo`, { method: "POST", body });
  },
  photoUrl: (id: string) => request<{ url: string }>(`/cleaners/${id}/photo-url`),
  uploadKycDocument: (id: string, document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<Cleaner>(`/cleaners/${id}/kyc-document`, { method: "POST", body });
  },
  uploadKycFile: (id: string, type: string, document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<Cleaner>(`/cleaners/${id}/kyc-documents/${type}`, { method: "POST", body });
  },
  viewKycFile: (id: string, type: string) =>
    openAuthenticatedFile(`/cleaners/${id}/kyc-documents/${type}/content`),
  getKycFilePreview: (id: string, type: string) =>
    authenticatedFileBlob(`/cleaners/${id}/kyc-documents/${type}/content`),
  uploadOnboardingDocument: (id: string, type: "reference-form" | "contract", document: File) => {
    const body = new FormData();
    body.append("document", document);
    return request<Cleaner>(`/cleaners/${id}/documents/${type}`, { method: "POST", body });
  },
  viewOnboardingDocument: (id: string, type: "reference-form" | "contract") =>
    openAuthenticatedFile(`/cleaners/${id}/documents/${type}/content`),
  getOnboardingDocumentPreview: (id: string, type: "reference-form" | "contract") =>
    authenticatedFileBlob(`/cleaners/${id}/documents/${type}/content`),
  viewKycDocument: (id: string) =>
    openAuthenticatedFile(`/cleaners/${id}/kyc-document/content`),
  update: (id: string, body: Record<string, unknown>) =>
    request<Cleaner>(`/cleaners/${id}`, json("PATCH", body)),
  availability: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/cleaners/${id}/availability`, json("PATCH", body)),
  deactivate: (id: string) =>
    request<Record<string, unknown>>(`/cleaners/${id}`, { method: "DELETE" }),
  nearby: (params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    service_area?: string;
  }) => request<Array<Record<string, unknown>>>(`/cleaners/nearby${query(params)}`),
  shifts: (params: { starts_at: string; ends_at: string; cleaner_id?: string }) =>
    request<Array<Record<string, unknown>>>(`/cleaners/shifts${query(params)}`),
  createShift: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/cleaners/shifts", json("POST", body)),
  updateShift: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/cleaners/shifts/${id}`, json("PATCH", body)),
  deactivateShift: (id: string) =>
    request<Record<string, unknown>>(`/cleaners/shifts/${id}`, { method: "DELETE" }),
  skills: (includeInactive = false) =>
    request<CleanerSkill[]>(`/cleaners/skills${includeInactive ? "?include_inactive=true" : ""}`),
  createSkill: (body: { name: string; description?: string; service_ids: string[]; is_active?: boolean }) =>
    request<CleanerSkill>("/cleaners/skills", json("POST", body)),
  updateSkill: (id: string, body: Partial<{ name: string; description: string | null; service_ids: string[]; is_active: boolean }>) =>
    request<CleanerSkill>(`/cleaners/skills/${id}`, json("PATCH", body)),
  deactivateSkill: (id: string) =>
    request<CleanerSkill>(`/cleaners/skills/${id}`, { method: "DELETE" }),
};
export const servicesApi = {
  list: async (includeInactive = false) => {
    const services = await request<Service[]>(`/services${includeInactive ? "?include_inactive=true" : ""}`);
    return Promise.all(services.map(async (service) => {
      if (!service.image_url) return service;
      try { return { ...service, image_url: (await request<{ url: string }>(`/services/${service.id}/image-url`)).url }; }
      catch { return { ...service, image_url: null }; }
    }));
  },
  get: async (id: string) => {
    const service = await request<Service>(`/services/${id}`);
    if (!service.image_url) return service;
    try { return { ...service, image_url: (await request<{ url: string }>(`/services/${id}/image-url`)).url }; }
    catch { return { ...service, image_url: null }; }
  },
  create: (body: Record<string, unknown>) => request<Service>("/services", json("POST", body)),
  uploadImage: async (id: string, image: File) => {
    const body = new FormData();
    body.append("image", image);
    const service = await request<Service>(`/services/${id}/image`, { method: "POST", body });
    if (!service.image_url) return service;
    try { return { ...service, image_url: (await request<{ url: string }>(`/services/${id}/image-url`)).url }; }
    catch { return { ...service, image_url: null }; }
  },
  update: (id: string, body: Record<string, unknown>) =>
    request<Service>(`/services/${id}`, json("PATCH", body)),
  deactivate: (id: string) => request<Service>(`/services/${id}`, { method: "DELETE" }),
  createPackage: (serviceId: string, body: Record<string, unknown>) =>
    request<ServicePackage>(`/services/${serviceId}/packages`, json("POST", body)),
  updatePackage: (serviceId: string, id: string, body: Record<string, unknown>) =>
    request<ServicePackage>(`/services/${serviceId}/packages/${id}`, json("PATCH", body)),
  deactivatePackage: (serviceId: string, id: string) =>
    request<ServicePackage>(`/services/${serviceId}/packages/${id}`, { method: "DELETE" }),
  assignPackage: (serviceId: string, id: string) =>
    request<ServicePackage>(`/services/${serviceId}/packages/${id}/assignment`, { method: "POST" }),
  removePackageAssignment: (serviceId: string, id: string) =>
    request<ServicePackage>(`/services/${serviceId}/packages/${id}/assignment`, {
      method: "DELETE",
    }),
  createAddon: (serviceId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/services/${serviceId}/additional-services`,
      json("POST", body),
    ),
  updateAddon: (serviceId: string, id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/services/${serviceId}/additional-services/${id}`,
      json("PATCH", body),
    ),
  deactivateAddon: (serviceId: string, id: string) =>
    request<Record<string, unknown>>(`/services/${serviceId}/additional-services/${id}`, {
      method: "DELETE",
    }),
  createTier: (serviceId: string, packageId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/services/${serviceId}/packages/${packageId}/tiers`,
      json("POST", body),
    ),
  updateTier: (serviceId: string, packageId: string, id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(
      `/services/${serviceId}/packages/${packageId}/tiers/${id}`,
      json("PATCH", body),
    ),
  deactivateTier: (serviceId: string, packageId: string, id: string) =>
    request<Record<string, unknown>>(`/services/${serviceId}/packages/${packageId}/tiers/${id}`, {
      method: "DELETE",
    }),
  subscriptions: (params: { status?: string; customer_id?: string; package_id?: string; service_id?: string; search?: string; start_date?: string; end_date?: string; limit?: number; offset?: number } = {}) =>
    request<SubscriptionPage>(`/services/subscriptions${query(params)}`),
  subscriptionDetails: (id: string) => request<SubscriptionDetails>(`/services/subscriptions/${id}`),
  updateSubscription: (id: string, body: Record<string, unknown>) =>
    request<Subscription>(`/services/subscriptions/${id}`, json("PATCH", body)),
  removeSubscription: (id: string) =>
    request<null>(`/services/subscriptions/${id}`, { method: "DELETE" }),
  usage: (start_date: string, end_date: string) =>
    request<{
      total_bookings: number;
      total_active_subscriptions: number;
      services: Array<{
        service_name: string;
        bookings: number;
        completed_bookings: number;
        active_subscriptions: number;
        quoted_value: string | number;
        currency: string;
      }>;
    }>(`/services/usage?start_date=${start_date}&end_date=${end_date}`),
};
export const dashboardApi = {
  summary: (
    params: {
      days?: number;
      granularity?: "daily" | "weekly" | "monthly";
      date?: string;
      start_date?: string;
      end_date?: string;
      role?: string;
      is_active?: boolean;
      audit_action?: string;
      audit_target_type?: string;
      actor_user_id?: string;
      performance_limit?: number;
    } = {},
  ) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") search.set(key, String(value));
    });
    return request<DashboardSummary>(`/dashboard/summary${search.size ? `?${search}` : ""}`);
  },
};
export const analyticsApi = {
  decisionSummary: (params: {
    start_date: string;
    end_date: string;
    granularity: "daily" | "weekly" | "monthly";
  }) => request<DecisionSummary>(`/analytics/decision-summary${query(params)}`),
};
