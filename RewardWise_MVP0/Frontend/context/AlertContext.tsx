/** @format */
"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/context/AuthProvider";

export interface WatchlistItem {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  cabin: string;
  passengers: number;
  tripType: "roundtrip" | "oneway";
  createdAt: string; // ISO timestamp
  cashPrice: number | null;
  pointsRequired: number | null;
  program: string | null;
  verdict: "points" | "cash";
}

export interface AlertNotification {
  id: string;
  watchlistId: string; // links to the WatchlistItem
  title: string;
  desc: string;
  createdAt: string;
  read: boolean;
}

interface AlertContextType {
  watchlist: WatchlistItem[];
  notifications: AlertNotification[];
  unreadCount: number;
  loading: boolean;
  addToWatchlist: (item: Omit<WatchlistItem, "id" | "createdAt">) => void;
  removeFromWatchlist: (id: string) => void;
  isWatching: (origin: string, destination: string, departDate: string) => boolean;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotification: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const LS_WATCHLIST = "mtw_watchlist";
const LS_NOTIFICATIONS = "mtw_notifications";

function loadFromLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}


async function ensurePublicUserRow(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string | null }
) {
  const { error } = await supabase.from("users").upsert(
    { id: user.id, email: user.email ?? null },
    { onConflict: "id" }
  );
  if (error) {
    console.warn("[alerts] could not upsert public.users (FK may fail):", error.message);
  }
}

function normalizeWatchlistItem(item: any): WatchlistItem {
  return {
    id: item.id,
    origin: item.origin,
    destination: item.destination,
    departDate: item.departDate ?? item.depart_date,
    returnDate: item.returnDate ?? item.return_date ?? null,
    cabin: item.cabin ?? "economy",
    passengers: item.passengers ?? item.travelers ?? 1,
    tripType: item.tripType ?? item.trip_type ?? (item.isRoundtrip ? "roundtrip" : "oneway"),
    createdAt: item.createdAt ?? item.created_at ?? item.addedAt ?? new Date().toISOString(),
    cashPrice: item.cashPrice ?? item.cash_price ?? null,
    pointsRequired: item.pointsRequired ?? item.points_required ?? null,
    program: item.program ?? null,
    verdict: item.verdict === "cash" ? "cash" : "points",
  };
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);

  //Load from Supabase for signed-in users and fallback to localStorage for guests.
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setWatchlist(loadFromLS<any[]>(LS_WATCHLIST, []).map(normalizeWatchlistItem));
        setNotifications(loadFromLS<AlertNotification[]>(LS_NOTIFICATIONS, []));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [watchlistRes, notificationsRes] = await Promise.all([
          supabase
            .from("watchlist")
            .select("id, origin, destination, depart_date, return_date, cabin, passengers, trip_type, created_at, cash_price, points_required, program, verdict")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("notifications")
            .select("id, watchlist_id, title, description, created_at, is_read")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (watchlistRes.error) {
          console.error("[alerts] watchlist load error:", watchlistRes.error.message, watchlistRes.error);
        }
        if (notificationsRes.error) {
          console.error("[alerts] notifications load error:", notificationsRes.error.message, notificationsRes.error);
        }

        const dbWatchlist: WatchlistItem[] =
          watchlistRes.data?.map((row) => ({
            id: row.id,
            origin: row.origin,
            destination: row.destination,
            departDate: row.depart_date,
            returnDate: row.return_date,
            cabin: row.cabin,
            passengers: row.passengers ?? 1,
            tripType: row.trip_type === "oneway" ? "oneway" : "roundtrip",
            createdAt: row.created_at,
            cashPrice: row.cash_price,
            pointsRequired: row.points_required,
            program: row.program,
            verdict: row.verdict,
          })) ?? [];

        const dbNotifications: AlertNotification[] =
          notificationsRes.data?.map((row) => ({
            id: row.id,
            watchlistId: row.watchlist_id,
            title: row.title,
            desc: row.description,
            createdAt: row.created_at,
            read: row.is_read,
          })) ?? [];

        //One time migration from browser storage if DB is empty
        if (dbWatchlist.length === 0 && dbNotifications.length === 0) {
          const lsWatchlist = loadFromLS<any[]>(LS_WATCHLIST, []).map(normalizeWatchlistItem);
          const lsNotifications = loadFromLS<AlertNotification[]>(LS_NOTIFICATIONS, []);
          let migratedFromLs = false;

          if (lsWatchlist.length > 0) {
            await ensurePublicUserRow(supabase, user);
            const { error: migW } = await supabase.from("watchlist").insert(
              lsWatchlist.map((item) => ({
                id: item.id,
                user_id: user.id,
                origin: item.origin,
                destination: item.destination,
                depart_date: item.departDate,
                return_date: item.returnDate ?? null,
                cabin: item.cabin,
                passengers: item.passengers,
                trip_type: item.tripType,
                created_at: item.createdAt,
                cash_price: item.cashPrice,
                points_required: item.pointsRequired,
                program: item.program,
                verdict: item.verdict,
              }))
            );
            if (migW) {
              console.error("[alerts] migrate watchlist failed:", migW.message, migW);
            } else {
              migratedFromLs = true;
              if (lsNotifications.length > 0) {
                const { error: migN } = await supabase.from("notifications").insert(
                  lsNotifications.map((n) => ({
                    id: n.id,
                    user_id: user.id,
                    watchlist_id: n.watchlistId,
                    title: n.title,
                    description: n.desc,
                    created_at: n.createdAt,
                    is_read: n.read,
                  }))
                );
                if (migN) console.error("[alerts] migrate notifications failed:", migN.message, migN);
              }
            }
          } else if (lsNotifications.length > 0) {
            console.warn("[alerts] skipped notification migration: no watchlist rows to satisfy FK");
          }

          if (migratedFromLs) {
            const [w2, n2] = await Promise.all([
              supabase
                .from("watchlist")
                .select("id, origin, destination, depart_date, return_date, cabin, passengers, trip_type, created_at, cash_price, points_required, program, verdict")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false }),
              supabase
                .from("notifications")
                .select("id, watchlist_id, title, description, created_at, is_read")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false }),
            ]);
            setWatchlist(
              (w2.data?.map((row) => ({
                id: row.id,
                origin: row.origin,
                destination: row.destination,
                departDate: row.depart_date,
                returnDate: row.return_date,
                cabin: row.cabin,
                passengers: row.passengers ?? 1,
                tripType: row.trip_type === "oneway" ? "oneway" : "roundtrip",
                createdAt: row.created_at,
                cashPrice: row.cash_price,
                pointsRequired: row.points_required,
                program: row.program,
                verdict: row.verdict,
              })) as WatchlistItem[]) ?? []
            );
            setNotifications(
              (n2.data?.map((row) => ({
                id: row.id,
                watchlistId: row.watchlist_id,
                title: row.title,
                desc: row.description,
                createdAt: row.created_at,
                read: row.is_read,
              })) as AlertNotification[]) ?? []
            );
            localStorage.removeItem(LS_WATCHLIST);
            localStorage.removeItem(LS_NOTIFICATIONS);
          } else if (lsWatchlist.length === 0 && lsNotifications.length === 0) {
            setWatchlist([]);
            setNotifications([]);
          } else {
            setWatchlist(lsWatchlist);
            setNotifications(lsNotifications);
          }
        } else {
          setWatchlist(dbWatchlist);
          setNotifications(dbNotifications);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [supabase, user]);

  // Persist only for guest users.
  useEffect(() => {
    if (!user && !loading) localStorage.setItem(LS_WATCHLIST, JSON.stringify(watchlist));
  }, [watchlist, user, loading]);

  useEffect(() => {
    if (!user && !loading) localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, user, loading]);

  const addToWatchlist = useCallback((item: Omit<WatchlistItem, "id" | "createdAt">) => {
    const id = crypto.randomUUID();
    const newItem: WatchlistItem = { ...item, id, createdAt: new Date().toISOString() };
    setWatchlist((prev) => [newItem, ...prev]);

    //created a bell notification
    const notif: AlertNotification = {
      id: crypto.randomUUID(),
      watchlistId: id,
      title: `Alert set: ${item.origin} → ${item.destination}`,
      desc: `${item.cabin} · ${item.departDate}${item.tripType === "roundtrip" && item.returnDate ? ` – ${item.returnDate}` : ""} · Watching for availability`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);

    if (user) {
      //Must insert watchlist first notifications.watchlist_id FK  then notification.
      void (async () => {
        await ensurePublicUserRow(supabase, user);
        const { error: wErr } = await supabase.from("watchlist").insert({
          id: newItem.id,
          user_id: user.id,
          origin: newItem.origin,
          destination: newItem.destination,
          depart_date: newItem.departDate,
          return_date: newItem.returnDate ?? null,
          cabin: newItem.cabin,
          passengers: newItem.passengers,
          trip_type: newItem.tripType,
          created_at: newItem.createdAt,
          cash_price: newItem.cashPrice,
          points_required: newItem.pointsRequired,
          program: newItem.program,
          verdict: newItem.verdict,
        });
        if (wErr) {
          console.error("[alerts] watchlist insert failed:", wErr.message, wErr);
          return;
        }
        const { error: nErr } = await supabase.from("notifications").insert({
          id: notif.id,
          user_id: user.id,
          watchlist_id: notif.watchlistId,
          title: notif.title,
          description: notif.desc,
          created_at: notif.createdAt,
          is_read: notif.read,
        });
        if (nErr) console.error("[alerts] notifications insert failed:", nErr.message, nErr);
      })();
    }
  }, [supabase, user]);

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
    if (user) {
      void supabase.from("watchlist").delete().eq("id", id).eq("user_id", user.id);
      setNotifications((prev) => prev.filter((n) => n.watchlistId !== id));
    }
  }, [supabase, user]);

  const isWatching = useCallback(
    (origin: string, destination: string, departDate: string) => {
      return watchlist.some(
        (w) =>
          w.origin.toUpperCase() === origin.toUpperCase() &&
          w.destination.toUpperCase() === destination.toUpperCase() &&
          w.departDate === departDate
      );
    },
    [watchlist]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (user) {
      void supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
    }
  }, [supabase, user]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) {
      void supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    }
  }, [supabase, user]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user) {
      void supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);
    }
  }, [supabase, user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AlertContext.Provider
      value={{
        watchlist,
        notifications,
        unreadCount,
        loading,
        addToWatchlist,
        removeFromWatchlist,
        isWatching,
        markNotificationRead,
        markAllRead,
        clearNotification,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used within an AlertProvider");
  return ctx;
}
