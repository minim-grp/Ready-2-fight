import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type ChatChannel = {
  id: string;
  engagement_id: string;
  is_locked: boolean;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const MESSAGE_LIMIT = 200;

// Lookup channel via engagement. RLS cc_member_read filtert auf
// (coach_id = auth.uid() OR athlete_id = auth.uid()).
export function useChatChannel(engagementId: string | undefined) {
  return useQuery({
    enabled: !!engagementId,
    queryKey: ["chat-channel", engagementId],
    queryFn: async (): Promise<ChatChannel | null> => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("id, engagement_id, is_locked")
        .eq("engagement_id", engagementId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Letzte 200 Messages, aufsteigend sortiert (oldest first → UI scrollt nach unten).
export function useChatMessages(channelId: string | undefined) {
  return useQuery({
    enabled: !!channelId,
    queryKey: ["chat-messages", channelId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, channel_id, sender_id, body, created_at, read_at")
        .eq("channel_id", channelId!)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_LIMIT);
      if (error) throw error;
      return ((data ?? []) as ChatMessage[]).slice().reverse();
    },
  });
}

export function useSendMessage(channelId: string) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: async (body: string): Promise<void> => {
      if (!userId) throw new Error("not_authenticated");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("empty_message");
      if (trimmed.length > 4000) throw new Error("message_too_long");
      const { error } = await supabase.from("chat_messages").insert({
        channel_id: channelId,
        sender_id: userId,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Realtime-Subscription liefert die neue Row meistens schneller, aber
      // bei Latenz oder fehlendem Subscribe ist Invalidate die Sicherheitsleine.
      void qc.invalidateQueries({ queryKey: ["chat-messages", channelId] });
    },
  });
}

// Lazy Realtime-Subscription: nur aktiv solange das Hook gemountet ist
// (= ChatPage offen). Liefert neue Messages und schreibt sie direkt in den
// Tanstack-Cache, damit keine zweite Roundtrip noetig ist.
// Postgres-Changes-API liefert nur die Row, RLS wurde server-seitig schon
// gegen den Listener gepruefte → Coach/Athlet sehen nur ihre eigenen Channels.
export function useChatSubscription(channelId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          qc.setQueryData<ChatMessage[]>(["chat-messages", channelId], (prev) => {
            if (!prev) return [row];
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, qc]);
}
