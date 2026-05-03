import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type { Tables } from "../../lib/database.types";

export type Notification = Tables<"notifications">;
export type NotificationType = Notification["type"];

const LIMIT = 50;

export function useNotifications() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    enabled: !!userId,
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, data, read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
}

export function useUnreadNotificationsCount() {
  const { data } = useNotifications();
  return useMemo(() => (data ?? []).filter((n) => n.read === false).length, [data]);
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      if (!userId) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, notificationId) => {
      qc.setQueryData<Notification[]>(["notifications", userId], (prev) =>
        prev?.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.setQueryData<Notification[]>(["notifications", userId], (prev) =>
        prev?.map((n) => (n.read ? n : { ...n, read: true })),
      );
    },
  });
}

// Lazy Realtime-Subscription: nur aktiv solange ein Hook-Consumer (= Layout)
// gemountet ist. Neue notifications-Rows landen direkt im Tanstack-Cache,
// damit der Bell-Badge ohne Polling reagiert. RLS "Users manage own
// notifications" filtert server-seitig auf user_id = auth.uid().
export function useNotificationsSubscription() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          qc.setQueryData<Notification[]>(["notifications", userId], (prev) => {
            if (!prev) return [row];
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, LIMIT);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
