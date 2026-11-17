-- Run once in Supabase → SQL Editor. Lets a signed-in user delete their OWN account
-- (browsers can't use the admin API, and the service_role key must never ship to the client).
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;
