export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      browsing_activities: {
        Row: {
          category: string | null
          content_summary: string | null
          created_at: string
          domain: string
          duration_seconds: number | null
          id: string
          interaction_count: number | null
          productivity_level: string | null
          scroll_depth: number | null
          session_id: string
          tab_active: boolean | null
          title: string | null
          url: string
          user_id: string
          visited_at: string
        }
        Insert: {
          category?: string | null
          content_summary?: string | null
          created_at?: string
          domain: string
          duration_seconds?: number | null
          id?: string
          interaction_count?: number | null
          productivity_level?: string | null
          scroll_depth?: number | null
          session_id: string
          tab_active?: boolean | null
          title?: string | null
          url: string
          user_id: string
          visited_at?: string
        }
        Update: {
          category?: string | null
          content_summary?: string | null
          created_at?: string
          domain?: string
          duration_seconds?: number | null
          id?: string
          interaction_count?: number | null
          productivity_level?: string | null
          scroll_depth?: number | null
          session_id?: string
          tab_active?: boolean | null
          title?: string | null
          url?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_browsing_activities_session"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "browsing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      browsing_daily_summaries: {
        Row: {
          created_at: string
          date: string
          distracted_time_seconds: number | null
          distraction_periods: number | null
          focus_periods: number | null
          id: string
          most_visited_sites: Json | null
          neutral_time_seconds: number | null
          productive_time_seconds: number | null
          productivity_score: number | null
          top_categories: Json | null
          total_browsing_time_seconds: number | null
          total_sites_visited: number | null
          total_tab_switches: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          distracted_time_seconds?: number | null
          distraction_periods?: number | null
          focus_periods?: number | null
          id?: string
          most_visited_sites?: Json | null
          neutral_time_seconds?: number | null
          productive_time_seconds?: number | null
          productivity_score?: number | null
          top_categories?: Json | null
          total_browsing_time_seconds?: number | null
          total_sites_visited?: number | null
          total_tab_switches?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          distracted_time_seconds?: number | null
          distraction_periods?: number | null
          focus_periods?: number | null
          id?: string
          most_visited_sites?: Json | null
          neutral_time_seconds?: number | null
          productive_time_seconds?: number | null
          productivity_score?: number | null
          top_categories?: Json | null
          total_browsing_time_seconds?: number | null
          total_sites_visited?: number | null
          total_tab_switches?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      browsing_sessions: {
        Row: {
          category_breakdown: Json | null
          created_at: string
          distracted_time_seconds: number | null
          duration_seconds: number | null
          ended_at: string | null
          focus_session_id: string | null
          id: string
          neutral_time_seconds: number | null
          productive_time_seconds: number | null
          productivity_score: number | null
          started_at: string
          top_category: string | null
          total_sites_visited: number | null
          total_tab_switches: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_breakdown?: Json | null
          created_at?: string
          distracted_time_seconds?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          focus_session_id?: string | null
          id?: string
          neutral_time_seconds?: number | null
          productive_time_seconds?: number | null
          productivity_score?: number | null
          started_at?: string
          top_category?: string | null
          total_sites_visited?: number | null
          total_tab_switches?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_breakdown?: Json | null
          created_at?: string
          distracted_time_seconds?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          focus_session_id?: string | null
          id?: string
          neutral_time_seconds?: number | null
          productive_time_seconds?: number | null
          productivity_score?: number | null
          started_at?: string
          top_category?: string | null
          total_sites_visited?: number | null
          total_tab_switches?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_browsing_sessions_focus_session"
            columns: ["focus_session_id"]
            isOneToOne: false
            referencedRelation: "self_quantify_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_research_anonymous_quotas: {
        Row: {
          created_at: string
          daily_count: number | null
          fingerprint: string
          id: string
          ip_address: string | null
          last_used_at: string | null
          reset_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_count?: number | null
          fingerprint: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          reset_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_count?: number | null
          fingerprint?: string
          id?: string
          ip_address?: string | null
          last_used_at?: string | null
          reset_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deep_research_edge_function_metrics: {
        Row: {
          api_key_index: number | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          key_switched: boolean | null
          model_name: string | null
          response_time_ms: number | null
          retry_count: number | null
          status: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          api_key_index?: number | null
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          key_switched?: boolean | null
          model_name?: string | null
          response_time_ms?: number | null
          retry_count?: number | null
          status: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          api_key_index?: number | null
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          key_switched?: boolean | null
          model_name?: string | null
          response_time_ms?: number | null
          retry_count?: number | null
          status?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      deep_research_error_logs: {
        Row: {
          component_name: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          id: string
          route: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          id?: string
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          id?: string
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deep_research_profiles: {
        Row: {
          cerebras_api_keys: string[] | null
          created_at: string
          default_workflow: string | null
          id: string
          perplexity_api_key: string | null
          tavily_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cerebras_api_keys?: string[] | null
          created_at?: string
          default_workflow?: string | null
          id?: string
          perplexity_api_key?: string | null
          tavily_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cerebras_api_keys?: string[] | null
          created_at?: string
          default_workflow?: string | null
          id?: string
          perplexity_api_key?: string | null
          tavily_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deep_research_sessions: {
        Row: {
          brief: string | null
          created_at: string
          evaluation: string | null
          final_report: string | null
          id: string
          status: string
          sub_tasks: Json | null
          task_decomposition: string | null
          topic: string
          updated_at: string
          user_id: string
          workflow_type: string
        }
        Insert: {
          brief?: string | null
          created_at?: string
          evaluation?: string | null
          final_report?: string | null
          id?: string
          status?: string
          sub_tasks?: Json | null
          task_decomposition?: string | null
          topic: string
          updated_at?: string
          user_id: string
          workflow_type: string
        }
        Update: {
          brief?: string | null
          created_at?: string
          evaluation?: string | null
          final_report?: string | null
          id?: string
          status?: string
          sub_tasks?: Json | null
          task_decomposition?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
          workflow_type?: string
        }
        Relationships: []
      }
      deep_research_shared_reports: {
        Row: {
          brief: string | null
          created_at: string
          evaluation: string | null
          expires_at: string | null
          final_report: string | null
          id: string
          is_active: boolean | null
          session_id: string | null
          share_id: string
          sub_tasks: Json | null
          task_decomposition: string | null
          topic: string
          user_id: string
          view_count: number | null
          workflow_type: string | null
        }
        Insert: {
          brief?: string | null
          created_at?: string
          evaluation?: string | null
          expires_at?: string | null
          final_report?: string | null
          id?: string
          is_active?: boolean | null
          session_id?: string | null
          share_id: string
          sub_tasks?: Json | null
          task_decomposition?: string | null
          topic: string
          user_id: string
          view_count?: number | null
          workflow_type?: string | null
        }
        Update: {
          brief?: string | null
          created_at?: string
          evaluation?: string | null
          expires_at?: string | null
          final_report?: string | null
          id?: string
          is_active?: boolean | null
          session_id?: string | null
          share_id?: string
          sub_tasks?: Json | null
          task_decomposition?: string | null
          topic?: string
          user_id?: string
          view_count?: number | null
          workflow_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deep_research_shared_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "deep_research_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_research_storage_configs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          project_name: string
          r2_access_key_id: string | null
          r2_account_id: string | null
          r2_bucket_name: string | null
          r2_public_url: string | null
          r2_secret_access_key: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          project_name?: string
          r2_access_key_id?: string | null
          r2_account_id?: string | null
          r2_bucket_name?: string | null
          r2_public_url?: string | null
          r2_secret_access_key?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          project_name?: string
          r2_access_key_id?: string | null
          r2_account_id?: string | null
          r2_bucket_name?: string | null
          r2_public_url?: string | null
          r2_secret_access_key?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deep_research_usage_quotas: {
        Row: {
          created_at: string
          id: string
          last_reset_at: string
          monthly_limit: number | null
          monthly_sessions: number
          total_sessions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_reset_at?: string
          monthly_limit?: number | null
          monthly_sessions?: number
          total_sessions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reset_at?: string
          monthly_limit?: number | null
          monthly_sessions?: number
          total_sessions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          app_version: string | null
          browser: string | null
          created_at: string
          device: string | null
          environment: string | null
          error_code: string | null
          error_fingerprint: string
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          metadata: Json | null
          os: string | null
          request_body: Json | null
          request_id: string | null
          request_method: string | null
          request_path: string | null
          resolution_note: string | null
          resolved_at: string | null
          route: string | null
          screen_resolution: string | null
          session_id: string | null
          source: string
          source_type: string | null
          status: string
          tags: string[] | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          browser?: string | null
          created_at?: string
          device?: string | null
          environment?: string | null
          error_code?: string | null
          error_fingerprint: string
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          metadata?: Json | null
          os?: string | null
          request_body?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          route?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          source: string
          source_type?: string | null
          status?: string
          tags?: string[] | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          browser?: string | null
          created_at?: string
          device?: string | null
          environment?: string | null
          error_code?: string | null
          error_fingerprint?: string
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          metadata?: Json | null
          os?: string | null
          request_body?: Json | null
          request_id?: string | null
          request_method?: string | null
          request_path?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          route?: string | null
          screen_resolution?: string | null
          session_id?: string | null
          source?: string
          source_type?: string | null
          status?: string
          tags?: string[] | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      image_trace_analyses: {
        Row: {
          algorithm: string
          completed_at: string | null
          created_at: string
          error: string | null
          features: Json | null
          id: string
          image_ids: string[] | null
          progress: number | null
          project_id: string
          similarity_matrix: Json | null
          started_at: string | null
          status: string
          summary: Json | null
          user_id: string
        }
        Insert: {
          algorithm?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          features?: Json | null
          id?: string
          image_ids?: string[] | null
          progress?: number | null
          project_id: string
          similarity_matrix?: Json | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          user_id: string
        }
        Update: {
          algorithm?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          features?: Json | null
          id?: string
          image_ids?: string[] | null
          progress?: number | null
          project_id?: string
          similarity_matrix?: Json | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_trace_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_trace_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_trace_documents: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          extracted_images_count: number | null
          file_size: number | null
          filename: string
          id: string
          mime_type: string | null
          project_id: string
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          extracted_images_count?: number | null
          file_size?: number | null
          filename: string
          id?: string
          mime_type?: string | null
          project_id: string
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          extracted_images_count?: number | null
          file_size?: number | null
          filename?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_trace_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_trace_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_trace_images: {
        Row: {
          created_at: string
          file_size: number | null
          filename: string
          hash: string | null
          height: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          original_filename: string | null
          project_id: string
          public_url: string | null
          storage_path: string | null
          thumbnail_url: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          filename: string
          hash?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          original_filename?: string | null
          project_id: string
          public_url?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          file_size?: number | null
          filename?: string
          hash?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          original_filename?: string | null
          project_id?: string
          public_url?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_trace_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_trace_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      image_trace_projects: {
        Row: {
          analysis_count: number
          created_at: string
          description: string | null
          id: string
          image_count: number
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_count?: number
          created_at?: string
          description?: string | null
          id?: string
          image_count?: number
          name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_count?: number
          created_at?: string
          description?: string | null
          id?: string
          image_count?: number
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      image_trace_shared_reports: {
        Row: {
          analysis_id: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          password_hash: string | null
          project_id: string | null
          report_data: Json
          share_id: string
          title: string
          user_id: string
          view_count: number
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          project_id?: string | null
          report_data?: Json
          share_id: string
          title: string
          user_id: string
          view_count?: number
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          password_hash?: string | null
          project_id?: string | null
          report_data?: Json
          share_id?: string
          title?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "image_trace_shared_reports_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "image_trace_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_trace_shared_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "image_trace_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_cached_models: {
        Row: {
          cached_at: string
          created_at: string
          expires_at: string
          id: string
          models: Json
          provider_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cached_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          models?: Json
          provider_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cached_at?: string
          created_at?: string
          expires_at?: string
          id?: string
          models?: Json
          provider_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      obscura_api_hub_call_logs: {
        Row: {
          completion_tokens: number | null
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          error_message: string | null
          fallback_count: number | null
          fallback_reason: string | null
          id: string
          model: string
          prompt_tokens: number | null
          provider_id: string
          response_time_ms: number | null
          routing_strategy_used: string | null
          status: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          fallback_count?: number | null
          fallback_reason?: string | null
          id?: string
          model: string
          prompt_tokens?: number | null
          provider_id: string
          response_time_ms?: number | null
          routing_strategy_used?: string | null
          status: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          fallback_count?: number | null
          fallback_reason?: string | null
          id?: string
          model?: string
          prompt_tokens?: number | null
          provider_id?: string
          response_time_ms?: number | null
          routing_strategy_used?: string | null
          status?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_call_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_comparison_sessions: {
        Row: {
          created_at: string
          id: string
          models: Json
          results: Json
          system_prompt: string | null
          title: string
          user_id: string
          user_prompt: string
        }
        Insert: {
          created_at?: string
          id?: string
          models?: Json
          results?: Json
          system_prompt?: string | null
          title: string
          user_id: string
          user_prompt: string
        }
        Update: {
          created_at?: string
          id?: string
          models?: Json
          results?: Json
          system_prompt?: string | null
          title?: string
          user_id?: string
          user_prompt?: string
        }
        Relationships: []
      }
      obscura_api_hub_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          model: string
          provider_id: string
          title: string
          total_tokens: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          model: string
          provider_id: string
          title: string
          total_tokens?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          model?: string
          provider_id?: string
          title?: string
          total_tokens?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_prompt_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      obscura_api_hub_prompt_tag_relations: {
        Row: {
          prompt_id: string
          tag_id: string
        }
        Insert: {
          prompt_id: string
          tag_id: string
        }
        Update: {
          prompt_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_prompt"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tag"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_prompt_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_prompt_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      obscura_api_hub_prompts: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_public: boolean
          system_prompt: string | null
          title: string
          updated_at: string
          use_count: number
          user_id: string
          user_prompt: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          system_prompt?: string | null
          title: string
          updated_at?: string
          use_count?: number
          user_id: string
          user_prompt: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          system_prompt?: string | null
          title?: string
          updated_at?: string
          use_count?: number
          user_id?: string
          user_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_prompt_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_provider_health: {
        Row: {
          api_key_index: number
          created_at: string | null
          error_type: string | null
          failure_count: number | null
          id: string
          is_healthy: boolean | null
          last_failure_at: string | null
          last_rotated_at: string | null
          last_success_at: string | null
          provider_id: string
          successful_requests: number | null
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          api_key_index: number
          created_at?: string | null
          error_type?: string | null
          failure_count?: number | null
          id?: string
          is_healthy?: boolean | null
          last_failure_at?: string | null
          last_rotated_at?: string | null
          last_success_at?: string | null
          provider_id: string
          successful_requests?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          api_key_index?: number
          created_at?: string | null
          error_type?: string | null
          failure_count?: number | null
          id?: string
          is_healthy?: boolean | null
          last_failure_at?: string | null
          last_rotated_at?: string | null
          last_success_at?: string | null
          provider_id?: string
          successful_requests?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_health_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_providers: {
        Row: {
          api_keys: string[]
          base_url: string
          cost_multiplier: number | null
          created_at: string
          current_key_index: number
          id: string
          is_active: boolean
          latency_threshold_ms: number | null
          max_tokens: number | null
          name: string
          priority: number | null
          provider_type: string
          supports_fallback: boolean | null
          timeout_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_keys: string[]
          base_url: string
          cost_multiplier?: number | null
          created_at?: string
          current_key_index?: number
          id?: string
          is_active?: boolean
          latency_threshold_ms?: number | null
          max_tokens?: number | null
          name: string
          priority?: number | null
          provider_type: string
          supports_fallback?: boolean | null
          timeout_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_keys?: string[]
          base_url?: string
          cost_multiplier?: number | null
          created_at?: string
          current_key_index?: number
          id?: string
          is_active?: boolean
          latency_threshold_ms?: number | null
          max_tokens?: number | null
          name?: string
          priority?: number | null
          provider_type?: string
          supports_fallback?: boolean | null
          timeout_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      obscura_api_hub_system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      obscura_api_hub_token_usage: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          error_message: string | null
          fallback_count: number | null
          fallback_reason: string | null
          id: string
          model: string
          project_identifier: string | null
          prompt_tokens: number | null
          provider_id: string | null
          response_time_ms: number | null
          routing_strategy_used: string | null
          selected_provider_priority: number | null
          status: string
          token_id: string
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          fallback_count?: number | null
          fallback_reason?: string | null
          id?: string
          model: string
          project_identifier?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          response_time_ms?: number | null
          routing_strategy_used?: string | null
          selected_provider_priority?: number | null
          status: string
          token_id: string
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          fallback_count?: number | null
          fallback_reason?: string | null
          id?: string
          model?: string
          project_identifier?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          response_time_ms?: number | null
          routing_strategy_used?: string | null
          selected_provider_priority?: number | null
          status?: string
          token_id?: string
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_token_usage_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_token_usage_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      obscura_api_hub_tokens: {
        Row: {
          allowed_models: string[] | null
          created_at: string
          expires_at: string | null
          id: string
          is_internal: boolean | null
          last_used_at: string | null
          name: string
          project_identifier: string | null
          quota: number | null
          rate_limit: number | null
          routing_strategy: string | null
          status: string
          token: string
          updated_at: string
          used_quota: number | null
          user_id: string
        }
        Insert: {
          allowed_models?: string[] | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_internal?: boolean | null
          last_used_at?: string | null
          name: string
          project_identifier?: string | null
          quota?: number | null
          rate_limit?: number | null
          routing_strategy?: string | null
          status?: string
          token: string
          updated_at?: string
          used_quota?: number | null
          user_id: string
        }
        Update: {
          allowed_models?: string[] | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_internal?: boolean | null
          last_used_at?: string | null
          name?: string
          project_identifier?: string | null
          quota?: number | null
          rate_limit?: number | null
          routing_strategy?: string | null
          status?: string
          token?: string
          updated_at?: string
          used_quota?: number | null
          user_id?: string
        }
        Relationships: []
      }
      paper_agent_ai_providers: {
        Row: {
          api_keys: string[]
          available_models: string[] | null
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          name: string
          selected_model: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_keys: string[]
          available_models?: string[] | null
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          name: string
          selected_model?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_keys?: string[]
          available_models?: string[] | null
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          name?: string
          selected_model?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_agent_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_drafts: {
        Row: {
          abstract: string | null
          conclusion: string | null
          created_at: string
          discussion: string | null
          id: string
          introduction: string | null
          methodology: string | null
          project_id: string
          results: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          abstract?: string | null
          conclusion?: string | null
          created_at?: string
          discussion?: string | null
          id?: string
          introduction?: string | null
          methodology?: string | null
          project_id: string
          results?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          abstract?: string | null
          conclusion?: string | null
          created_at?: string
          discussion?: string | null
          id?: string
          introduction?: string | null
          methodology?: string | null
          project_id?: string
          results?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_experiment_designs: {
        Row: {
          created_at: string
          data_analysis: string | null
          hypothesis: string
          id: string
          methodology: string
          project_id: string
          results: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_analysis?: string | null
          hypothesis: string
          id?: string
          methodology: string
          project_id: string
          results?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_analysis?: string | null
          hypothesis?: string
          id?: string
          methodology?: string
          project_id?: string
          results?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_experiment_designs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_figures: {
        Row: {
          caption: string | null
          code: string | null
          code_type: string | null
          created_at: string
          figure_id: string
          id: string
          image_data: string | null
          project_id: string
          section: string | null
          title: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          code?: string | null
          code_type?: string | null
          created_at?: string
          figure_id: string
          id?: string
          image_data?: string | null
          project_id: string
          section?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          code?: string | null
          code_type?: string | null
          created_at?: string
          figure_id?: string
          id?: string
          image_data?: string | null
          project_id?: string
          section?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_figures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_literature_reviews: {
        Row: {
          created_at: string
          id: string
          keywords: string[] | null
          project_id: string
          summary: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          keywords?: string[] | null
          project_id: string
          summary?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          keywords?: string[] | null
          project_id?: string
          summary?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_literature_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_papers: {
        Row: {
          abstract: string | null
          authors: string[] | null
          created_at: string
          id: string
          literature_review_id: string
          source: string
          title: string
          url: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string[] | null
          created_at?: string
          id?: string
          literature_review_id: string
          source: string
          title: string
          url?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string[] | null
          created_at?: string
          id?: string
          literature_review_id?: string
          source?: string
          title?: string
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_papers_literature_review_id_fkey"
            columns: ["literature_review_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_literature_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_projects: {
        Row: {
          created_at: string
          current_step: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_agent_references: {
        Row: {
          citation: string
          created_at: string
          format: string
          id: string
          project_id: string
        }
        Insert: {
          citation: string
          created_at?: string
          format: string
          id?: string
          project_id: string
        }
        Update: {
          citation?: string
          created_at?: string
          format?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_reviews: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          reviewer: string
          suggestions: string[] | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          reviewer: string
          suggestions?: string[] | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          reviewer?: string
          suggestions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      paper_agent_search_configs: {
        Row: {
          api_key: string | null
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_agent_shared_projects: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          project_id: string
          share_id: string
          title: string
          updated_at: string
          user_id: string
          view_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          project_id: string
          share_id: string
          title: string
          updated_at?: string
          user_id: string
          view_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          project_id?: string
          share_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paper_agent_shared_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "paper_agent_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          onboarding_skipped_at: string | null
          onboarding_step: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          onboarding_skipped_at?: string | null
          onboarding_step?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_skipped_at?: string | null
          onboarding_step?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          last_active_at: string | null
          metadata: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_active_at?: string | null
          metadata?: Json | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_active_at?: string | null
          metadata?: Json | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          identifier: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          identifier: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          identifier?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      public_nav_entries: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
          page_id: string
          sort_order: number | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          page_id: string
          sort_order?: number | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          page_id?: string
          sort_order?: number | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_nav_entries_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_nav_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      public_nav_entry_tags: {
        Row: {
          entry_id: string
          tag_id: string
        }
        Insert: {
          entry_id: string
          tag_id: string
        }
        Update: {
          entry_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_nav_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "public_nav_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_nav_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "public_nav_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      public_nav_invite_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          owner_id: string
          page_id: string
          permission: string
          use_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          owner_id: string
          page_id: string
          permission?: string
          use_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          owner_id?: string
          page_id?: string
          permission?: string
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_nav_invite_codes_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_nav_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      public_nav_pages: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          is_public: boolean | null
          name: string
          public_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          name: string
          public_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_public?: boolean | null
          name?: string
          public_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_nav_shares: {
        Row: {
          accepted: boolean | null
          created_at: string
          id: string
          owner_id: string
          page_id: string
          permission: string
          shared_to_id: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          id?: string
          owner_id: string
          page_id: string
          permission?: string
          shared_to_id: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          id?: string
          owner_id?: string
          page_id?: string
          permission?: string
          shared_to_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_nav_shares_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_nav_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      public_nav_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          page_id: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          page_id: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          page_id?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_nav_tags_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "public_nav_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      self_quantify_daily_summaries: {
        Row: {
          avg_focus_score: number | null
          avg_smile: number | null
          created_at: string
          date: string
          dominant_emotion: string | null
          emotion_distribution: Json | null
          id: string
          sitting_percentage: number | null
          standing_percentage: number | null
          total_duration_seconds: number | null
          total_sessions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_focus_score?: number | null
          avg_smile?: number | null
          created_at?: string
          date: string
          dominant_emotion?: string | null
          emotion_distribution?: Json | null
          id?: string
          sitting_percentage?: number | null
          standing_percentage?: number | null
          total_duration_seconds?: number | null
          total_sessions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_focus_score?: number | null
          avg_smile?: number | null
          created_at?: string
          date?: string
          dominant_emotion?: string | null
          emotion_distribution?: Json | null
          id?: string
          sitting_percentage?: number | null
          standing_percentage?: number | null
          total_duration_seconds?: number | null
          total_sessions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      self_quantify_data_points: {
        Row: {
          emotion_confidence: number | null
          eyebrow_raise: number | null
          eyes_closed: number | null
          fps: number | null
          hands_raised: boolean | null
          id: string
          latency_ms: number | null
          leaning: number | null
          mouth_open: number | null
          primary_emotion: string | null
          session_id: string
          sitting: boolean | null
          smile: number | null
          standing: boolean | null
          timestamp: string
        }
        Insert: {
          emotion_confidence?: number | null
          eyebrow_raise?: number | null
          eyes_closed?: number | null
          fps?: number | null
          hands_raised?: boolean | null
          id?: string
          latency_ms?: number | null
          leaning?: number | null
          mouth_open?: number | null
          primary_emotion?: string | null
          session_id: string
          sitting?: boolean | null
          smile?: number | null
          standing?: boolean | null
          timestamp?: string
        }
        Update: {
          emotion_confidence?: number | null
          eyebrow_raise?: number | null
          eyes_closed?: number | null
          fps?: number | null
          hands_raised?: boolean | null
          id?: string
          latency_ms?: number | null
          leaning?: number | null
          mouth_open?: number | null
          primary_emotion?: string | null
          session_id?: string
          sitting?: boolean | null
          smile?: number | null
          standing?: boolean | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_quantify_data_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "self_quantify_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      self_quantify_sessions: {
        Row: {
          avg_eyebrow_raise: number | null
          avg_eyes_closed: number | null
          avg_mouth_open: number | null
          avg_smile: number | null
          created_at: string
          data_points_count: number | null
          duration_seconds: number | null
          emotion_breakdown: Json | null
          ended_at: string | null
          hands_raised_duration_seconds: number | null
          id: string
          model_complexity: number | null
          model_source: string | null
          primary_emotion: string | null
          sitting_duration_seconds: number | null
          standing_duration_seconds: number | null
          started_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          avg_eyebrow_raise?: number | null
          avg_eyes_closed?: number | null
          avg_mouth_open?: number | null
          avg_smile?: number | null
          created_at?: string
          data_points_count?: number | null
          duration_seconds?: number | null
          emotion_breakdown?: Json | null
          ended_at?: string | null
          hands_raised_duration_seconds?: number | null
          id?: string
          model_complexity?: number | null
          model_source?: string | null
          primary_emotion?: string | null
          sitting_duration_seconds?: number | null
          standing_duration_seconds?: number | null
          started_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          avg_eyebrow_raise?: number | null
          avg_eyes_closed?: number | null
          avg_mouth_open?: number | null
          avg_smile?: number | null
          created_at?: string
          data_points_count?: number | null
          duration_seconds?: number | null
          emotion_breakdown?: Json | null
          ended_at?: string | null
          hands_raised_duration_seconds?: number | null
          id?: string
          model_complexity?: number | null
          model_source?: string | null
          primary_emotion?: string | null
          sitting_duration_seconds?: number | null
          standing_duration_seconds?: number | null
          started_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shared_project_discussions: {
        Row: {
          content: string
          created_at: string
          discussion_type: string
          id: string
          metadata: Json | null
          parent_id: string | null
          project_identifier: string
          reactions: Json | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          discussion_type?: string
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          project_identifier: string
          reactions?: Json | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          discussion_type?: string
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          project_identifier?: string
          reactions?: Json | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_project_discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "shared_project_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_project_discussions_project_identifier_fkey"
            columns: ["project_identifier"]
            isOneToOne: false
            referencedRelation: "shared_project_registry"
            referencedColumns: ["project_identifier"]
          },
        ]
      }
      shared_project_registry: {
        Row: {
          api_endpoints: Json | null
          contact_info: Json | null
          created_at: string
          created_by: string | null
          database_tables: Json | null
          description: string | null
          features: Json | null
          full_description: string | null
          id: string
          metadata: Json | null
          project_identifier: string
          project_name: string
          status: string
          tech_stack: Json | null
          updated_at: string
          updated_by: string | null
          version: string | null
        }
        Insert: {
          api_endpoints?: Json | null
          contact_info?: Json | null
          created_at?: string
          created_by?: string | null
          database_tables?: Json | null
          description?: string | null
          features?: Json | null
          full_description?: string | null
          id?: string
          metadata?: Json | null
          project_identifier: string
          project_name: string
          status?: string
          tech_stack?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          api_endpoints?: Json | null
          contact_info?: Json | null
          created_at?: string
          created_by?: string | null
          database_tables?: Json | null
          description?: string | null
          features?: Json | null
          full_description?: string | null
          id?: string
          metadata?: Json | null
          project_identifier?: string
          project_name?: string
          status?: string
          tech_stack?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Relationships: []
      }
      site_categories: {
        Row: {
          allow_schedule: Json | null
          category: string
          created_at: string
          domain_pattern: string
          id: string
          is_blocked: boolean | null
          notes: string | null
          productivity_level: string
          productivity_score: number | null
          time_limit_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_schedule?: Json | null
          category: string
          created_at?: string
          domain_pattern: string
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          productivity_level?: string
          productivity_score?: number | null
          time_limit_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_schedule?: Json | null
          category?: string
          created_at?: string
          domain_pattern?: string
          id?: string
          is_blocked?: boolean | null
          notes?: string | null
          productivity_level?: string
          productivity_score?: number | null
          time_limit_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_achievements: {
        Row: {
          achievement_id: string
          achievement_name: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          achievement_name: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          achievement_name?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_assessment_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      stratup_signal_noise_assessment_questions: {
        Row: {
          category: string
          created_at: string | null
          difficulty: string
          id: string
          insight: string | null
          is_active: boolean | null
          options: Json
          question: string
          question_id: string
          scenario: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          difficulty?: string
          id?: string
          insight?: string | null
          is_active?: boolean | null
          options: Json
          question: string
          question_id: string
          scenario: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          difficulty?: string
          id?: string
          insight?: string | null
          is_active?: boolean | null
          options?: Json
          question?: string
          question_id?: string
          scenario?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stratup_signal_noise_assessment_results: {
        Row: {
          answers: Json
          category_scores: Json
          completed_at: string
          created_at: string
          id: string
          percentage: number
          total_questions: number
          total_score: number
          user_id: string
        }
        Insert: {
          answers?: Json
          category_scores?: Json
          completed_at?: string
          created_at?: string
          id?: string
          percentage: number
          total_questions: number
          total_score: number
          user_id: string
        }
        Update: {
          answers?: Json
          category_scores?: Json
          completed_at?: string
          created_at?: string
          id?: string
          percentage?: number
          total_questions?: number
          total_score?: number
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_case_library: {
        Row: {
          category: string
          company: string
          created_at: string
          description: string
          detailed_analysis: string | null
          difficulty: string | null
          estimated_time: string | null
          id: string
          insights: string[] | null
          is_public: boolean
          key_signal: string
          metrics: Json | null
          outcome: string
          region: string | null
          tags: string[] | null
          timeline: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          company: string
          created_at?: string
          description: string
          detailed_analysis?: string | null
          difficulty?: string | null
          estimated_time?: string | null
          id?: string
          insights?: string[] | null
          is_public?: boolean
          key_signal: string
          metrics?: Json | null
          outcome: string
          region?: string | null
          tags?: string[] | null
          timeline?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          company?: string
          created_at?: string
          description?: string
          detailed_analysis?: string | null
          difficulty?: string | null
          estimated_time?: string | null
          id?: string
          insights?: string[] | null
          is_public?: boolean
          key_signal?: string
          metrics?: Json | null
          outcome?: string
          region?: string | null
          tags?: string[] | null
          timeline?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_daily_challenge_results: {
        Row: {
          challenge_date: string
          completed_at: string
          id: string
          score: number
          time_spent_seconds: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          challenge_date: string
          completed_at?: string
          id?: string
          score?: number
          time_spent_seconds?: number | null
          total_questions: number
          user_id: string
        }
        Update: {
          challenge_date?: string
          completed_at?: string
          id?: string
          score?: number
          time_spent_seconds?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_daily_challenges: {
        Row: {
          challenge_date: string
          created_at: string
          event_ids: string[]
          id: string
        }
        Insert: {
          challenge_date: string
          created_at?: string
          event_ids: string[]
          id?: string
        }
        Update: {
          challenge_date?: string
          created_at?: string
          event_ids?: string[]
          id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_event_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_zh: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id: string
          is_active?: boolean | null
          name_en: string
          name_zh: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_zh?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      stratup_signal_noise_event_tag_relations: {
        Row: {
          event_id: string
          tag_id: string
        }
        Insert: {
          event_id: string
          tag_id: string
        }
        Update: {
          event_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stratup_signal_noise_event_tag_relations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "stratup_signal_noise_game_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stratup_signal_noise_event_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "stratup_signal_noise_event_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      stratup_signal_noise_event_tags: {
        Row: {
          category: string | null
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stratup_signal_noise_game_events: {
        Row: {
          category: string
          created_at: string | null
          deception_level: string
          description: string
          difficulty: string | null
          event_id: string
          expert_advice: string
          explanation: string
          frequency: string | null
          id: string
          industry: string[] | null
          is_active: boolean | null
          is_signal: boolean
          related_cases: string[] | null
          signal_strength: string
          sort_order: number | null
          startup_stage: string[] | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          deception_level: string
          description: string
          difficulty?: string | null
          event_id: string
          expert_advice: string
          explanation: string
          frequency?: string | null
          id?: string
          industry?: string[] | null
          is_active?: boolean | null
          is_signal: boolean
          related_cases?: string[] | null
          signal_strength: string
          sort_order?: number | null
          startup_stage?: string[] | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          deception_level?: string
          description?: string
          difficulty?: string | null
          event_id?: string
          expert_advice?: string
          explanation?: string
          frequency?: string | null
          id?: string
          industry?: string[] | null
          is_active?: boolean | null
          is_signal?: boolean
          related_cases?: string[] | null
          signal_strength?: string
          sort_order?: number | null
          startup_stage?: string[] | null
          title?: string
        }
        Relationships: []
      }
      stratup_signal_noise_game_records: {
        Row: {
          correct_count: number
          created_at: string
          events_answered: Json | null
          id: string
          level: number | null
          mode: string
          score: number
          streak: number | null
          total_count: number
          user_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          events_answered?: Json | null
          id?: string
          level?: number | null
          mode: string
          score?: number
          streak?: number | null
          total_count?: number
          user_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          events_answered?: Json | null
          id?: string
          level?: number | null
          mode?: string
          score?: number
          streak?: number | null
          total_count?: number
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_user_achievements: {
        Row: {
          achievement_desc: string | null
          achievement_id: string
          achievement_name: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_desc?: string | null
          achievement_id: string
          achievement_name: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_desc?: string | null
          achievement_id?: string
          achievement_name?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_user_apps: {
        Row: {
          app_identifier: string
          app_name: string
          id: string
          last_active_at: string | null
          metadata: Json | null
          registered_at: string
          user_id: string
        }
        Insert: {
          app_identifier: string
          app_name: string
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          registered_at?: string
          user_id: string
        }
        Update: {
          app_identifier?: string
          app_name?: string
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          registered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stratup_signal_noise_wrong_answers: {
        Row: {
          correct_answer: boolean
          created_at: string
          event_id: string
          id: string
          mastered: boolean | null
          reviewed_at: string | null
          user_answer: boolean
          user_id: string
        }
        Insert: {
          correct_answer: boolean
          created_at?: string
          event_id: string
          id?: string
          mastered?: boolean | null
          reviewed_at?: string | null
          user_answer: boolean
          user_id: string
        }
        Update: {
          correct_answer?: boolean
          created_at?: string
          event_id?: string
          id?: string
          mastered?: boolean | null
          reviewed_at?: string | null
          user_answer?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stratup_signal_noise_wrong_answers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "stratup_signal_noise_game_events"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          height: number | null
          id: string
          mime_type: string
          public_url: string
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          height?: number | null
          id?: string
          mime_type: string
          public_url: string
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          height?: number | null
          id?: string
          mime_type?: string
          public_url?: string
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_level: string
          achievement_type: string
          id: string
          metadata: Json | null
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_level: string
          achievement_type: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_level?: string
          achievement_type?: string
          id?: string
          metadata?: Json | null
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_focus_goals: {
        Row: {
          created_at: string | null
          daily_target_minutes: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_target_minutes?: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_target_minutes?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      deep_research_edge_function_stats: {
        Row: {
          avg_response_time: number | null
          function_name: string | null
          hour: string | null
          key_switches: number | null
          median_response_time: number | null
          other_errors: number | null
          p95_response_time: number | null
          rate_limit_errors: number | null
          successful_requests: number | null
          total_requests: number | null
          total_retries: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Relationships: []
      }
      provider_key_metrics: {
        Row: {
          api_key_index: number | null
          error_type: string | null
          failure_count: number | null
          is_healthy: boolean | null
          last_failure_at: string | null
          last_rotated_at: string | null
          last_success_at: string | null
          provider_id: string | null
          provider_name: string | null
          provider_type: string | null
          success_rate: number | null
          successful_requests: number | null
          total_requests: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_health_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "obscura_api_hub_providers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
