-- Create itches table for Fix the Itch kanban board
CREATE TABLE public.itches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  team TEXT NOT NULL,
  submitted_by TEXT NOT NULL DEFAULT 'Anonymous',
  status TEXT NOT NULL DEFAULT 'open',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.itches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view itches"
ON public.itches FOR SELECT USING (true);

CREATE POLICY "Anyone can create itches"
ON public.itches FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update itches"
ON public.itches FOR UPDATE USING (true) WITH CHECK (true);

-- Status validation via trigger
CREATE OR REPLACE FUNCTION public.validate_itch_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('open', 'exploring', 'in_progress', 'solved') THEN
    RAISE EXCEPTION 'Invalid itch status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_itch_status_trigger
BEFORE INSERT OR UPDATE ON public.itches
FOR EACH ROW EXECUTE FUNCTION public.validate_itch_status();

-- Reuse existing update_updated_at_column if it exists, else create it
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_itches_updated_at
BEFORE UPDATE ON public.itches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.itches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.itches;