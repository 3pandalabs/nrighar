-- Documents storage bucket. Private (not public) - files are only readable via
-- signed URLs by the owning user through RLS, never a public URL.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Convention: objects are stored at "<user_id>/<filename>", so ownership is
-- derivable from the path itself without a separate lookup table.
create policy "documents_bucket_select_own" on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_bucket_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents_bucket_delete_own" on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );
