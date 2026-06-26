-- Durable per-conversation storage for the upstream Xpectrum conversation id.
-- Replaces the Redis-backed session as the source of truth for multi-turn
-- continuity (the prod Redis was suspended, wiping sessions every turn, so the
-- agent started a fresh conversation on every message). Keyed by the frontend
-- conversation_id (= zoe_conversations.id). Nullable + additive → safe under the
-- auto-apply workflow's deploy window; looked up by PK, so no index needed.
ALTER TABLE "public"."zoe_conversations"
    ADD COLUMN IF NOT EXISTS "xpectrum_conversation_id" "text";
