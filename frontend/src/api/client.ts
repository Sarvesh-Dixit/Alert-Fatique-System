const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const TOKEN_KEY = "th_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api/v1${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (!path.startsWith("/auth")) window.location.href = "/login";
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string, options?: RequestInit) => request<T>(p, options),
  post: <T>(p: string, body?: unknown, options?: RequestInit) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...options }),
  put: <T>(p: string, body?: unknown, options?: RequestInit) =>
    request<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined, ...options }),
  del: <T>(p: string, options?: RequestInit) => request<T>(p, { method: "DELETE", ...options }),
};

// ---- Types ----
export interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}
export interface Application {
  id: string;
  organization_id: string;
  name: string;
  environment: string;
  region: string | null;
  description: string | null;
  created_at: string;
}
export interface ApplicationStats {
  total_events: number;
  events_per_minute: number;
  error_count: number;
  warning_count: number;
  connected: boolean;
}
export interface ApiKey {
  id: string;
  application_id: string;
  name: string;
  masked_key: string;
  environment_scope: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  is_active: boolean;
  api_key?: string;
}
export interface TelemetryEvent {
  event_id: string;
  organization_id: string;
  application_id: string;
  service: string | null;
  environment: string | null;
  region: string | null;
  event_type: string;
  severity: string;
  message: string | null;
  timestamp: string;
  received_at: string;
  source_type: string;
  metadata: Record<string, unknown>;
}
export interface Device {
  id: string;
  organization_id: string;
  application_id: string | null;
  hostname: string;
  operating_system: string | null;
  os_version: string | null;
  agent_version: string | null;
  region: string | null;
  status: string;
  credential_prefix: string | null;
  last_heartbeat_at: string | null;
  enrolled_at: string | null;
  created_at: string;
  events_received: number;
  events_dropped: number;
  config: Record<string, unknown>;
  enrollment_token?: string;
  device_credential?: string;
}

// ---- Phase 2: intelligence layer ----
export const API_BASE = BASE;

/** Full URL for the incident SSE stream (EventSource can't set headers). */
export function streamUrl(organizationId: string): string {
  const token = getToken() ?? "";
  return `${BASE}/api/v1/organizations/${organizationId}/stream?token=${encodeURIComponent(token)}`;
}

export interface Incident {
  id: string;
  organization_id: string;
  application_id: string;
  service: string | null;
  fingerprint: string | null;
  title: string;
  severity: string;
  status: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  affected_instances: string[];
  affected_regions: string[];
  affected_services: string[];
  affected_applications: string[];
  baseline_rate: number;
  current_rate: number;
  spike_multiplier: number;
  events_suppressed: number;
  notifications_sent: number;
  noise_reduction_ratio: number;
  correlation_id: string | null;
  last_notified_at?: string | null;
}
export interface TimelineEntry {
  id: string;
  kind: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
export interface NotificationEntry {
  id: string;
  kind: string;
  channel: string;
  severity: string;
  event_count_at_send: number;
  message: string;
  created_at: string;
}
export interface IncidentDetail extends Incident {
  timeline: TimelineEntry[];
  notifications: NotificationEntry[];
}
export interface ErrorGroup {
  id: string;
  application_id: string;
  service: string | null;
  environment: string | null;
  fingerprint: string;
  title: string;
  severity: string;
  event_count: number;
  first_seen: string;
  last_seen: string;
  affected_instances: string[];
  affected_regions: string[];
  sample_event_id: string | null;
  sample_message: string | null;
  incident_id: string | null;
}
export interface NoiseReductionKPIs {
  events_received: number;
  events_grouped: number;
  events_suppressed: number;
  notifications_sent: number;
  naive_notifications: number;
  noise_reduction_ratio: number;
  active_incidents: number;
  total_incidents: number;
  total_groups: number;
  total_events?: number;
  actionable_incidents?: number;
  suppressed_events?: number;
}
export interface CooldownState {
  incident_id: string;
  service: string | null;
  application_name: string | null;
  title: string;
  trigger_time: string | null;
  expiry_time: string | null;
  remaining_seconds: number;
  severity: string;
  suppressed_count: number;
  status: string;
}
export interface DemoScenario {
  id: string;
  description: string;
}

// ---- Phase 3: agents, notifications, RBAC, analytics ----
export interface Integration {
  id: string;
  type: string;
  enabled: boolean;
  min_severity: string;
  config: Record<string, unknown>;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
}
export interface RetentionPolicy {
  organization_id: string;
  raw_telemetry_days: number;
  incident_days: number;
  audit_days: number;
  updated_at: string | null;
}
export interface Member {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
}
export interface ExecutiveAnalytics {
  events_received: number;
  potential_alerts: number;
  actual_notifications: number;
  alerts_suppressed: number;
  noise_reduction_ratio: number;
  total_incidents: number;
  active_incidents: number;
  critical_incidents: number;
  avg_incident_duration_minutes: number;
  top_noisy_services: { service: string; events: number }[];
  top_error_fingerprints: { title: string; fingerprint: string; events: number }[];
  top_affected_applications: { application: string; events: number }[];
  top_affected_devices: { hostname: string; os: string | null; events: number; status: string }[];
  regional_health: { region: string; events: number }[];
}
export interface SecurityDashboard {
  active_devices: number;
  total_devices: number;
  agent_versions: Record<string, number>;
  devices: { hostname: string; os: string | null; version: string | null; status: string; last_heartbeat_at: string | null }[];
  authentication_failures: number;
  cross_tenant_denials: number;
  api_keys_total: number;
  api_keys_active: number;
  rate_limit_violations: number;
  redactions: number;
  suspicious_spikes: { title: string; spike_multiplier: number; severity: string }[];
}
export interface PlatformHealth {
  status: string;
  region: string;
  database_healthy: boolean;
  redis_healthy: boolean;
  queue_depth: number;
  queue_pending: number;
  ingestion_rate_per_min: number;
  processing_rate_per_min: number;
  events_ingested_total: number;
  events_processed_total: number;
  processing_failures: number;
  notification_failures: number;
  redactions_total: number;
  rate_limit_violations_total: number;
  agents_online: number;
  agents_total: number;
}
