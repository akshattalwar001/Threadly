import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

export function getBackendUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is not set.");
  }

  return backendUrl;
}

async function getIdToken(): Promise<string> {
  const currentUser = auth.currentUser;

  if (currentUser) {
    return currentUser.getIdToken();
  }

  return await new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("No authenticated user found."));
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        return;
      }

      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve(await user.getIdToken());
    });
  });
}

export type CrewActionResponse<T = unknown> = {
  action: string;
  success: boolean;
  data: T;
};

export async function crewAction<T = unknown>(
  action: string,
  text?: string,
): Promise<CrewActionResponse<T>> {
  const token = await getIdToken();

  const response = await fetch(`${getBackendUrl()}/crew/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action,
      ...(text ? { text } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Crew action failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<CrewActionResponse<T>>;
}

export type ChiefCard = {
  name: string;
  role: string;
  company: string;
  reason: string;
  potential: string;
};

export type ChiefAnswer = {
  text: string;
  cards?: ChiefCard[] | null;
};

export async function askChief(question: string): Promise<ChiefAnswer> {
  const token = await getIdToken();

  const response = await fetch(`${getBackendUrl()}/chief/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Chief request failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<ChiefAnswer>;
}

export async function apiFetch<T = unknown>(path: string): Promise<T> {
  const token = await getIdToken();

  const response = await fetch(`${getBackendUrl()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request to ${path} failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getIdToken();

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request to ${path} failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const token = await getIdToken();

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Request to ${path} failed (${response.status}): ${errorText || response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

export type Contact = {
  id: string;
  name: string;
  title: string;
  company: string;
  initials: string;
  met_at: string;
  met_date: string | null;
  last_contact: string;
  channel: string;
  warmth: number;
  signals: string[];
  last_crew: string;
  autonomy: string;
  org_tags: string[];
  handles: { telegram?: string; linkedin?: string; email?: string };
};

export type ContactDetail = Contact & {
  enrichment: Record<string, unknown> | null;
  interactions: Array<{
    id: string;
    timestamp: string;
    day_label: string;
    channel: string;
    direction: string;
    kind: string;
    preview: string;
    crew: string;
  }>;
  warmth_timeline: Array<{
    day: number;
    date: string;
    warmth: number;
    event?: string;
    channel?: string;
  }>;
};

export type Draft = {
  id: string;
  contact_id: string;
  contact: string;
  company: string;
  initials: string;
  crew: string;
  channel: string;
  warmth: number;
  inbound_text?: string;
  inbound_timestamp?: string;
  signal_chips: string[];
  draft: string;
  reasoning: string;
  reasoning_trail: Array<{ crew: string; note: string }>;
  status: string;
};

export type CardInProcessing = {
  id: string;
  state: string;
  filename: string;
  captured_at: string;
  extracted: Record<string, string> | null;
  error_reason?: string;
};

export type VoiceNote = {
  id: string;
  source: string;
  date: string;
  duration_sec: number;
  title: string;
  transcript_preview: string;
  commitments: string[];
  contact_ids: string[];
};

export type ActivityEntry = {
  id: string;
  timestamp: string;
  crew: string;
  action: string;
  detail: string;
  contact_id: string | null;
};

export type Opportunity = {
  id: string;
  name: string;
  title: string;
  company: string;
  initials: string;
  warmth: number;
  last_contact: string;
};

export type CoverageRow = { label: string; count: number; pct: number };

export type Analytics = {
  summary: {
    total_graph: number;
    avg_warmth: number;
    active_conversations: number;
    dormant: number;
    drafts_sent_this_month: number;
    drafts_staged_this_month: number;
  };
  growth: Array<{ month: string; new_contacts: number; cumulative: number }>;
  channel_share: Array<{ channel: string; count: number }>;
  top_active: Array<{
    contact_id: string;
    name: string;
    company: string;
    initials: string;
    channel: string;
    warmth: number;
    last_crew: string;
  }>;
};

export type ScannerResult = {
  name: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  event: string | null;
  topics: string[];
  commitments: string[];
  summary: string;
  confidence: number;
};

export const scannerScan = (text: string) =>
  apiPost<ScannerResult>("/scanner/scan", { text });

export const getContacts = () => apiFetch<Contact[]>("/contacts");
export const getContact = (id: string) =>
  apiFetch<ContactDetail>(`/contacts/${encodeURIComponent(id)}`);
export const getDashboardDrafts = () => apiFetch<Draft[]>("/dashboard/drafts");
export const getDashboardCards = () =>
  apiFetch<CardInProcessing[]>("/dashboard/cards");
export const getDashboardVoiceNotes = () =>
  apiFetch<VoiceNote[]>("/dashboard/voice-notes");
export const getDashboardActivity = () =>
  apiFetch<ActivityEntry[]>("/dashboard/activity");
export const getDashboardOpportunities = () =>
  apiFetch<Opportunity[]>("/dashboard/opportunities");
export const getDashboardCoverage = () =>
  apiFetch<CoverageRow[]>("/dashboard/coverage");
export const getDashboardAnalytics = () =>
  apiFetch<Analytics>("/dashboard/analytics");

export type PulseDashboard = {
  people: number;
  companies: number;
  topics: number;
  founders: number;
  aiBuilders: number;
  networkHealth: number;
};

export const getPulseDashboard = () =>
  apiFetch<PulseDashboard>("/pulse/dashboard");

export type RecentlyActiveContact = {
  id: string;
  name: string;
  title: string;
  company: string;
  initials: string;
  channel: string;
  last_contact: string;
  telegram_message_count: number;
  warmth: number;
};

export const getPulseRecentlyActive = () =>
  apiFetch<RecentlyActiveContact[]>("/pulse/recently-active");

export type RecallSearchResponse = {
  results: unknown[];
  answer: string;
};

export const recallSearch = (query: string) =>
  apiPost<RecallSearchResponse>("/recall/search", { query });

export type NudgeSuggestion = {
  name: string;
  reason: string;
  message: string;
};

export const getNudgeSuggestions = () =>
  apiFetch<NudgeSuggestion[]>("/nudge/suggestions");

export type TelegramStatus = {
  connected: boolean;
  phone?: string | null;
  connected_at?: string | null;
};

export const getTelegramStatus = () =>
  apiFetch<TelegramStatus>("/telegram/status");

export const telegramConnectStart = (phone: string) =>
  apiPost<{ code_sent: boolean }>("/telegram/connect/start", { phone });

export const telegramConnectVerify = (
  phone: string,
  code: string,
  password?: string,
) =>
  apiPost<
    | { needs_password: true }
    | { connected: true; telegram_user_id: number; username: string | null }
  >("/telegram/connect/verify", { phone, code, password });

export const telegramSync = () =>
  apiPost<{ synced: number; created: number }>("/telegram/sync");

export const telegramDisconnect = () =>
  apiDelete<{ disconnected: boolean }>("/telegram/disconnect");

export type GoogleStatus = {
  connected: boolean;
  email?: string | null;
  connected_at?: string | null;
};

export const getGoogleStatus = () =>
  apiFetch<GoogleStatus>("/google/status");

export const getGoogleAuthUrl = () =>
  apiFetch<{ auth_url: string }>("/google/connect/start");

export type GoogleContactGroup = {
  resource_name: string;
  name: string;
  member_count: number;
};

export const getGoogleContactGroups = () =>
  apiFetch<GoogleContactGroup[]>("/google/groups");

export const googleSync = (groupResourceNames: string[]) =>
  apiPost<{ synced: number; created: number }>("/google/sync", {
    group_resource_names: groupResourceNames,
  });

export const googleDisconnect = () =>
  apiDelete<{ disconnected: boolean }>("/google/disconnect");