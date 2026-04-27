CREATE TABLE public.contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'video' CHECK (icon IN ('video', 'tutorial')),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  duration TEXT NOT NULL DEFAULT '0:00',
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  glow TEXT CHECK (glow IN ('cyan', 'pink', 'violet')),
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  xp INTEGER NOT NULL DEFAULT 10 CHECK (xp >= 0),
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  learnings TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  thumbnail TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_contributions_status_created_at ON public.contributions (status, created_at DESC);
CREATE INDEX idx_contributions_user_id_created_at ON public.contributions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contributions_updated_at
BEFORE UPDATE ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can view published contributions"
ON public.contributions
FOR SELECT
USING (status = 'published');

CREATE POLICY "Users can create their own contributions"
ON public.contributions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contributions"
ON public.contributions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contributions"
ON public.contributions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('contribution-videos', 'contribution-videos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Published contribution videos are viewable"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contribution-videos'
  AND EXISTS (
    SELECT 1
    FROM public.contributions c
    WHERE c.status = 'published'
      AND c.video_url = storage.objects.name
  )
);

CREATE POLICY "Users can upload their own contribution videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contribution-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own contribution videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'contribution-videos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'contribution-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own contribution videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'contribution-videos' AND auth.uid()::text = (storage.foldername(name))[1]);