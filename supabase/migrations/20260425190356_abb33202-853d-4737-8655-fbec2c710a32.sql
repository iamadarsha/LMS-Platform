DROP POLICY IF EXISTS "Published contribution videos are viewable" ON storage.objects;

CREATE POLICY "Published contribution assets are viewable"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'contribution-videos'
  AND EXISTS (
    SELECT 1 FROM public.contributions c
    WHERE c.status = 'published'
      AND (c.video_url = objects.name OR c.thumbnail = objects.name)
  )
);