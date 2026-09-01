-- Local-only fictional demo ledger.
--
-- The persona and its calendar live in exactly one place: public.seed_demo_ledger().
-- Restating them here would create a second copy that drifts from the demo a
-- judge actually sees, and it would reintroduce the fixed calendar dates this
-- seed used to carry. Instead this drives the same RPC, as the same owner role,
-- through the same draft -> committed path, so a local reset produces the
-- current week every time it runs.
--
-- The identity is genuinely anonymous, matching the demo sessions in production.
-- It has no email and no password, so it cannot be signed into; browse it in
-- Studio, or use the judge demo entry point in the running application.

begin;

insert into auth.users (id, email, is_anonymous)
values ('00000000-0000-4000-a000-000000000001', null, true);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);

select public.seed_demo_ledger();

reset role;

commit;
