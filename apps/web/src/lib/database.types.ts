export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string | null;
          condition: Json | null;
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          slug: string;
          title: string;
          xp_reward: number | null;
        };
        Insert: {
          category?: string | null;
          condition?: Json | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          slug: string;
          title: string;
          xp_reward?: number | null;
        };
        Update: {
          category?: string | null;
          condition?: Json | null;
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          slug?: string;
          title?: string;
          xp_reward?: number | null;
        };
        Relationships: [];
      };
      athlete_profiles: {
        Row: {
          bio: string | null;
          birth_date: string | null;
          created_at: string;
          experience_years: number | null;
          gender: Database["public"]["Enums"]["gender"] | null;
          height_cm: number | null;
          id: string;
          onboarding_done: boolean;
          primary_sport_id: string | null;
          updated_at: string;
          weight_kg: number | null;
        };
        Insert: {
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          experience_years?: number | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          height_cm?: number | null;
          id: string;
          onboarding_done?: boolean;
          primary_sport_id?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          bio?: string | null;
          birth_date?: string | null;
          created_at?: string;
          experience_years?: number | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          height_cm?: number | null;
          id?: string;
          onboarding_done?: boolean;
          primary_sport_id?: string | null;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      athlete_sports: {
        Row: {
          athlete_id: string;
          created_at: string | null;
          id: string;
          is_primary: boolean | null;
          skill_level: string | null;
          sport_id: string;
          started_at: string | null;
        };
        Insert: {
          athlete_id: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          skill_level?: string | null;
          sport_id: string;
          started_at?: string | null;
        };
        Update: {
          athlete_id?: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          skill_level?: string | null;
          sport_id?: string;
          started_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "athlete_sports_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "athlete_sports_sport_id_fkey";
            columns: ["sport_id"];
            isOneToOne: false;
            referencedRelation: "sport_disciplines";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_channels: {
        Row: {
          created_at: string;
          engagement_id: string;
          id: string;
          is_locked: boolean;
          locked_at: string | null;
          read_only_until: string | null;
        };
        Insert: {
          created_at?: string;
          engagement_id: string;
          id?: string;
          is_locked?: boolean;
          locked_at?: string | null;
          read_only_until?: string | null;
        };
        Update: {
          created_at?: string;
          engagement_id?: string;
          id?: string;
          is_locked?: boolean;
          locked_at?: string | null;
          read_only_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_chat_channel_engagement";
            columns: ["engagement_id"];
            isOneToOne: true;
            referencedRelation: "coach_athlete_engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          channel_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          channel_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          channel_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey";
            columns: ["channel_id"];
            isOneToOne: false;
            referencedRelation: "chat_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_athlete_engagements: {
        Row: {
          athlete_id: string;
          can_create_plans: boolean | null;
          can_see_meals: boolean | null;
          can_see_tests: boolean | null;
          can_see_tracking: boolean | null;
          coach_id: string;
          competition_id: string | null;
          created_at: string | null;
          end_reason: string | null;
          ended_at: string | null;
          ended_by: string | null;
          expected_end: string | null;
          id: string;
          invite_code: string | null;
          purpose: string;
          sport_id: string | null;
          started_at: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          athlete_id: string;
          can_create_plans?: boolean | null;
          can_see_meals?: boolean | null;
          can_see_tests?: boolean | null;
          can_see_tracking?: boolean | null;
          coach_id: string;
          competition_id?: string | null;
          created_at?: string | null;
          end_reason?: string | null;
          ended_at?: string | null;
          ended_by?: string | null;
          expected_end?: string | null;
          id?: string;
          invite_code?: string | null;
          purpose?: string;
          sport_id?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          athlete_id?: string;
          can_create_plans?: boolean | null;
          can_see_meals?: boolean | null;
          can_see_tests?: boolean | null;
          can_see_tracking?: boolean | null;
          coach_id?: string;
          competition_id?: string | null;
          created_at?: string | null;
          end_reason?: string | null;
          ended_at?: string | null;
          ended_by?: string | null;
          expected_end?: string | null;
          id?: string;
          invite_code?: string | null;
          purpose?: string;
          sport_id?: string | null;
          started_at?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "coach_athlete_engagements_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_athlete_engagements_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_athlete_engagements_competition_id_fkey";
            columns: ["competition_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_athlete_engagements_ended_by_fkey";
            columns: ["ended_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_athlete_engagements_sport_id_fkey";
            columns: ["sport_id"];
            isOneToOne: false;
            referencedRelation: "sport_disciplines";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_profiles: {
        Row: {
          bio: string | null;
          certification: string | null;
          city: string | null;
          created_at: string;
          gym_name: string | null;
          id: string;
          onboarding_done: boolean;
          specialties: string[] | null;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          certification?: string | null;
          city?: string | null;
          created_at?: string;
          gym_name?: string | null;
          id: string;
          onboarding_done?: boolean;
          specialties?: string[] | null;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          certification?: string | null;
          city?: string | null;
          created_at?: string;
          gym_name?: string | null;
          id?: string;
          onboarding_done?: boolean;
          specialties?: string[] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      competitions: {
        Row: {
          athlete_id: string;
          competition_date: string;
          created_at: string;
          discipline: string | null;
          id: string;
          location: string | null;
          notes: string | null;
          result: string | null;
          title: string;
          updated_at: string;
          weight_class: string | null;
        };
        Insert: {
          athlete_id: string;
          competition_date: string;
          created_at?: string;
          discipline?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          result?: string | null;
          title: string;
          updated_at?: string;
          weight_class?: string | null;
        };
        Update: {
          athlete_id?: string;
          competition_date?: string;
          created_at?: string;
          discipline?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          result?: string | null;
          title?: string;
          updated_at?: string;
          weight_class?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competitions_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      crs_norms: {
        Row: {
          age_factor_curve: Json;
          base_target: number;
          exercise: string;
          gender_factor: Json;
          updated_at: string;
          weight_factor_curve: Json;
        };
        Insert: {
          age_factor_curve: Json;
          base_target: number;
          exercise: string;
          gender_factor: Json;
          updated_at?: string;
          weight_factor_curve: Json;
        };
        Update: {
          age_factor_curve?: Json;
          base_target?: number;
          exercise?: string;
          gender_factor?: Json;
          updated_at?: string;
          weight_factor_curve?: Json;
        };
        Relationships: [];
      };
      crs_tests: {
        Row: {
          archetype: string | null;
          athlete_id: string;
          burpees_60s: number | null;
          client_uuid: string | null;
          completed_at: string | null;
          created_at: string;
          high_knees_contacts: number | null;
          id: string;
          plank_sec: number | null;
          pushups_60s: number | null;
          rank_label: string | null;
          score: number | null;
          squats_60s: number | null;
          started_at: string;
          status: string;
        };
        Insert: {
          archetype?: string | null;
          athlete_id: string;
          burpees_60s?: number | null;
          client_uuid?: string | null;
          completed_at?: string | null;
          created_at?: string;
          high_knees_contacts?: number | null;
          id?: string;
          plank_sec?: number | null;
          pushups_60s?: number | null;
          rank_label?: string | null;
          score?: number | null;
          squats_60s?: number | null;
          started_at?: string;
          status?: string;
        };
        Update: {
          archetype?: string | null;
          athlete_id?: string;
          burpees_60s?: number | null;
          client_uuid?: string | null;
          completed_at?: string | null;
          created_at?: string;
          high_knees_contacts?: number | null;
          id?: string;
          plank_sec?: number | null;
          pushups_60s?: number | null;
          rank_label?: string | null;
          score?: number | null;
          squats_60s?: number | null;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crs_tests_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_tracking: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null;
          athlete_id: string;
          calories_kcal: number | null;
          client_uuid: string | null;
          created_at: string;
          date: string;
          duration_min: number | null;
          engagement_id: string | null;
          id: string;
          mood: Database["public"]["Enums"]["mood_level"] | null;
          notes: string | null;
          physical_condition: Database["public"]["Enums"]["physical_condition"] | null;
          rpe: number | null;
          sleep_quality: Database["public"]["Enums"]["sleep_quality"] | null;
          soreness: boolean;
          soreness_region: string | null;
          srpe: number | null;
          trained: boolean;
          updated_at: string;
          water_l: number | null;
          weight_kg: number | null;
        };
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          athlete_id: string;
          calories_kcal?: number | null;
          client_uuid?: string | null;
          created_at?: string;
          date: string;
          duration_min?: number | null;
          engagement_id?: string | null;
          id?: string;
          mood?: Database["public"]["Enums"]["mood_level"] | null;
          notes?: string | null;
          physical_condition?: Database["public"]["Enums"]["physical_condition"] | null;
          rpe?: number | null;
          sleep_quality?: Database["public"]["Enums"]["sleep_quality"] | null;
          soreness?: boolean;
          soreness_region?: string | null;
          srpe?: number | null;
          trained?: boolean;
          updated_at?: string;
          water_l?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          athlete_id?: string;
          calories_kcal?: number | null;
          client_uuid?: string | null;
          created_at?: string;
          date?: string;
          duration_min?: number | null;
          engagement_id?: string | null;
          id?: string;
          mood?: Database["public"]["Enums"]["mood_level"] | null;
          notes?: string | null;
          physical_condition?: Database["public"]["Enums"]["physical_condition"] | null;
          rpe?: number | null;
          sleep_quality?: Database["public"]["Enums"]["sleep_quality"] | null;
          soreness?: boolean;
          soreness_region?: string | null;
          srpe?: number | null;
          trained?: boolean;
          updated_at?: string;
          water_l?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "daily_tracking_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_tracking_engagement";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "coach_athlete_engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_code_redemptions: {
        Row: {
          athlete_id: string;
          code_id: string;
          engagement_id: string | null;
          id: string;
          redeemed_at: string;
        };
        Insert: {
          athlete_id: string;
          code_id: string;
          engagement_id?: string | null;
          id?: string;
          redeemed_at?: string;
        };
        Update: {
          athlete_id?: string;
          code_id?: string;
          engagement_id?: string | null;
          id?: string;
          redeemed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_code_redemptions_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_code_redemptions_code_id_fkey";
            columns: ["code_id"];
            isOneToOne: false;
            referencedRelation: "engagement_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_ecr_engagement";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "coach_athlete_engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_codes: {
        Row: {
          coach_id: string;
          code: string;
          created_at: string;
          default_permissions: Json;
          expires_at: string;
          id: string;
          internal_label: string | null;
          max_uses: number;
          purpose: string;
          revoked_at: string | null;
          uses_count: number;
        };
        Insert: {
          coach_id: string;
          code: string;
          created_at?: string;
          default_permissions?: Json;
          expires_at: string;
          id?: string;
          internal_label?: string | null;
          max_uses?: number;
          purpose?: string;
          revoked_at?: string | null;
          uses_count?: number;
        };
        Update: {
          coach_id?: string;
          code?: string;
          created_at?: string;
          default_permissions?: Json;
          expires_at?: string;
          id?: string;
          internal_label?: string | null;
          max_uses?: number;
          purpose?: string;
          revoked_at?: string | null;
          uses_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_codes_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      health_record_shares: {
        Row: {
          engagement_id: string;
          id: string;
          record_id: string;
          revoked_at: string | null;
          shared_at: string | null;
        };
        Insert: {
          engagement_id: string;
          id?: string;
          record_id: string;
          revoked_at?: string | null;
          shared_at?: string | null;
        };
        Update: {
          engagement_id?: string;
          id?: string;
          record_id?: string;
          revoked_at?: string | null;
          shared_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "health_record_shares_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "coach_athlete_engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "health_record_shares_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "health_records";
            referencedColumns: ["id"];
          },
        ];
      };
      health_records: {
        Row: {
          athlete_id: string;
          body_region: string | null;
          category: string;
          created_at: string | null;
          description: string | null;
          diagnosed_at: string | null;
          document_url: string | null;
          id: string;
          resolved_at: string | null;
          severity: string | null;
          status: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          athlete_id: string;
          body_region?: string | null;
          category: string;
          created_at?: string | null;
          description?: string | null;
          diagnosed_at?: string | null;
          document_url?: string | null;
          id?: string;
          resolved_at?: string | null;
          severity?: string | null;
          status?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          athlete_id?: string;
          body_region?: string | null;
          category?: string;
          created_at?: string | null;
          description?: string | null;
          diagnosed_at?: string | null;
          document_url?: string | null;
          id?: string;
          resolved_at?: string | null;
          severity?: string | null;
          status?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "health_records_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      level_thresholds: {
        Row: {
          level: number;
          rank_color: string | null;
          title: string;
          xp_required: number;
        };
        Insert: {
          level: number;
          rank_color?: string | null;
          title: string;
          xp_required: number;
        };
        Update: {
          level?: number;
          rank_color?: string | null;
          title?: string;
          xp_required?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string | null;
          data: Json | null;
          id: string;
          read: boolean | null;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          body?: string | null;
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          read?: boolean | null;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          body?: string | null;
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          read?: boolean | null;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_records: {
        Row: {
          achieved_at: string | null;
          athlete_id: string | null;
          created_at: string | null;
          exercise: string;
          id: string;
          previous_best: number | null;
          record_value: number;
          source: string | null;
          source_id: string | null;
          unit: string;
        };
        Insert: {
          achieved_at?: string | null;
          athlete_id?: string | null;
          created_at?: string | null;
          exercise: string;
          id?: string;
          previous_best?: number | null;
          record_value: number;
          source?: string | null;
          source_id?: string | null;
          unit: string;
        };
        Update: {
          achieved_at?: string | null;
          athlete_id?: string | null;
          created_at?: string | null;
          exercise?: string;
          id?: string;
          previous_best?: number | null;
          record_value?: number;
          source?: string | null;
          source_id?: string | null;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "personal_records_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      session_completions: {
        Row: {
          athlete_id: string | null;
          athlete_note: string | null;
          coach_feedback: string | null;
          coach_rating: number | null;
          completed_at: string | null;
          feedback_at: string | null;
          id: string;
          rpe: number | null;
          session_id: string | null;
        };
        Insert: {
          athlete_id?: string | null;
          athlete_note?: string | null;
          coach_feedback?: string | null;
          coach_rating?: number | null;
          completed_at?: string | null;
          feedback_at?: string | null;
          id?: string;
          rpe?: number | null;
          session_id?: string | null;
        };
        Update: {
          athlete_id?: string | null;
          athlete_note?: string | null;
          coach_feedback?: string | null;
          coach_rating?: number | null;
          completed_at?: string | null;
          feedback_at?: string | null;
          id?: string;
          rpe?: number | null;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "session_completions_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_completions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      sport_disciplines: {
        Row: {
          category: string | null;
          created_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      streaks: {
        Row: {
          current_streak: number | null;
          id: string;
          last_tracked_date: string | null;
          longest_streak: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          current_streak?: number | null;
          id?: string;
          last_tracked_date?: string | null;
          longest_streak?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          current_streak?: number | null;
          id?: string;
          last_tracked_date?: string | null;
          longest_streak?: number | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      training_exercises: {
        Row: {
          duration_sec: number | null;
          id: string;
          name: string;
          notes: string | null;
          position: number;
          reps: number | null;
          rest_sec: number | null;
          session_id: string;
          sets: number | null;
          weight_kg: number | null;
        };
        Insert: {
          duration_sec?: number | null;
          id?: string;
          name: string;
          notes?: string | null;
          position?: number;
          reps?: number | null;
          rest_sec?: number | null;
          session_id: string;
          sets?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          duration_sec?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          position?: number;
          reps?: number | null;
          rest_sec?: number | null;
          session_id?: string;
          sets?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_exercises_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_plans: {
        Row: {
          archived_at: string | null;
          athlete_id: string | null;
          created_at: string;
          description: string | null;
          ends_on: string | null;
          engagement_id: string | null;
          id: string;
          is_template: boolean;
          owner_id: string;
          starts_on: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          athlete_id?: string | null;
          created_at?: string;
          description?: string | null;
          ends_on?: string | null;
          engagement_id?: string | null;
          id?: string;
          is_template?: boolean;
          owner_id: string;
          starts_on?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          athlete_id?: string | null;
          created_at?: string;
          description?: string | null;
          ends_on?: string | null;
          engagement_id?: string | null;
          id?: string;
          is_template?: boolean;
          owner_id?: string;
          starts_on?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_plans_engagement";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "coach_athlete_engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_plans_athlete_id_fkey";
            columns: ["athlete_id"];
            isOneToOne: false;
            referencedRelation: "athlete_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_plans_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      training_sessions: {
        Row: {
          day_offset: number;
          id: string;
          notes: string | null;
          plan_id: string;
          position: number;
          title: string;
        };
        Insert: {
          day_offset: number;
          id?: string;
          notes?: string | null;
          plan_id: string;
          position?: number;
          title: string;
        };
        Update: {
          day_offset?: number;
          id?: string;
          notes?: string | null;
          plan_id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_sessions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "training_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          achievement_id: string | null;
          id: string;
          unlocked_at: string | null;
          user_id: string | null;
        };
        Insert: {
          achievement_id?: string | null;
          id?: string;
          unlocked_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          achievement_id?: string | null;
          id?: string;
          unlocked_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey";
            columns: ["achievement_id"];
            isOneToOne: false;
            referencedRelation: "achievements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          created_at: string | null;
          id: string;
          language: string | null;
          profile_visible: boolean | null;
          reminder_meals: string | null;
          reminder_tracking: string | null;
          reminder_training: string | null;
          show_in_rankings: boolean | null;
          theme: string | null;
          units: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          language?: string | null;
          profile_visible?: boolean | null;
          reminder_meals?: string | null;
          reminder_tracking?: string | null;
          reminder_training?: string | null;
          show_in_rankings?: boolean | null;
          theme?: string | null;
          units?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          language?: string | null;
          profile_visible?: boolean | null;
          reminder_meals?: string | null;
          reminder_tracking?: string | null;
          reminder_training?: string | null;
          show_in_rankings?: boolean | null;
          theme?: string | null;
          units?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          ai_consent: boolean;
          ai_consent_at: string | null;
          avatar_url: string | null;
          created_at: string;
          deletion_requested_at: string | null;
          deletion_scheduled_at: string | null;
          display_name: string;
          email: string;
          id: string;
          last_seen_at: string | null;
          level: number;
          level_title: string;
          locale: Database["public"]["Enums"]["language"];
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
          subscription_tier: string;
          updated_at: string;
          xp_total: number;
        };
        Insert: {
          ai_consent?: boolean;
          ai_consent_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_scheduled_at?: string | null;
          display_name: string;
          email: string;
          id: string;
          last_seen_at?: string | null;
          level?: number;
          level_title?: string;
          locale?: Database["public"]["Enums"]["language"];
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          subscription_tier?: string;
          updated_at?: string;
          xp_total?: number;
        };
        Update: {
          ai_consent?: boolean;
          ai_consent_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          deletion_requested_at?: string | null;
          deletion_scheduled_at?: string | null;
          display_name?: string;
          email?: string;
          id?: string;
          last_seen_at?: string | null;
          level?: number;
          level_title?: string;
          locale?: Database["public"]["Enums"]["language"];
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          subscription_tier?: string;
          updated_at?: string;
          xp_total?: number;
        };
        Relationships: [];
      };
      xp_log: {
        Row: {
          action: string;
          context: Json | null;
          created_at: string | null;
          id: string;
          user_id: string | null;
          xp_amount: number;
        };
        Insert: {
          action: string;
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          user_id?: string | null;
          xp_amount: number;
        };
        Update: {
          action?: string;
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          user_id?: string | null;
          xp_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "xp_log_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_rules: {
        Row: {
          action: string;
          created_at: string | null;
          description: string | null;
          id: string;
          xp_amount: number;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          xp_amount: number;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          xp_amount?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abort_crs_test: { Args: { p_test_id: string }; Returns: undefined };
      can_coach_see_competition: {
        Args: { p_competition_id: string };
        Returns: boolean;
      };
      can_coach_see_health_record: {
        Args: { p_record_id: string };
        Returns: boolean;
      };
      cleanup_expired_tracking: { Args: never; Returns: undefined };
      clone_plan: { Args: { p_plan_id: string }; Returns: string };
      complete_crs_test: { Args: { p_test_id: string }; Returns: string };
      end_engagement: {
        Args: { p_end_reason?: string; p_engagement_id: string };
        Returns: string;
      };
      generate_engagement_code: {
        Args: {
          p_internal_label?: string;
          p_max_uses?: number;
          p_permissions?: Json;
          p_purpose?: string;
          p_valid_days?: number;
        };
        Returns: {
          code: string;
          expires_at: string;
        }[];
      };
      get_active_competition_prep: {
        Args: { p_user_id: string };
        Returns: {
          competition_id: string;
          competition_name: string;
          days_remaining: number;
          event_date: string;
          phase: string;
          weight_class: string;
        }[];
      };
      get_coach_sport_groups: {
        Args: never;
        Returns: {
          athlete_count: number;
          sport_id: string;
          sport_name: string;
          sport_slug: string;
        }[];
      };
      get_coach_team: {
        Args: { p_sport_id?: string };
        Returns: {
          athlete_name: string;
          athlete_user_id: string;
          avatar_url: string;
          can_create_plans: boolean;
          can_see_meals: boolean;
          can_see_tracking: boolean;
          days_active: number;
          engagement_id: string;
          purpose: string;
          sport_name: string;
          sport_slug: string;
          started_at: string;
          status: string;
        }[];
      };
      grant_xp: {
        Args: { p_action: string; p_context?: Json };
        Returns: {
          leveled_up: boolean;
          new_level: number;
          new_title: string;
          new_xp_total: number;
        }[];
      };
      is_coach_of_user: { Args: { p_user_id: string }; Returns: boolean };
      is_competition_prep_active: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      is_linked_coach: { Args: { athlete: string }; Returns: boolean };
      is_linked_coach_with_meals: {
        Args: { p_athlete_id: string };
        Returns: boolean;
      };
      is_linked_coach_with_plans: {
        Args: { athlete: string };
        Returns: boolean;
      };
      is_linked_coach_with_tests: {
        Args: { athlete: string };
        Returns: boolean;
      };
      is_linked_coach_with_tracking: {
        Args: { athlete: string };
        Returns: boolean;
      };
      is_self: { Args: { target_user: string }; Returns: boolean };
      notify_data_expiry: { Args: never; Returns: undefined };
      own_athlete_profile_id: { Args: never; Returns: string };
      pause_engagement: { Args: { p_engagement_id: string }; Returns: string };
      redeem_engagement_code: { Args: { p_code: string }; Returns: string };
      request_account_deletion: { Args: never; Returns: string };
      reset_expired_streaks: { Args: never; Returns: number };
      resume_engagement: { Args: { p_engagement_id: string }; Returns: string };
      revoke_engagement_code: { Args: { p_code_id: string }; Returns: string };
      save_crs_exercise: {
        Args: { p_exercise: string; p_test_id: string; p_value: number };
        Returns: undefined;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      start_crs_test: { Args: { p_client_uuid?: string }; Returns: string };
      utc_date: { Args: { ts: string }; Returns: string };
    };
    Enums: {
      activity_level: "keine" | "moderat" | "hoch" | "extrem";
      gender: "male" | "female" | "diverse" | "prefer_not_to_say";
      language: "de" | "en";
      mood_level: "sehr_schlecht" | "schlecht" | "mittel" | "gut" | "sehr_gut";
      physical_condition: "gut" | "mittel" | "schlecht";
      sleep_quality: "gut" | "mittel" | "schlecht";
      user_role: "athlete" | "coach" | "both";
      user_status: "active" | "paused" | "pending_deletion" | "deleted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      activity_level: ["keine", "moderat", "hoch", "extrem"],
      gender: ["male", "female", "diverse", "prefer_not_to_say"],
      language: ["de", "en"],
      mood_level: ["sehr_schlecht", "schlecht", "mittel", "gut", "sehr_gut"],
      physical_condition: ["gut", "mittel", "schlecht"],
      sleep_quality: ["gut", "mittel", "schlecht"],
      user_role: ["athlete", "coach", "both"],
      user_status: ["active", "paused", "pending_deletion", "deleted"],
    },
  },
} as const;
