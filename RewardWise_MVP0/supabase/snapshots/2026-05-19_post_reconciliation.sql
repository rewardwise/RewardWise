-- Production schema snapshot captured 2026-05-19 post-reconciliation
-- of PR #116's ledger drift (10 dashboard-applied migrations were
-- marked reverted in the schema_migrations table).
--
-- This file is a forensic + bootstrap reference, NOT a migration.
-- The Supabase auto-apply workflow IGNORES this directory.
--
-- For local dev setup:
--   1. supabase start  (provisions auth/storage/realtime schemas)
--   2. psql "$DATABASE_URL" -f supabase/snapshots/2026-05-19_post_reconciliation.sql
--   3. supabase db reset  (applies the 6 migration files on top)
--
-- Do NOT apply this file to a database that already has the schema --
-- it will error on non-idempotent statements (triggers, policies,
-- constraints, indexes without IF NOT EXISTS).




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."travel_request_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actor_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_request_events_event_type_check" CHECK (("char_length"(TRIM(BOTH FROM "event_type")) > 0))
);


ALTER TABLE "public"."travel_request_events" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."travel_request_events"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
  v_event public.travel_request_events;
begin
  -- must be authenticated
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- validate event type
  if p_event_type is null or char_length(trim(p_event_type)) = 0 then
    raise exception 'event_type is required';
  end if;

  -- enforce ownership: user can only append to own request
  if not exists (
    select 1
    from public.travel_requests tr
    where tr.id = p_request_id
      and tr.user_id = v_uid
  ) then
    raise exception 'Request not found or not owned by user';
  end if;

  insert into public.travel_request_events (
    request_id,
    event_type,
    payload,
    actor_user_id
  )
  values (
    p_request_id,
    trim(p_event_type),
    coalesce(p_payload, '{}'::jsonb),
    v_uid
  )
  returning * into v_event;

  return v_event;
end;
$$;


ALTER FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_wallet"() RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select json_build_object(
    'cards', coalesce(
      (select json_agg(row_to_json(t)) from (
        select card_id, card_name, last_four_digits, points_balance,
               reward_program_id, reward_program_name, reward_program_code,
               currency_type, issuer_id, issuer_name
        from public.wallet_cards
        where user_id = auth.uid()
      ) t),
      '[]'::json
    ),
    'balances', coalesce(
      (select json_agg(row_to_json(t)) from (
        select balance_id, reward_program_id, balance, balance_updated_at,
               reward_program_name, reward_program_code, currency_type,
               issuer_id, issuer_name
        from public.wallet_balances
        where user_id = auth.uid()
      ) t),
      '[]'::json
    )
  );
$$;


ALTER FUNCTION "public"."get_my_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recommendations"("uid" "uuid") RETURNS TABLE("search_id" "uuid", "origin" "text", "destination_airport_id" "text", "trip_type" "text", "cabin" "text", "balance" numeric, "program_name" "text", "program_type" "text", "region" "text")
    LANGUAGE "sql"
    AS $$
    SELECT s.id AS search_id,
           s.origin,
           s.destination_airport_id,
           s.trip_type,
           s.cabin,
           w.balance,
           p.name AS program_name,
           p.type AS program_type,
           p.region
    FROM searches s
    LEFT JOIN wallets w ON s.user_id = w.user_id
    LEFT JOIN user_programs up ON s.user_id = up.user_id
    LEFT JOIN programs p ON up.program_id = p.id
    WHERE s.user_id = uid;
$$;


ALTER FUNCTION "public"."get_recommendations"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_programs"("uid" "uuid") RETURNS TABLE("program_id" "uuid", "name" "text", "type" "text", "region" "text")
    LANGUAGE "sql"
    AS $$
    SELECT p.id, p.name, p.type, p.region
    FROM user_programs up
    JOIN programs p ON up.program_id = p.id
    WHERE up.user_id = uid;
$$;


ALTER FUNCTION "public"."get_user_programs"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Create profiles row for onboarding state
  insert into public.profiles (user_id, onboarding_state)
  values (new.id, 'pending');

  -- Create or update users row (id = auth user id, email from auth)
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_interaction_corpus"("query_embedding" "public"."vector", "intent_filter" "text", "match_count" integer DEFAULT 2, "min_similarity" double precision DEFAULT 0.10) RETURNS TABLE("user_message" "text", "zoe_response" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    kb_interactions_corpus.user_message,
    kb_interactions_corpus.zoe_response,
    1 - (kb_interactions_corpus.embedding <=> query_embedding) as similarity
  from public.kb_interactions_corpus
  where kb_interactions_corpus.embedding is not null
    and (
      intent_filter is null
      or kb_interactions_corpus.intent = intent_filter
    )
    and (1 - (kb_interactions_corpus.embedding <=> query_embedding)) >= min_similarity
  order by kb_interactions_corpus.embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION "public"."search_interaction_corpus"("query_embedding" "public"."vector", "intent_filter" "text", "match_count" integer, "min_similarity" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_kb_articles"("query_embedding" "public"."vector", "categories" "text"[], "match_count" integer DEFAULT 4, "min_similarity" double precision DEFAULT 0.08) RETURNS TABLE("id" "uuid", "title" "text", "category" "text", "content" "text", "valid_as_of" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
    SELECT
        id,
        title,
        category,
        content,
        valid_as_of,
        1 - (embedding <=> query_embedding) AS similarity
    FROM kb_articles
    WHERE published_at IS NOT NULL
      AND category = ANY(categories)
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> query_embedding)) >= min_similarity
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_kb_articles"("query_embedding" "public"."vector", "categories" "text"[], "match_count" integer, "min_similarity" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_zoe_conversation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.zoe_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_zoe_conversation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_kb_articles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_kb_articles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.modified_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_modified_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_zoe_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_zoe_sessions_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."airports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "iata_code" "text" NOT NULL,
    "coordinates" "point",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "airports_iata_format" CHECK ((("char_length"(TRIM(BOTH FROM "iata_code")) = 3) AND (TRIM(BOTH FROM "iata_code") ~ '^[A-Z0-9]{3}$'::"text")))
);


ALTER TABLE "public"."airports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_role" "text",
    "is_authenticated" boolean DEFAULT false NOT NULL,
    "session_id" "text" NOT NULL,
    "anonymous_id" "text",
    "visit_id" "text",
    "event_name" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_source" "text",
    "event_version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "page_path" "text",
    "page_url" "text",
    "page_title" "text",
    "referrer" "text",
    "previous_page_path" "text",
    "next_page_path" "text",
    "duration_ms" integer,
    "latency_ms" integer,
    "time_since_session_start_ms" integer,
    "time_since_page_load_ms" integer,
    "element_name" "text",
    "element_type" "text",
    "element_text" "text",
    "element_id" "text",
    "element_class" "text",
    "element_role" "text",
    "element_href" "text",
    "element_label" "text",
    "element_aria_label" "text",
    "element_position_x" integer,
    "element_position_y" integer,
    "click_x" integer,
    "click_y" integer,
    "scroll_x" integer,
    "scroll_y" integer,
    "scroll_depth_percent" integer,
    "max_scroll_depth_percent" integer,
    "viewport_width" integer,
    "viewport_height" integer,
    "device_type" "text",
    "browser" "text",
    "browser_version" "text",
    "os" "text",
    "os_version" "text",
    "user_agent" "text",
    "screen_width" integer,
    "screen_height" integer,
    "pixel_ratio" numeric,
    "timezone" "text",
    "language" "text",
    "network_effective_type" "text",
    "network_downlink" numeric,
    "search_id" "uuid",
    "search_origin" "text",
    "search_destination" "text",
    "search_depart_date" "date",
    "search_return_date" "date",
    "search_trip_type" "text",
    "search_cabin" "text",
    "search_travelers" integer,
    "search_trigger_source" "text",
    "search_provider" "text",
    "search_success" boolean,
    "search_error_message" "text",
    "verdict_id" "uuid",
    "verdict_recommendation" "text",
    "verdict_confidence" "text",
    "cash_price" numeric,
    "award_points" integer,
    "award_fees" numeric,
    "cents_per_point" numeric,
    "historical_price_label" "text",
    "route_match_level" "text",
    "zoe_message_id" "text",
    "zoe_conversation_id" "text",
    "zoe_user_message" "text",
    "zoe_assistant_response" "text",
    "zoe_detected_origin" "text",
    "zoe_detected_destination" "text",
    "zoe_detected_depart_date" "date",
    "zoe_detected_return_date" "date",
    "zoe_detected_cabin" "text",
    "zoe_detected_trip_type" "text",
    "zoe_missing_fields" "text"[],
    "zoe_model_used" "text",
    "zoe_success" boolean,
    "zoe_error_message" "text",
    "feedback_id" "uuid",
    "feedback_rating" "text",
    "feedback_text" "text",
    "feedback_context" "text",
    "error_name" "text",
    "error_message" "text",
    "error_stack" "text",
    "api_endpoint" "text",
    "api_status_code" integer,
    "api_method" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "analytics_events_event_name_not_empty" CHECK (("length"(TRIM(BOTH FROM "event_name")) > 0)),
    CONSTRAINT "analytics_events_event_type_not_empty" CHECK (("length"(TRIM(BOTH FROM "event_type")) > 0)),
    CONSTRAINT "analytics_events_max_scroll_depth_range" CHECK ((("max_scroll_depth_percent" IS NULL) OR (("max_scroll_depth_percent" >= 0) AND ("max_scroll_depth_percent" <= 100)))),
    CONSTRAINT "analytics_events_scroll_depth_range" CHECK ((("scroll_depth_percent" IS NULL) OR (("scroll_depth_percent" >= 0) AND ("scroll_depth_percent" <= 100))))
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_events" IS 'Single isolated product analytics table for beta testing. Stores page views, clicks, searches, Zoe chats, verdict events, feedback, errors, and performance events.';



COMMENT ON COLUMN "public"."analytics_events"."cents_per_point" IS 'Internal analytics only. Do not expose CPP in customer-facing UI if product decision is to hide it.';



COMMENT ON COLUMN "public"."analytics_events"."zoe_user_message" IS 'Stores beta tester Zoe prompt/message for debugging assistant behavior. Do not store secrets or payment details.';



COMMENT ON COLUMN "public"."analytics_events"."zoe_assistant_response" IS 'Stores Zoe response text for debugging assistant behavior.';



COMMENT ON COLUMN "public"."analytics_events"."metadata" IS 'Flexible JSONB payload for event-specific data that does not need its own column yet.';



CREATE TABLE IF NOT EXISTS "public"."balances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_program_id" "uuid" NOT NULL,
    "balance" integer NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "balances_balance_non_negative" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_handoff_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "program" "text" NOT NULL,
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "depart_date" "date" NOT NULL,
    "return_date" "date",
    "travelers" integer NOT NULL,
    "cabin" "text",
    "verdict_type" "text" NOT NULL,
    "amount_cash" numeric,
    "amount_points" integer,
    "taxes" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_handoff_clicks_verdict_type_check" CHECK (("verdict_type" = ANY (ARRAY['cash'::"text", 'points'::"text"])))
);


ALTER TABLE "public"."booking_handoff_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."card_catalog" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "card_name" "text" NOT NULL,
    "issuer_id" "uuid" NOT NULL,
    "reward_program_id" "uuid" NOT NULL,
    "benefits_metadata" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "card_products_card_name_non_empty" CHECK (("btrim"("card_name") <> ''::"text"))
);


ALTER TABLE "public"."card_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_program_id" "uuid" NOT NULL,
    "card_name" "text",
    "last_four_digits" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "points_balance" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "cards_last_four_digits_check" CHECK (("last_four_digits" ~ '^[0-9]{4}$'::"text")),
    CONSTRAINT "cards_points_balance_non_negative" CHECK (("points_balance" >= 0))
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."experiments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "config" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "verdict_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "did_book" boolean,
    "booking_method" "text",
    CONSTRAINT "feedback_rating_range" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5)))),
    CONSTRAINT "user_feedback_booking_method_check" CHECK ((("booking_method" IS NULL) OR ("booking_method" = ANY (ARRAY['cash'::"text", 'points'::"text"]))))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."floor_cpp" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reward_program_id" "uuid" NOT NULL,
    "transfer_partner_id" "uuid",
    "cents_per_point" numeric(6,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "floor_cpp_non_negative" CHECK (("cents_per_point" >= (0)::numeric))
);


ALTER TABLE "public"."floor_cpp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issuers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issuers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(4096),
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_as_of" "text"
);


ALTER TABLE "public"."kb_articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_interactions_corpus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid",
    "intent" "text" NOT NULL,
    "user_message" "text" NOT NULL,
    "zoe_response" "text" NOT NULL,
    "embedding" "public"."vector"(4096),
    "approval_source" "text" NOT NULL,
    "rating" smallint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_interactions_corpus_approval_source_check" CHECK (("approval_source" = ANY (ARRAY['thumbs_up'::"text", 'search_triggered'::"text", 'pm_eval'::"text"]))),
    CONSTRAINT "kb_interactions_corpus_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."kb_interactions_corpus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_monitor_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "text" NOT NULL,
    "article_title" "text" NOT NULL,
    "changed" boolean DEFAULT false NOT NULL,
    "change_summary" "text",
    "confidence" "text",
    "dry_run" boolean DEFAULT false NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kb_monitor_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kb_monitor_health" AS
 SELECT DISTINCT ON ("article_id") "article_id",
    "article_title",
    "changed",
    "confidence",
    "change_summary",
    "checked_at" AS "last_checked"
   FROM "public"."kb_monitor_log"
  WHERE ("dry_run" = false)
  ORDER BY "article_id", "checked_at" DESC;


ALTER VIEW "public"."kb_monitor_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_monitor_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "dry_run" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "runtime_seconds" integer,
    "sources_total" integer DEFAULT 0 NOT NULL,
    "sources_successful" integer DEFAULT 0 NOT NULL,
    "changed_count" integer DEFAULT 0 NOT NULL,
    "unchanged_count" integer DEFAULT 0 NOT NULL,
    "deferred_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "groq_calls_used" integer DEFAULT 0 NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."kb_monitor_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_monitor_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "text" NOT NULL,
    "article_title" "text",
    "category" "text",
    "source_url" "text" NOT NULL,
    "source_domain" "text",
    "content_hash" "text" NOT NULL,
    "clean_text" "text" NOT NULL,
    "last_updated_text" "text",
    "content_chars" integer,
    "scrape_status" "text" DEFAULT 'success'::"text" NOT NULL,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kb_monitor_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kb_monitor_snapshot_health" AS
 SELECT "article_id",
    "article_title",
    "category",
    "source_domain",
    "source_url",
    "content_chars",
    "scrape_status",
    "checked_at",
    ("now"() - "checked_at") AS "age"
   FROM "public"."kb_monitor_snapshots"
  ORDER BY "checked_at" DESC;


ALTER VIEW "public"."kb_monitor_snapshot_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kb_update_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "article_id" "text" NOT NULL,
    "article_title" "text",
    "category" "text",
    "source_url" "text",
    "source_domain" "text",
    "change_summary" "text" NOT NULL,
    "confidence" "text" DEFAULT 'low'::"text" NOT NULL,
    "old_content_hash" "text",
    "new_content_hash" "text",
    "old_content_excerpt" "text",
    "new_content_excerpt" "text",
    "suggested_content" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_update_candidates_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'published'::"text"])))
);


ALTER TABLE "public"."kb_update_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kb_pending_update_candidates" AS
 SELECT "id",
    "article_id",
    "article_title",
    "category",
    "source_domain",
    "change_summary",
    "confidence",
    "status",
    "created_at"
   FROM "public"."kb_update_candidates"
  WHERE ("status" = 'pending'::"text")
  ORDER BY "created_at" DESC;


ALTER VIEW "public"."kb_pending_update_candidates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kb_recent_changes" AS
 SELECT "article_id",
    "article_title",
    "change_summary",
    "confidence",
    "checked_at"
   FROM "public"."kb_monitor_log"
  WHERE (("changed" = true) AND ("dry_run" = false))
  ORDER BY "checked_at" DESC
 LIMIT 100;


ALTER VIEW "public"."kb_recent_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "watchlist_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "onboarding_state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "modified_at" timestamp with time zone DEFAULT "now"(),
    "day_pass_expires_at" timestamp with time zone,
    CONSTRAINT "profiles_onboarding_state_check" CHECK (("onboarding_state" = ANY (ARRAY['pending'::"text", 'cards_added'::"text", 'first_search'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "region" "text" NOT NULL,
    "issuer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "program_region_check" CHECK (("region" = ANY (ARRAY['US'::"text", 'EU'::"text", 'APAC'::"text", 'LATAM'::"text", 'GLOBAL'::"text"]))),
    CONSTRAINT "program_type_check" CHECK ((("type" IS NULL) OR ("type" = ANY (ARRAY['airline'::"text", 'hotel'::"text", 'transferable'::"text"]))))
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_search_trials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_hash" "text" NOT NULL,
    "user_agent_hash" "text",
    "origin" "text",
    "destination" "text",
    "departure_date" "date",
    "return_date" "date",
    "cabin" "text",
    "travelers" integer,
    "status" "text" DEFAULT 'started'::"text" NOT NULL,
    "request_payload" "jsonb",
    "response_summary" "jsonb",
    "error_message" "text",
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."public_search_trials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_id" "uuid" NOT NULL,
    "verdict" "text" NOT NULL,
    "breakdown" "jsonb",
    "explanation" "text",
    "confidence" numeric(5,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recommendations_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "recommendations_verdict_check" CHECK (("verdict" = ANY (ARRAY['use_points'::"text", 'pay_cash'::"text", 'wait'::"text"])))
);


ALTER TABLE "public"."recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_programs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "currency_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "issuer_id" "uuid",
    CONSTRAINT "reward_programs_currency_type_check" CHECK (("currency_type" = ANY (ARRAY['flexible'::"text", 'airline'::"text", 'hotel'::"text"])))
);


ALTER TABLE "public"."reward_programs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."reward_programs"."issuer_id" IS 'FK to issuers replaces legacy issuer text column';



CREATE TABLE IF NOT EXISTS "public"."search_access_grants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "search_id" "uuid" NOT NULL,
    "stripe_checkout_session_id" "text",
    "amount_cents" integer DEFAULT 299 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "search_access_grants_amount_cents_check" CHECK ((("amount_cents" > 0) AND ("amount_cents" <= 1000000)))
);


ALTER TABLE "public"."search_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."searches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "departure_date" "date" NOT NULL,
    "return_date" "date",
    "passengers" integer DEFAULT 1 NOT NULL,
    "cabin" "text",
    "raw_query" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trip_type" "text" DEFAULT 'roundtrip'::"text" NOT NULL,
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    CONSTRAINT "searches_origin_destination_different" CHECK (("origin" <> "destination")),
    CONSTRAINT "searches_passengers_check" CHECK (("passengers" >= 1)),
    CONSTRAINT "searches_trip_type_check" CHECK (("trip_type" = ANY (ARRAY['roundtrip'::"text", 'oneway'::"text"])))
);


ALTER TABLE "public"."searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "plan" "text" DEFAULT 'pro'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone,
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['pro'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_partners" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "from_program_id" "uuid" NOT NULL,
    "to_program_id" "uuid" NOT NULL,
    "ratio" numeric(6,4) NOT NULL,
    "min_transfer" integer,
    "latency" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transfer_partners_min_transfer_non_negative" CHECK ((("min_transfer" IS NULL) OR ("min_transfer" >= 0))),
    CONSTRAINT "transfer_partners_ratio_positive" CHECK (("ratio" > (0)::numeric))
);


ALTER TABLE "public"."transfer_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_ratios" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "reward_program_id" "uuid" NOT NULL,
    "transfer_partner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bonus_multiplier" numeric(5,2) DEFAULT 1.0 NOT NULL,
    "bonus_expires_at" timestamp with time zone,
    "transfer_ratio" numeric(6,4) NOT NULL,
    CONSTRAINT "transfer_ratios_ratio_positive" CHECK (("transfer_ratio" > (0)::numeric))
);


ALTER TABLE "public"."transfer_ratios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."travel_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "search_id" "uuid",
    "verdict_id" "uuid",
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "departure_date" "date" NOT NULL,
    "return_date" "date",
    "trip_type" "text" DEFAULT 'roundtrip'::"text" NOT NULL,
    "passengers" integer DEFAULT 1 NOT NULL,
    "cabin" "text",
    "budget_cash" numeric(10,2),
    "budget_points" integer,
    "constraints" "jsonb",
    "notes" "text",
    "quoted_price" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "sla_hours" integer,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "travel_requests_budget_cash_check" CHECK ((("budget_cash" IS NULL) OR ("budget_cash" >= (0)::numeric))),
    CONSTRAINT "travel_requests_budget_points_check" CHECK ((("budget_points" IS NULL) OR ("budget_points" >= 0))),
    CONSTRAINT "travel_requests_dates_valid" CHECK ((("return_date" IS NULL) OR ("return_date" >= "departure_date"))),
    CONSTRAINT "travel_requests_origin_destination_different" CHECK (("origin" <> "destination")),
    CONSTRAINT "travel_requests_passengers_check" CHECK (("passengers" >= 1)),
    CONSTRAINT "travel_requests_quoted_price_check" CHECK ((("quoted_price" IS NULL) OR ("quoted_price" >= (0)::numeric))),
    CONSTRAINT "travel_requests_sla_hours_check" CHECK ((("sla_hours" IS NULL) OR ("sla_hours" > 0))),
    CONSTRAINT "travel_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'payment_pending'::"text", 'paid'::"text", 'in_progress'::"text", 'delivered'::"text", 'needs_info'::"text", 'cancelled'::"text", 'failed'::"text"]))),
    CONSTRAINT "travel_requests_tier_check" CHECK (("tier" = ANY (ARRAY['standard'::"text", 'premium'::"text"]))),
    CONSTRAINT "travel_requests_trip_type_check" CHECK (("trip_type" = ANY (ARRAY['roundtrip'::"text", 'oneway'::"text"])))
);


ALTER TABLE "public"."travel_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_program_balance" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    "reward_program_id" AS "program_id",
    "balance"
   FROM "public"."balances" "b";


ALTER VIEW "public"."user_program_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_programs" (
    "user_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_programs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_wallets" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    "id" AS "card_id",
    "points_balance" AS "balance"
   FROM "public"."cards" "c";


ALTER VIEW "public"."user_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wallet_completed" boolean
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verdicts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "search_id" "uuid" NOT NULL,
    "recommendation" "text" NOT NULL,
    "summary" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calculated_cpp" numeric(6,4),
    "cash_price_used" numeric(10,2),
    "points_cost_used" integer,
    CONSTRAINT "verdicts_recommendation_check" CHECK (("recommendation" = ANY (ARRAY['use_points'::"text", 'pay_cash'::"text", 'wait'::"text"])))
);


ALTER TABLE "public"."verdicts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallet_balances" WITH ("security_invoker"='on') AS
 SELECT "b"."id" AS "balance_id",
    "b"."user_id",
    "b"."reward_program_id",
    "b"."balance",
    "b"."modified_at" AS "balance_updated_at",
    "rp"."name" AS "reward_program_name",
    "rp"."code" AS "reward_program_code",
    "rp"."currency_type",
    "i"."id" AS "issuer_id",
    "i"."name" AS "issuer_name"
   FROM (("public"."balances" "b"
     JOIN "public"."reward_programs" "rp" ON (("rp"."id" = "b"."reward_program_id")))
     LEFT JOIN "public"."issuers" "i" ON (("i"."id" = "rp"."issuer_id")));


ALTER VIEW "public"."wallet_balances" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wallet_cards" WITH ("security_invoker"='on') AS
 SELECT "c"."id" AS "card_id",
    "c"."user_id",
    "c"."card_name",
    "c"."last_four_digits",
    "c"."points_balance",
    "c"."reward_program_id",
    "rp"."name" AS "reward_program_name",
    "rp"."code" AS "reward_program_code",
    "rp"."currency_type",
    "i"."id" AS "issuer_id",
    "i"."name" AS "issuer_name"
   FROM (("public"."cards" "c"
     JOIN "public"."reward_programs" "rp" ON (("rp"."id" = "c"."reward_program_id")))
     LEFT JOIN "public"."issuers" "i" ON (("i"."id" = "rp"."issuer_id")));


ALTER VIEW "public"."wallet_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "balance" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watchlist" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "depart_date" "date" NOT NULL,
    "return_date" "date",
    "cabin" "text" DEFAULT 'economy'::"text" NOT NULL,
    "passengers" integer DEFAULT 1 NOT NULL,
    "trip_type" "text" DEFAULT 'roundtrip'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cash_price" numeric(10,2),
    "points_required" integer,
    "program" "text",
    "verdict" "text" NOT NULL,
    CONSTRAINT "watchlist_origin_destination_different" CHECK (("origin" <> "destination")),
    CONSTRAINT "watchlist_passengers_check" CHECK (("passengers" >= 1)),
    CONSTRAINT "watchlist_trip_type_check" CHECK (("trip_type" = ANY (ARRAY['roundtrip'::"text", 'oneway'::"text"]))),
    CONSTRAINT "watchlist_verdict_check" CHECK (("verdict" = ANY (ARRAY['points'::"text", 'cash'::"text"])))
);


ALTER TABLE "public"."watchlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoe_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New conversation'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."zoe_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoe_evals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interaction_id" "uuid",
    "pm_score" smallint NOT NULL,
    "factual_accuracy" boolean DEFAULT true NOT NULL,
    "one_question_pass" boolean DEFAULT true NOT NULL,
    "hallucination" boolean DEFAULT false NOT NULL,
    "response_length_ok" boolean DEFAULT true NOT NULL,
    "resolution_achieved" boolean DEFAULT true NOT NULL,
    "failure_type" "text",
    "original_response" "text" NOT NULL,
    "corrected_response" "text",
    "pm_notes" "text",
    "reviewer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zoe_evals_failure_type_check" CHECK (("failure_type" = ANY (ARRAY['hallucination'::"text", 'multi_question'::"text", 'wrong_intent'::"text", 'off_topic'::"text", 'too_long'::"text", 'wrong_data'::"text", 'poor_tone'::"text", NULL::"text"]))),
    CONSTRAINT "zoe_evals_pm_score_check" CHECK ((("pm_score" >= 1) AND ("pm_score" <= 5)))
);


ALTER TABLE "public"."zoe_evals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoe_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "intent" "text" NOT NULL,
    "user_message" "text" NOT NULL,
    "zoe_response" "text" NOT NULL,
    "feedback_signal" "text",
    "feedback_score" smallint,
    "is_voice" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zoe_interactions_feedback_score_check" CHECK ((("feedback_score" >= 1) AND ("feedback_score" <= 5))),
    CONSTRAINT "zoe_interactions_feedback_signal_check" CHECK (("feedback_signal" = ANY (ARRAY['thumbs_up'::"text", 'search_triggered'::"text", 'session_continued'::"text", 'pm_eval'::"text"])))
);


ALTER TABLE "public"."zoe_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoe_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "zoe_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."zoe_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zoe_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "conversation_id" "uuid",
    "trip_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stage" "text" DEFAULT 'collecting'::"text" NOT NULL,
    "last_asked_slot" "text",
    "conversation_mode" "text" DEFAULT 'standard'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zoe_sessions_conversation_mode_check" CHECK (("conversation_mode" = ANY (ARRAY['standard'::"text", 'voice'::"text"]))),
    CONSTRAINT "zoe_sessions_stage_check" CHECK (("stage" = ANY (ARRAY['collecting'::"text", 'searching'::"text", 'explaining_verdict'::"text", 'off_trip'::"text", 'reset'::"text"])))
);


ALTER TABLE "public"."zoe_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."airports"
    ADD CONSTRAINT "airports_iata_unique" UNIQUE ("iata_code");



ALTER TABLE ONLY "public"."airports"
    ADD CONSTRAINT "airports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balances"
    ADD CONSTRAINT "balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balances"
    ADD CONSTRAINT "balances_user_program_unique" UNIQUE ("user_id", "reward_program_id");



ALTER TABLE ONLY "public"."booking_handoff_clicks"
    ADD CONSTRAINT "booking_handoff_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."card_catalog"
    ADD CONSTRAINT "card_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."card_catalog"
    ADD CONSTRAINT "card_products_unique_per_program" UNIQUE ("issuer_id", "reward_program_id", "card_name");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."experiments"
    ADD CONSTRAINT "experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."floor_cpp"
    ADD CONSTRAINT "floor_cpp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issuers"
    ADD CONSTRAINT "issuers_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."issuers"
    ADD CONSTRAINT "issuers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_articles"
    ADD CONSTRAINT "kb_articles_title_unique" UNIQUE ("title");



ALTER TABLE ONLY "public"."kb_interactions_corpus"
    ADD CONSTRAINT "kb_interactions_corpus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_monitor_log"
    ADD CONSTRAINT "kb_monitor_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_monitor_runs"
    ADD CONSTRAINT "kb_monitor_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_monitor_snapshots"
    ADD CONSTRAINT "kb_monitor_snapshots_article_id_key" UNIQUE ("article_id");



ALTER TABLE ONLY "public"."kb_monitor_snapshots"
    ADD CONSTRAINT "kb_monitor_snapshots_article_source_unique" UNIQUE ("article_id", "source_url");



ALTER TABLE ONLY "public"."kb_monitor_snapshots"
    ADD CONSTRAINT "kb_monitor_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kb_update_candidates"
    ADD CONSTRAINT "kb_update_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_notifications"
    ADD CONSTRAINT "payment_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "program_code_unique" UNIQUE ("code");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "program_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_search_trials"
    ADD CONSTRAINT "public_search_trials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_programs"
    ADD CONSTRAINT "reward_programs_code_unique" UNIQUE ("code");



ALTER TABLE ONLY "public"."reward_programs"
    ADD CONSTRAINT "reward_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_access_grants"
    ADD CONSTRAINT "search_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."search_access_grants"
    ADD CONSTRAINT "search_access_grants_user_search_key" UNIQUE ("user_id", "search_id");



ALTER TABLE ONLY "public"."searches"
    ADD CONSTRAINT "searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transfer_partners"
    ADD CONSTRAINT "transfer_partners_from_to_unique" UNIQUE ("from_program_id", "to_program_id");



ALTER TABLE ONLY "public"."transfer_partners"
    ADD CONSTRAINT "transfer_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_ratios"
    ADD CONSTRAINT "transfer_ratios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_ratios"
    ADD CONSTRAINT "transfer_ratios_program_partner_unique" UNIQUE ("reward_program_id", "transfer_partner_id");



ALTER TABLE ONLY "public"."travel_request_events"
    ADD CONSTRAINT "travel_request_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."travel_requests"
    ADD CONSTRAINT "travel_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_programs"
    ADD CONSTRAINT "user_programs_pkey" PRIMARY KEY ("user_id", "program_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verdicts"
    ADD CONSTRAINT "verdicts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."watchlist"
    ADD CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zoe_conversations"
    ADD CONSTRAINT "zoe_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zoe_evals"
    ADD CONSTRAINT "zoe_evals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zoe_interactions"
    ADD CONSTRAINT "zoe_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zoe_messages"
    ADD CONSTRAINT "zoe_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zoe_sessions"
    ADD CONSTRAINT "zoe_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "analytics_events_anonymous_id_idx" ON "public"."analytics_events" USING "btree" ("anonymous_id");



CREATE INDEX "analytics_events_created_at_idx" ON "public"."analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_events_event_name_idx" ON "public"."analytics_events" USING "btree" ("event_name");



CREATE INDEX "analytics_events_event_type_idx" ON "public"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "analytics_events_feedback_id_idx" ON "public"."analytics_events" USING "btree" ("feedback_id");



CREATE INDEX "analytics_events_metadata_gin_idx" ON "public"."analytics_events" USING "gin" ("metadata");



CREATE INDEX "analytics_events_page_path_idx" ON "public"."analytics_events" USING "btree" ("page_path");



CREATE INDEX "analytics_events_search_id_idx" ON "public"."analytics_events" USING "btree" ("search_id");



CREATE INDEX "analytics_events_search_route_idx" ON "public"."analytics_events" USING "btree" ("search_origin", "search_destination");



CREATE INDEX "analytics_events_search_success_idx" ON "public"."analytics_events" USING "btree" ("search_success");



CREATE INDEX "analytics_events_session_created_at_idx" ON "public"."analytics_events" USING "btree" ("session_id", "created_at");



CREATE INDEX "analytics_events_session_id_idx" ON "public"."analytics_events" USING "btree" ("session_id");



CREATE INDEX "analytics_events_user_created_at_idx" ON "public"."analytics_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "analytics_events_user_email_idx" ON "public"."analytics_events" USING "btree" ("user_email");



CREATE INDEX "analytics_events_user_id_idx" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "analytics_events_verdict_id_idx" ON "public"."analytics_events" USING "btree" ("verdict_id");



CREATE INDEX "analytics_events_verdict_recommendation_idx" ON "public"."analytics_events" USING "btree" ("verdict_recommendation");



CREATE INDEX "analytics_events_zoe_conversation_id_idx" ON "public"."analytics_events" USING "btree" ("zoe_conversation_id");



CREATE INDEX "analytics_events_zoe_success_idx" ON "public"."analytics_events" USING "btree" ("zoe_success");



CREATE INDEX "booking_handoff_clicks_program_created_at_idx" ON "public"."booking_handoff_clicks" USING "btree" ("program", "created_at" DESC);



CREATE INDEX "idx_airports_iata_code" ON "public"."airports" USING "btree" ("iata_code");



CREATE INDEX "idx_balances_reward_program_id" ON "public"."balances" USING "btree" ("reward_program_id");



CREATE INDEX "idx_balances_user_id" ON "public"."balances" USING "btree" ("user_id");



CREATE INDEX "idx_card_products_issuer_id" ON "public"."card_catalog" USING "btree" ("issuer_id");



CREATE INDEX "idx_card_products_reward_program_id" ON "public"."card_catalog" USING "btree" ("reward_program_id");



CREATE INDEX "idx_cards_reward_program_id" ON "public"."cards" USING "btree" ("reward_program_id");



CREATE INDEX "idx_cards_user_id" ON "public"."cards" USING "btree" ("user_id");



CREATE INDEX "idx_floor_cpp_reward_program_id" ON "public"."floor_cpp" USING "btree" ("reward_program_id");



CREATE INDEX "idx_floor_cpp_transfer_partner_id" ON "public"."floor_cpp" USING "btree" ("transfer_partner_id");



CREATE INDEX "idx_kb_articles_category" ON "public"."kb_articles" USING "btree" ("category") WHERE ("published_at" IS NOT NULL);



CREATE INDEX "idx_kb_articles_valid_as_of" ON "public"."kb_articles" USING "btree" ("valid_as_of") WHERE ("published_at" IS NOT NULL);



CREATE INDEX "idx_kb_monitor_log_article_id" ON "public"."kb_monitor_log" USING "btree" ("article_id");



CREATE INDEX "idx_kb_monitor_log_changed" ON "public"."kb_monitor_log" USING "btree" ("changed") WHERE ("changed" = true);



CREATE INDEX "idx_kb_monitor_log_checked_at" ON "public"."kb_monitor_log" USING "btree" ("checked_at" DESC);



CREATE INDEX "idx_kb_monitor_runs_started_at" ON "public"."kb_monitor_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_kb_monitor_snapshots_article_id" ON "public"."kb_monitor_snapshots" USING "btree" ("article_id");



CREATE INDEX "idx_kb_monitor_snapshots_checked_at" ON "public"."kb_monitor_snapshots" USING "btree" ("checked_at" DESC);



CREATE INDEX "idx_kb_update_candidates_article_id" ON "public"."kb_update_candidates" USING "btree" ("article_id");



CREATE INDEX "idx_kb_update_candidates_created_at" ON "public"."kb_update_candidates" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_kb_update_candidates_status" ON "public"."kb_update_candidates" USING "btree" ("status");



CREATE INDEX "idx_notifications_user_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_is_read_created_at" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_notifications_watchlist_id" ON "public"."notifications" USING "btree" ("watchlist_id");



CREATE INDEX "idx_payment_notifications_user" ON "public"."payment_notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_profiles_day_pass_expires_at" ON "public"."profiles" USING "btree" ("day_pass_expires_at");



CREATE INDEX "idx_program_issuer_id" ON "public"."programs" USING "btree" ("issuer_id");



CREATE INDEX "idx_program_region" ON "public"."programs" USING "btree" ("region");



CREATE INDEX "idx_program_type" ON "public"."programs" USING "btree" ("type");



CREATE INDEX "idx_recommendations_search_id" ON "public"."recommendations" USING "btree" ("search_id");



CREATE INDEX "idx_reward_programs_issuer_id" ON "public"."reward_programs" USING "btree" ("issuer_id");



CREATE INDEX "idx_search_access_grants_search_id" ON "public"."search_access_grants" USING "btree" ("search_id");



CREATE UNIQUE INDEX "idx_search_access_grants_stripe_session_unique" ON "public"."search_access_grants" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "idx_search_access_grants_user_id" ON "public"."search_access_grants" USING "btree" ("user_id");



CREATE INDEX "idx_searches_created_at" ON "public"."searches" USING "btree" ("created_at");



CREATE INDEX "idx_searches_destination_airport_id" ON "public"."searches" USING "btree" ("destination");



CREATE INDEX "idx_searches_origin_airport_id" ON "public"."searches" USING "btree" ("origin");



CREATE INDEX "idx_searches_trip_type" ON "public"."searches" USING "btree" ("trip_type");



CREATE INDEX "idx_searches_user_id" ON "public"."searches" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_stripe_customer" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_user_status" ON "public"."subscriptions" USING "btree" ("user_id", "status");



CREATE INDEX "idx_transfer_partners_from_program_id" ON "public"."transfer_partners" USING "btree" ("from_program_id");



CREATE INDEX "idx_transfer_partners_to_program_id" ON "public"."transfer_partners" USING "btree" ("to_program_id");



CREATE INDEX "idx_transfer_ratios_reward_program_id" ON "public"."transfer_ratios" USING "btree" ("reward_program_id");



CREATE INDEX "idx_transfer_ratios_transfer_partner_id" ON "public"."transfer_ratios" USING "btree" ("transfer_partner_id");



CREATE INDEX "idx_travel_request_events_created_at" ON "public"."travel_request_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_travel_request_events_event_type" ON "public"."travel_request_events" USING "btree" ("event_type");



CREATE INDEX "idx_travel_request_events_request_created" ON "public"."travel_request_events" USING "btree" ("request_id", "created_at" DESC);



CREATE INDEX "idx_travel_request_events_request_id" ON "public"."travel_request_events" USING "btree" ("request_id");



CREATE INDEX "idx_travel_requests_created_at" ON "public"."travel_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_travel_requests_search_id" ON "public"."travel_requests" USING "btree" ("search_id");



CREATE INDEX "idx_travel_requests_status" ON "public"."travel_requests" USING "btree" ("status");



CREATE INDEX "idx_travel_requests_tier" ON "public"."travel_requests" USING "btree" ("tier");



CREATE INDEX "idx_travel_requests_user_id" ON "public"."travel_requests" USING "btree" ("user_id");



CREATE INDEX "idx_travel_requests_verdict_id" ON "public"."travel_requests" USING "btree" ("verdict_id");



CREATE INDEX "idx_verdicts_search_id" ON "public"."verdicts" USING "btree" ("search_id");



CREATE INDEX "idx_watchlist_user_created_at" ON "public"."watchlist" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_watchlist_user_route" ON "public"."watchlist" USING "btree" ("user_id", "origin", "destination", "depart_date");



CREATE INDEX "kb_articles_category_idx" ON "public"."kb_articles" USING "btree" ("category") WHERE ("published_at" IS NOT NULL);



CREATE UNIQUE INDEX "kb_articles_category_title_unique" ON "public"."kb_articles" USING "btree" ("category", "title");



CREATE INDEX "kb_articles_published_idx" ON "public"."kb_articles" USING "btree" ("published_at" DESC) WHERE ("published_at" IS NOT NULL);



CREATE INDEX "kb_corpus_intent_idx" ON "public"."kb_interactions_corpus" USING "btree" ("intent");



CREATE UNIQUE INDEX "public_search_trials_ip_hash_uidx" ON "public"."public_search_trials" USING "btree" ("ip_hash");



CREATE INDEX "public_search_trials_route_idx" ON "public"."public_search_trials" USING "btree" ("origin", "destination", "departure_date");



CREATE INDEX "public_search_trials_used_at_idx" ON "public"."public_search_trials" USING "btree" ("used_at" DESC);



CREATE INDEX "zoe_conversations_updated_at_idx" ON "public"."zoe_conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "zoe_conversations_user_id_idx" ON "public"."zoe_conversations" USING "btree" ("user_id");



CREATE INDEX "zoe_evals_failure_type_idx" ON "public"."zoe_evals" USING "btree" ("failure_type") WHERE ("failure_type" IS NOT NULL);



CREATE INDEX "zoe_evals_hallucination_idx" ON "public"."zoe_evals" USING "btree" ("hallucination") WHERE ("hallucination" = true);



CREATE INDEX "zoe_evals_interaction_id_idx" ON "public"."zoe_evals" USING "btree" ("interaction_id");



CREATE INDEX "zoe_evals_pm_score_idx" ON "public"."zoe_evals" USING "btree" ("pm_score");



CREATE INDEX "zoe_interactions_feedback_idx" ON "public"."zoe_interactions" USING "btree" ("feedback_signal") WHERE ("feedback_signal" IS NOT NULL);



CREATE INDEX "zoe_interactions_intent_idx" ON "public"."zoe_interactions" USING "btree" ("intent", "created_at" DESC);



CREATE INDEX "zoe_interactions_user_id_idx" ON "public"."zoe_interactions" USING "btree" ("user_id");



CREATE INDEX "zoe_messages_conversation_id_idx" ON "public"."zoe_messages" USING "btree" ("conversation_id");



CREATE INDEX "zoe_sessions_conversation_id_idx" ON "public"."zoe_sessions" USING "btree" ("conversation_id");



CREATE INDEX "zoe_sessions_user_id_idx" ON "public"."zoe_sessions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "kb_articles_updated_at" BEFORE UPDATE ON "public"."kb_articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_kb_articles_updated_at"();



CREATE OR REPLACE TRIGGER "set_modified_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_at"();



CREATE OR REPLACE TRIGGER "trg_travel_requests_set_updated_at" BEFORE UPDATE ON "public"."travel_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "zoe_message_inserted" AFTER INSERT ON "public"."zoe_messages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_zoe_conversation"();



CREATE OR REPLACE TRIGGER "zoe_sessions_updated_at" BEFORE UPDATE ON "public"."zoe_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_zoe_sessions_updated_at"();



ALTER TABLE ONLY "public"."balances"
    ADD CONSTRAINT "balances_reward_program_id_fkey" FOREIGN KEY ("reward_program_id") REFERENCES "public"."reward_programs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."balances"
    ADD CONSTRAINT "balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_handoff_clicks"
    ADD CONSTRAINT "booking_handoff_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."card_catalog"
    ADD CONSTRAINT "card_products_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."card_catalog"
    ADD CONSTRAINT "card_products_reward_program_id_fkey" FOREIGN KEY ("reward_program_id") REFERENCES "public"."reward_programs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_reward_program_id_fkey" FOREIGN KEY ("reward_program_id") REFERENCES "public"."reward_programs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_verdict_id_fkey" FOREIGN KEY ("verdict_id") REFERENCES "public"."verdicts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."floor_cpp"
    ADD CONSTRAINT "floor_cpp_reward_program_id_fkey" FOREIGN KEY ("reward_program_id") REFERENCES "public"."reward_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kb_interactions_corpus"
    ADD CONSTRAINT "kb_interactions_corpus_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."zoe_interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kb_update_candidates"
    ADD CONSTRAINT "kb_update_candidates_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."kb_monitor_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_notifications"
    ADD CONSTRAINT "payment_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "program_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recommendations"
    ADD CONSTRAINT "recommendations_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_programs"
    ADD CONSTRAINT "reward_programs_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "public"."issuers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."search_access_grants"
    ADD CONSTRAINT "search_access_grants_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."search_access_grants"
    ADD CONSTRAINT "search_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."searches"
    ADD CONSTRAINT "searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."transfer_partners"
    ADD CONSTRAINT "transfer_partners_from_program_id_fkey" FOREIGN KEY ("from_program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_partners"
    ADD CONSTRAINT "transfer_partners_to_program_id_fkey" FOREIGN KEY ("to_program_id") REFERENCES "public"."programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transfer_ratios"
    ADD CONSTRAINT "transfer_ratios_reward_program_id_fkey" FOREIGN KEY ("reward_program_id") REFERENCES "public"."reward_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_request_events"
    ADD CONSTRAINT "travel_request_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_request_events"
    ADD CONSTRAINT "travel_request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."travel_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_requests"
    ADD CONSTRAINT "travel_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_requests"
    ADD CONSTRAINT "travel_requests_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."travel_requests"
    ADD CONSTRAINT "travel_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."travel_requests"
    ADD CONSTRAINT "travel_requests_verdict_id_fkey" FOREIGN KEY ("verdict_id") REFERENCES "public"."verdicts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_programs"
    ADD CONSTRAINT "user_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id");



ALTER TABLE ONLY "public"."user_programs"
    ADD CONSTRAINT "user_programs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verdicts"
    ADD CONSTRAINT "verdicts_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."watchlist"
    ADD CONSTRAINT "watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoe_conversations"
    ADD CONSTRAINT "zoe_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoe_evals"
    ADD CONSTRAINT "zoe_evals_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."zoe_interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoe_evals"
    ADD CONSTRAINT "zoe_evals_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoe_interactions"
    ADD CONSTRAINT "zoe_interactions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."zoe_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoe_interactions"
    ADD CONSTRAINT "zoe_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoe_messages"
    ADD CONSTRAINT "zoe_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."zoe_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zoe_sessions"
    ADD CONSTRAINT "zoe_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."zoe_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."zoe_sessions"
    ADD CONSTRAINT "zoe_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated can read reward_programs" ON "public"."reward_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public read published articles" ON "public"."kb_articles" FOR SELECT USING (("published_at" IS NOT NULL));



CREATE POLICY "Service full access corpus" ON "public"."kb_interactions_corpus" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service full access evals" ON "public"."zoe_evals" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service full access interactions" ON "public"."zoe_interactions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service full access kb" ON "public"."kb_articles" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service full access sessions" ON "public"."zoe_sessions" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert notifications" ON "public"."payment_notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can manage messages in their conversations" ON "public"."zoe_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."zoe_conversations" "c"
  WHERE (("c"."id" = "zoe_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."zoe_conversations" "c"
  WHERE (("c"."id" = "zoe_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own conversations" ON "public"."zoe_conversations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own notifications" ON "public"."payment_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."payment_notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users select own search_access_grants" ON "public"."search_access_grants" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own interactions" ON "public"."zoe_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own sessions" ON "public"."zoe_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."airports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_events_insert_own" ON "public"."analytics_events" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "analytics_events_select_own" ON "public"."analytics_events" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "analytics_events_service_role_all" ON "public"."analytics_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated can read card_products" ON "public"."card_catalog" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can read experiments" ON "public"."experiments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can read floor_cpp" ON "public"."floor_cpp" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can read issuers" ON "public"."issuers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can read reward_programs" ON "public"."reward_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated can read transfer_ratios" ON "public"."transfer_ratios" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_can_read_airports" ON "public"."airports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_can_read_program" ON "public"."programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_can_read_transfer_partners" ON "public"."transfer_partners" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_handoff_clicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."card_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."experiments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."floor_cpp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issuers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_interactions_corpus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_monitor_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_monitor_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_monitor_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kb_update_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_insert_own" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payment_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_search_trials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_access_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transfer_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transfer_ratios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."travel_request_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_request_events_delete_none" ON "public"."travel_request_events" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "travel_request_events_insert_own" ON "public"."travel_request_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."travel_requests" "tr"
  WHERE (("tr"."id" = "travel_request_events"."request_id") AND ("tr"."user_id" = "auth"."uid"())))));



CREATE POLICY "travel_request_events_select_own" ON "public"."travel_request_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."travel_requests" "tr"
  WHERE (("tr"."id" = "travel_request_events"."request_id") AND ("tr"."user_id" = "auth"."uid"())))));



CREATE POLICY "travel_request_events_update_none" ON "public"."travel_request_events" FOR UPDATE TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."travel_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "travel_requests_delete_own_limited" ON "public"."travel_requests" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'payment_pending'::"text"]))));



CREATE POLICY "travel_requests_insert_own" ON "public"."travel_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "travel_requests_select_own" ON "public"."travel_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "travel_requests_update_own" ON "public"."travel_requests" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can delete own balances" ON "public"."balances" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can delete own cards" ON "public"."cards" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can delete own feedback" ON "public"."feedback" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can delete own searches" ON "public"."searches" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can delete verdicts for own searches" ON "public"."verdicts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "verdicts"."search_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "users can insert own balances" ON "public"."balances" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can insert own cards" ON "public"."cards" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can insert own feedback" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can insert own row" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "users can insert own searches" ON "public"."searches" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "users can insert verdicts for own searches" ON "public"."verdicts" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "verdicts"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



CREATE POLICY "users can read own balances" ON "public"."balances" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can read own cards" ON "public"."cards" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can read own feedback" ON "public"."feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can read own row" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "users can read own searches" ON "public"."searches" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "users can read verdicts for own searches" ON "public"."verdicts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "verdicts"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



CREATE POLICY "users can update own balances" ON "public"."balances" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can update own cards" ON "public"."cards" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can update own feedback" ON "public"."feedback" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can update own row" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "users can update own searches" ON "public"."searches" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users can update verdicts for own searches" ON "public"."verdicts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "verdicts"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "verdicts"."search_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "users insert own handoff clicks" ON "public"."booking_handoff_clicks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "users read own handoff clicks" ON "public"."booking_handoff_clicks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_delete_recommendations_own_searches" ON "public"."recommendations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "recommendations"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



CREATE POLICY "users_insert_recommendations_own_searches" ON "public"."recommendations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "recommendations"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



CREATE POLICY "users_select_recommendations_own_searches" ON "public"."recommendations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "recommendations"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



CREATE POLICY "users_update_recommendations_own_searches" ON "public"."recommendations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "recommendations"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."searches" "s"
  WHERE (("s"."id" = "recommendations"."search_id") AND (("s"."user_id" = "auth"."uid"()) OR ("s"."user_id" IS NULL))))));



ALTER TABLE "public"."verdicts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."watchlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "watchlist_delete_own" ON "public"."watchlist" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "watchlist_insert_own" ON "public"."watchlist" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "watchlist_select_own" ON "public"."watchlist" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "watchlist_update_own" ON "public"."watchlist" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."zoe_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoe_evals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoe_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoe_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zoe_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."travel_request_events" TO "anon";
GRANT ALL ON TABLE "public"."travel_request_events" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_request_events" TO "service_role";



REVOKE ALL ON FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_travel_request_event"("p_request_id" "uuid", "p_event_type" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_wallet"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_wallet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_wallet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recommendations"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_recommendations"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recommendations"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_programs"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_programs"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_programs"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_interaction_corpus"("query_embedding" "public"."vector", "intent_filter" "text", "match_count" integer, "min_similarity" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_interaction_corpus"("query_embedding" "public"."vector", "intent_filter" "text", "match_count" integer, "min_similarity" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_interaction_corpus"("query_embedding" "public"."vector", "intent_filter" "text", "match_count" integer, "min_similarity" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_kb_articles"("query_embedding" "public"."vector", "categories" "text"[], "match_count" integer, "min_similarity" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."search_kb_articles"("query_embedding" "public"."vector", "categories" "text"[], "match_count" integer, "min_similarity" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_kb_articles"("query_embedding" "public"."vector", "categories" "text"[], "match_count" integer, "min_similarity" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_zoe_conversation"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_zoe_conversation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_zoe_conversation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_kb_articles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_kb_articles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_kb_articles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_zoe_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_zoe_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_zoe_sessions_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."airports" TO "anon";
GRANT ALL ON TABLE "public"."airports" TO "authenticated";
GRANT ALL ON TABLE "public"."airports" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."balances" TO "anon";
GRANT ALL ON TABLE "public"."balances" TO "authenticated";
GRANT ALL ON TABLE "public"."balances" TO "service_role";



GRANT ALL ON TABLE "public"."booking_handoff_clicks" TO "anon";
GRANT ALL ON TABLE "public"."booking_handoff_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_handoff_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."card_catalog" TO "anon";
GRANT ALL ON TABLE "public"."card_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."card_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."experiments" TO "anon";
GRANT ALL ON TABLE "public"."experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."experiments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."floor_cpp" TO "anon";
GRANT ALL ON TABLE "public"."floor_cpp" TO "authenticated";
GRANT ALL ON TABLE "public"."floor_cpp" TO "service_role";



GRANT ALL ON TABLE "public"."issuers" TO "anon";
GRANT ALL ON TABLE "public"."issuers" TO "authenticated";
GRANT ALL ON TABLE "public"."issuers" TO "service_role";



GRANT ALL ON TABLE "public"."kb_articles" TO "anon";
GRANT ALL ON TABLE "public"."kb_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_articles" TO "service_role";



GRANT ALL ON TABLE "public"."kb_interactions_corpus" TO "anon";
GRANT ALL ON TABLE "public"."kb_interactions_corpus" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_interactions_corpus" TO "service_role";



GRANT ALL ON TABLE "public"."kb_monitor_log" TO "anon";
GRANT ALL ON TABLE "public"."kb_monitor_log" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_monitor_log" TO "service_role";



GRANT ALL ON TABLE "public"."kb_monitor_health" TO "anon";
GRANT ALL ON TABLE "public"."kb_monitor_health" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_monitor_health" TO "service_role";



GRANT ALL ON TABLE "public"."kb_monitor_runs" TO "anon";
GRANT ALL ON TABLE "public"."kb_monitor_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_monitor_runs" TO "service_role";



GRANT ALL ON TABLE "public"."kb_monitor_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."kb_monitor_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_monitor_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."kb_monitor_snapshot_health" TO "anon";
GRANT ALL ON TABLE "public"."kb_monitor_snapshot_health" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_monitor_snapshot_health" TO "service_role";



GRANT ALL ON TABLE "public"."kb_update_candidates" TO "anon";
GRANT ALL ON TABLE "public"."kb_update_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_update_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."kb_pending_update_candidates" TO "anon";
GRANT ALL ON TABLE "public"."kb_pending_update_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_pending_update_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."kb_recent_changes" TO "anon";
GRANT ALL ON TABLE "public"."kb_recent_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."kb_recent_changes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."payment_notifications" TO "anon";
GRANT ALL ON TABLE "public"."payment_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON TABLE "public"."public_search_trials" TO "anon";
GRANT ALL ON TABLE "public"."public_search_trials" TO "authenticated";
GRANT ALL ON TABLE "public"."public_search_trials" TO "service_role";



GRANT ALL ON TABLE "public"."recommendations" TO "anon";
GRANT ALL ON TABLE "public"."recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."reward_programs" TO "anon";
GRANT ALL ON TABLE "public"."reward_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_programs" TO "service_role";



GRANT ALL ON TABLE "public"."search_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."search_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."search_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."searches" TO "anon";
GRANT ALL ON TABLE "public"."searches" TO "authenticated";
GRANT ALL ON TABLE "public"."searches" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."transfer_partners" TO "anon";
GRANT ALL ON TABLE "public"."transfer_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."transfer_partners" TO "service_role";



GRANT ALL ON TABLE "public"."transfer_ratios" TO "anon";
GRANT ALL ON TABLE "public"."transfer_ratios" TO "authenticated";
GRANT ALL ON TABLE "public"."transfer_ratios" TO "service_role";



GRANT ALL ON TABLE "public"."travel_requests" TO "anon";
GRANT ALL ON TABLE "public"."travel_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."travel_requests" TO "service_role";



GRANT ALL ON TABLE "public"."user_program_balance" TO "anon";
GRANT ALL ON TABLE "public"."user_program_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."user_program_balance" TO "service_role";



GRANT ALL ON TABLE "public"."user_programs" TO "anon";
GRANT ALL ON TABLE "public"."user_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_programs" TO "service_role";



GRANT ALL ON TABLE "public"."user_wallets" TO "anon";
GRANT ALL ON TABLE "public"."user_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."verdicts" TO "anon";
GRANT ALL ON TABLE "public"."verdicts" TO "authenticated";
GRANT ALL ON TABLE "public"."verdicts" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_balances" TO "anon";
GRANT ALL ON TABLE "public"."wallet_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_balances" TO "service_role";



GRANT ALL ON TABLE "public"."wallet_cards" TO "anon";
GRANT ALL ON TABLE "public"."wallet_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."wallet_cards" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."watchlist" TO "anon";
GRANT ALL ON TABLE "public"."watchlist" TO "authenticated";
GRANT ALL ON TABLE "public"."watchlist" TO "service_role";



GRANT ALL ON TABLE "public"."zoe_conversations" TO "anon";
GRANT ALL ON TABLE "public"."zoe_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."zoe_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."zoe_evals" TO "anon";
GRANT ALL ON TABLE "public"."zoe_evals" TO "authenticated";
GRANT ALL ON TABLE "public"."zoe_evals" TO "service_role";



GRANT ALL ON TABLE "public"."zoe_interactions" TO "anon";
GRANT ALL ON TABLE "public"."zoe_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."zoe_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."zoe_messages" TO "anon";
GRANT ALL ON TABLE "public"."zoe_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."zoe_messages" TO "service_role";



GRANT ALL ON TABLE "public"."zoe_sessions" TO "anon";
GRANT ALL ON TABLE "public"."zoe_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."zoe_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







