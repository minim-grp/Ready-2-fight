import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";

type AuthState = {
  session: Session | null;
  user: User | null;
  initialized: boolean;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  user: null,
  initialized: false,
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) logger.error("signOut failed", error.message);
  },
}));

export async function initAuth(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) logger.error("getSession failed", error.message);

  useAuthStore.setState({
    session: data.session,
    user: data.session?.user ?? null,
    initialized: true,
  });

  supabase.auth.onAuthStateChange((event, session) => {
    logger.debug("auth event", event);
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
    });
  });
}
