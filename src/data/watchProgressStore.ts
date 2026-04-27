import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WatchProgressEntry = {
  contributionId: string;
  progress: number;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  lastWatchedAt: string;
};

type Row = {
  contribution_id: string;
  progress: number;
  position_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  last_watched_at: string;
};

function fromRow(row: Row): WatchProgressEntry {
  return {
    contributionId: row.contribution_id,
    progress: row.progress,
    positionSeconds: Number(row.position_seconds ?? 0),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    completed: row.completed,
    lastWatchedAt: row.last_watched_at,
  };
}

const COMPLETION_THRESHOLD = 95;
const LOCAL_WATCH_PROGRESS_KEY = "hyvemind:watch-progress";
const WATCH_PROGRESS_CHANGED_EVENT = "hyvemind:watch-progress-changed";

function readLocalWatchProgress(): Map<string, WatchProgressEntry> {
  if (typeof window === "undefined") return new Map();

  try {
    const raw = window.localStorage.getItem(LOCAL_WATCH_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const entries = new Map<string, WatchProgressEntry>();

    list.forEach((item) => {
      if (!item || typeof item !== "object" || typeof item.contributionId !== "string") return;

      const entry: WatchProgressEntry = {
        contributionId: item.contributionId,
        progress: Number(item.progress ?? 0),
        positionSeconds: Number(item.positionSeconds ?? 0),
        durationSeconds: item.durationSeconds == null ? null : Number(item.durationSeconds),
        completed: Boolean(item.completed),
        lastWatchedAt:
          typeof item.lastWatchedAt === "string" ? item.lastWatchedAt : new Date().toISOString(),
      };

      // Keep all entries (including completed) for Watch History.
      entries.set(entry.contributionId, entry);
    });

    return entries;
  } catch {
    return new Map();
  }
}

function writeLocalWatchProgress(entries: Map<string, WatchProgressEntry>) {
  if (typeof window === "undefined") return;

  const serialized = [...entries.values()].sort(
    (a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime(),
  );

  window.localStorage.setItem(LOCAL_WATCH_PROGRESS_KEY, JSON.stringify(serialized));
  window.dispatchEvent(new Event(WATCH_PROGRESS_CHANGED_EVENT));
}

function mergeWatchProgress(
  localEntries: Map<string, WatchProgressEntry>,
  remoteEntries: Map<string, WatchProgressEntry>,
) {
  const merged = new Map(localEntries);

  remoteEntries.forEach((remoteEntry, contributionId) => {
    const localEntry = merged.get(contributionId);

    if (!localEntry) {
      merged.set(contributionId, remoteEntry);
      return;
    }

    const remoteTime = new Date(remoteEntry.lastWatchedAt).getTime();
    const localTime = new Date(localEntry.lastWatchedAt).getTime();

    if (remoteTime >= localTime) {
      merged.set(contributionId, remoteEntry);
    }
  });

  return merged;
}

export async function upsertWatchProgress(params: {
  contributionId: string;
  positionSeconds: number;
  durationSeconds: number;
}) {
  const { contributionId, positionSeconds, durationSeconds } = params;
  const safeDuration = durationSeconds > 0 ? durationSeconds : 0;
  const pct = safeDuration > 0
    ? Math.min(100, Math.max(0, Math.round((positionSeconds / safeDuration) * 100)))
    : 0;
  const completed = pct >= COMPLETION_THRESHOLD;
  const lastWatchedAt = new Date().toISOString();

  const localEntries = readLocalWatchProgress();
  // Always retain entries (even on completion) so Watch History keeps a record.
  localEntries.set(contributionId, {
    contributionId,
    progress: pct > 0 ? pct : positionSeconds > 0 ? 1 : 0,
    positionSeconds,
    durationSeconds: safeDuration > 0 ? safeDuration : null,
    completed,
    lastWatchedAt,
  });
  writeLocalWatchProgress(localEntries);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("watch_progress").upsert(
    {
      user_id: user.id,
      contribution_id: contributionId,
      progress: pct,
      position_seconds: positionSeconds,
      duration_seconds: safeDuration > 0 ? safeDuration : null,
      completed,
      last_watched_at: lastWatchedAt,
    },
    { onConflict: "user_id,contribution_id" },
  );
}

export async function clearWatchProgress(contributionId: string) {
  const localEntries = readLocalWatchProgress();
  localEntries.delete(contributionId);
  writeLocalWatchProgress(localEntries);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("watch_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("contribution_id", contributionId);
}

/**
 * Realtime hook returning a Map of contributionId → progress entry for the
 * current user. Falls back to locally persisted progress when signed out or
 * while waiting for backend sync.
 */
export function useWatchProgress(): Map<string, WatchProgressEntry> {
  const [entries, setEntries] = useState<Map<string, WatchProgressEntry>>(() => readLocalWatchProgress());

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let currentUserId: string | null = null;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      if (!user) {
        currentUserId = null;
        setEntries(readLocalWatchProgress());
        return;
      }

      currentUserId = user.id;

      const { data } = await supabase
        .from("watch_progress")
        .select("contribution_id,progress,position_seconds,duration_seconds,completed,last_watched_at")
        .eq("user_id", user.id)
        .order("last_watched_at", { ascending: false });

      if (!mounted || currentUserId !== user.id) return;

      const remoteEntries = new Map<string, WatchProgressEntry>();
      (data ?? []).forEach((row) => {
        const entry = fromRow(row as Row);
        remoteEntries.set(entry.contributionId, entry);
      });

      const merged = mergeWatchProgress(readLocalWatchProgress(), remoteEntries);
      writeLocalWatchProgress(merged);
      setEntries(merged);

      const newChannel = supabase.channel(`watch_progress:${user.id}:${Date.now()}`);
      newChannel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watch_progress", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setEntries((prev) => {
            const next = new Map(prev);

            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Row | undefined;
              if (oldRow?.contribution_id) next.delete(oldRow.contribution_id);
            } else {
              const newRow = payload.new as Row | undefined;
              if (newRow?.contribution_id) {
                next.set(newRow.contribution_id, fromRow(newRow));
              }
            }

            writeLocalWatchProgress(next);
            return next;
          });
        },
      );
      newChannel.subscribe();
      channel = newChannel;
    }

    function syncFromLocal() {
      setEntries(readLocalWatchProgress());
    }

    load();

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    window.addEventListener("storage", syncFromLocal);
    window.addEventListener(WATCH_PROGRESS_CHANGED_EVENT, syncFromLocal);

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      authSub.subscription.unsubscribe();
      window.removeEventListener("storage", syncFromLocal);
      window.removeEventListener(WATCH_PROGRESS_CHANGED_EVENT, syncFromLocal);
    };
  }, []);

  return entries;
}
