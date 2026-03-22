/** @format */
"use client";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export interface WatchlistItem {
  id: string;
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  cabin: string;
  travelers: number;
  isRoundtrip: boolean;
  addedAt: string; // ISO timestamp
  // Snapshot from the verdict that triggered the alert
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
  addToWatchlist: (item: Omit<WatchlistItem, "id" | "addedAt">) => void;
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

export function AlertProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setWatchlist(loadFromLS<WatchlistItem[]>(LS_WATCHLIST, []));
    setNotifications(loadFromLS<AlertNotification[]>(LS_NOTIFICATIONS, []));
    setHydrated(true);
  }, []);

  // Persist on change (skip initial render before hydration)
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_WATCHLIST, JSON.stringify(watchlist));
  }, [watchlist, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications, hydrated]);

  const addToWatchlist = useCallback((item: Omit<WatchlistItem, "id" | "addedAt">) => {
    const id = crypto.randomUUID();
    const newItem: WatchlistItem = { ...item, id, addedAt: new Date().toISOString() };
    setWatchlist((prev) => [newItem, ...prev]);

    // Also create a bell notification
    const notif: AlertNotification = {
      id: crypto.randomUUID(),
      watchlistId: id,
      title: `Alert set: ${item.origin} → ${item.destination}`,
      desc: `${item.cabin} · ${item.departDate}${item.isRoundtrip && item.returnDate ? ` – ${item.returnDate}` : ""} · Watching for availability`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev]);
  }, []);

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => prev.filter((w) => w.id !== id));
  }, []);

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
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AlertContext.Provider
      value={{
        watchlist,
        notifications,
        unreadCount,
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
