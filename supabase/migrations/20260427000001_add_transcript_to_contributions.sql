-- Add transcript fields to the public.contributions table so the front-end
-- can render an Apple Music-style synced transcript on the content detail
-- page. The data is sourced from the local pipeline backend
-- (faster-whisper + Gemini) and threaded through on Publish.

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb,
  ADD COLUMN IF NOT EXISTS detected_language text;
