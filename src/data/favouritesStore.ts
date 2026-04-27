import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "hyvemind:favourites";
const FAVOURITES_CHANGED_EVENT = "hyvemind:favourites-changed";

function readLocal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeLocal(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event(FAVOURITES_CHANGED_EVENT));
}

async function ensureUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) return null;
  return signIn.user.id;
}

export async function toggleFavourite(contributionId: string): Promise<boolean> {
  const local = readLocal();
  const wasFavourited = local.has(contributionId);

  // Optimistic local update
  if (wasFavourited) local.delete(contributionId);
  else local.add(contributionId);
  writeLocal(local);

  const userId = await ensureUserId();
  if (!userId) return !wasFavourited;

  if (wasFavourited) {
    await supabase
      .from("favourites")
      .delete()
      .eq("user_id", userId)
      .eq("contribution_id", contributionId);
  } else {
    await supabase
      .from("favourites")
      .insert({ user_id: userId, contribution_id: contributionId });
  }

  return !wasFavourited;
}

// Shared, app-wide favourite counts store. One query + one realtime channel
// regardless of how many ResourceCards are mounted.
let countsCache: Map<string, number> = new Map();
let countsLoaded = false;
let countsChannel: ReturnType<typeof supabase.channel> | null = null;
const countsListeners = new Set<(m: Map<string, number>) => void>();

function emitCounts() {
  const snapshot = new Map(countsCache);
  countsListeners.forEach((cb) => cb(snapshot));
}

async function loadCountsOnce() {
  if (countsLoaded) return;
  countsLoaded = true;
  try {
    const { data, error } = await supabase.from("favourites").select("contribution_id");
    if (!error && data) {
      const next = new Map<string, number>();
      for (const row of data) {
        const id = row.contribution_id;
        next.set(id, (next.get(id) ?? 0) + 1);
      }
      countsCache = next;
      emitCounts();
    }
  } catch {
    // ignore — counts simply stay empty
  }

  if (!countsChannel) {
    countsChannel = supabase
      .channel("favourites-counts-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favourites" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as { contribution_id?: string };
            if (row.contribution_id) {
              countsCache.set(row.contribution_id, (countsCache.get(row.contribution_id) ?? 0) + 1);
              emitCounts();
            }
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { contribution_id?: string };
            if (row.contribution_id) {
              const current = countsCache.get(row.contribution_id) ?? 0;
              if (current <= 1) countsCache.delete(row.contribution_id);
              else countsCache.set(row.contribution_id, current - 1);
              emitCounts();
            }
          }
        },
      )
      .subscribe();
  }
}

export function useFavouriteCounts(): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map(countsCache));

  useEffect(() => {
    countsListeners.add(setCounts);
    loadCountsOnce();
    if (countsCache.size > 0) setCounts(new Map(countsCache));
    return () => {
      countsListeners.delete(setCounts);
    };
  }, []);

  return counts;
}


export function useFavourites(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => readLocal());

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      if (!user) {
        setIds(readLocal());
        return;
      }

      const { data } = await supabase
        .from("favourites")
        .select("contribution_id")
        .eq("user_id", user.id);

      if (!mounted) return;

      const remote = new Set<string>((data ?? []).map((r) => r.contribution_id));
      writeLocal(remote);
      setIds(remote);

      const ch = supabase.channel(`favourites:${user.id}:${Date.now()}`);
      ch.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favourites", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setIds((prev) => {
            const next = new Set(prev);
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as { contribution_id?: string } | undefined;
              if (oldRow?.contribution_id) next.delete(oldRow.contribution_id);
            } else {
              const newRow = payload.new as { contribution_id?: string } | undefined;
              if (newRow?.contribution_id) next.add(newRow.contribution_id);
            }
            writeLocal(next);
            return next;
          });
        },
      );
      ch.subscribe();
      channel = ch;
    }

    function syncFromLocal() {
      setIds(readLocal());
    }

    load();
    const { data: authSub } = supabase.auth.onAuthStateChange(() => load());
    window.addEventListener("storage", syncFromLocal);
    window.addEventListener(FAVOURITES_CHANGED_EVENT, syncFromLocal);

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
      authSub.subscription.unsubscribe();
      window.removeEventListener("storage", syncFromLocal);
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, syncFromLocal);
    };
  }, []);

  return ids;
}
