-- ============================================================================
-- Fix admin bootstrap: let trusted backend contexts (SQL editor as `postgres`,
-- or the service-role key) change active/role. End-user reps are STILL blocked
-- from escalating their own active/role.
--
-- Root cause: enforce_profile_protected_columns() checked only is_admin(). The
-- SQL editor has no end-user JWT (auth.uid() IS NULL) and there was no admin yet,
-- so the trigger blocked the very first `update ... set role='admin'` with
-- "42501: not authorized to modify active or role".
--
-- Safe because: a signed-in rep ALWAYS has a non-null auth.uid(); `anon` cannot
-- update profiles at all (no grant/policy); only postgres / service_role have a
-- null auth.uid() with write access, and both are trusted.
-- ============================================================================

create or replace function public.enforce_profile_protected_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted backend (SQL editor as postgres, or the service-role key) carries no
  -- end-user JWT → allow. This is how the first admin gets created.
  if (select auth.uid()) is null then
    return new;
  end if;
  -- Admins may change anything.
  if (select private.is_admin()) then
    return new;
  end if;
  -- A regular signed-in rep may not change their own active/role.
  if new.active is distinct from old.active
     or new.role is distinct from old.role then
    raise exception 'not authorized to modify active or role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
