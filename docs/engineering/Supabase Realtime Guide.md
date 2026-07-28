# Supabase Realtime Guide

The rule, the reason, and the recipe for adding live updates in this project.

> This guide is adapted from a hard-won audit on a prior Supabase project. The conclusions are universal — use broadcast, not `postgres_changes`. Patterns and checklist apply as-is.

## TL;DR rule

**Always use broadcast via `realtime.send()` + a Postgres trigger. Never use `postgres_changes`.**

Broadcast is the 2026-forward pattern in Supabase, and it works reliably across tenants. `postgres_changes` has a history of silent failures on individual tenants — subscribers see `SUBSCRIBED` but receive zero events. Don't gamble on it. Use broadcast, always.

## Why this rule exists (the audit story)

On that project, the team wired a live counter using the obvious pattern: enable Realtime on the table, add an RLS policy for the subscriber role, and `.on("postgres_changes", ...)` from the browser.

Everything passed the checklist:
- Table in `supabase_realtime` publication
- `REPLICA IDENTITY FULL`
- Role granted `SELECT`
- RLS policy in place
- Upstream trigger keeping the derived table in sync

The counter still never ticked. The channel reported `SUBSCRIBED`, but no events arrived. A full page reload was needed to see the new number.

**Root cause:** The Realtime service was fanning out the broadcast replication stream but not the legacy `postgres_changes` replication stream — to any subscriber, authenticated or anon. The slot existed; the fan-out didn't happen.

**The fix:** database trigger calls `realtime.send(..., private := false)` on each change → client listens on the matching public broadcast topic → works for both anon and authenticated in one unified pattern.

Use broadcast on this project from day one — don't gamble that this tenant is different.

## The broadcast pattern (copy-paste recipe)

### 1. Database trigger

Add a migration file under `supabase/migrations/NNNN_*.sql` and apply it via the Supabase MCP (`apply_migration`). The function must:

- Be `security definer` and `set search_path = public` (so it can reach `realtime.send()` regardless of caller role).
- Pass `private := false` as the fourth arg so authenticated clients can subscribe to the public topic (anon can too, if you expose anon UI).
- Use a stable, well-named topic and event you'll type into the client.

```sql
-- Example: broadcast on changes to an `items` table. Swap in your own table/columns.
create or replace function public.broadcast_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      -- only what the UI actually needs — this payload is public
      'id',    new.id,
      'label', new.label,
      'ts',    new.updated_at
    ),
    'change',        -- event name (matches client's .on("broadcast", { event: 'change' }))
    'items:global',  -- topic name (matches client's .channel('items:global'))
    false            -- private = false → public topic
  );
  return null;
end;
$$;

drop trigger if exists broadcast_item_insert on public.items;

create trigger broadcast_item_insert
after insert on public.items
for each row
execute function public.broadcast_item_change();

-- A trigger function fires regardless of the writing role's EXECUTE on it, and
-- this is SECURITY DEFINER (runs as owner) — so NO grant is needed for the
-- trigger to broadcast. Grant EXECUTE only to the role that actually writes this
-- table (e.g. a cron/admin = service_role). Do NOT grant anon/authenticated: that
-- does not help the trigger fire, it only exposes the function as a callable RPC at
-- /rest/v1/rpc/* (Supabase security advisors 0028/0029).
grant execute on function public.broadcast_item_change to service_role;
```

Notes:
- Trigger `AFTER UPDATE` (or `INSERT`/`DELETE`) on the table whose changes the UI reflects — not on the upstream driving table. Upstream triggers already sync the derived table; we broadcast from the derived table so the payload is the final computed state.
- Don't put anything PII-sensitive in the payload if `private := false`. Public topics are readable by anyone on the internet who knows the topic name.

### 2. Client subscription

In a Client Component (`"use client"`):

```ts
useEffect(() => {
  const supabase = createClient(); // the browser client from lib/supabase/client.ts

  const channel = supabase
    .channel("items:global", { config: { private: false } })
    .on("broadcast", { event: "change" }, (message) => {
      const payload = message.payload as { id: string; label: string; ts: string };
      // merge into local state — the parent passed `initial` as the SSR snapshot
      setItems((prev) => prev.map((i) => (i.id === payload.id ? { ...i, label: payload.label, ts: payload.ts } : i)));
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

For signal-pattern topics (any feed where the client just needs to re-fetch), the callback is even simpler — just call `router.refresh()`:

```ts
.on("broadcast", { event: "change" }, () => {
  router.refresh();
})
```

Rules:
- `config: { private: false }` on the client **must** match `private := false` on the server. Mismatch → silent no-events.
- Topic and event names are free text but must match exactly between server and client.
- Unsubscribe in the cleanup function. Always.
- Keep the initial server-rendered value as "source of truth for first paint" and let broadcast take over from there. Don't show a loading state waiting for the first event.

### 3. Initial render still needs a server snapshot

Broadcast only fires on **change**. A fresh page load has no event to replay. So your Server Component must fetch the current value (use the admin/service-role client for cron-invoked routes; the authenticated SSR client for user-facing pages) and pass it as a prop to the Client Component. The client uses that as its initial state and overwrites it when a broadcast arrives.

**Pattern:** server-render the snapshot in a `lib/data/*` reader, pass it into the client wrapper as an `initial` prop, and the wrapper merges incoming broadcast payloads into local state.

## When postgres_changes is still OK

Never on this project. Use broadcast for every live feature. If Supabase ships a fix for `postgres_changes` reliability in a future major version, re-verify with an end-to-end audit harness before adopting it — don't take the docs' word for it.

## Verification checklist (every new realtime feature)

Before marking the task done:

1. **Migration applied** in Supabase (via MCP `apply_migration`) **and** mirrored in `supabase/migrations/`.
2. **End-to-end live test** (not just `.subscribe()` says `SUBSCRIBED`):
   - Subscribe from a separate process with the anon key.
   - Perform the driving DB change via service-role (or a manual `curl` to the ingestion route).
   - Confirm the payload arrives within ~3 seconds.
3. `SUBSCRIBED` is **not proof**. A channel can subscribe and receive zero events forever. Only a received payload is proof.
4. **Types compile** — `npm run build` (or `npx tsc --noEmit`).
5. **Initial snapshot still correct** — reload the page without mutating data; the panel should render the last-known value from the server, not zero/null.

## Don'ts

- Don't add `anon` RLS policies on `realtime.messages` — broadcast with `private := false` doesn't need them and granting them creates cross-topic leakage.
- Don't call `realtime.send()` from client code. It's a server/DB-side primitive. From the client you only *subscribe*.
- Don't broadcast the full row if it contains PII on a public topic. Compute a minimal public payload in the trigger; the client re-fetches via its authenticated session for full data.
- Don't use `alter publication supabase_realtime add table ...` expecting `postgres_changes` to start working. Use broadcast.
- Don't sleep-poll or `setInterval` to fake realtime. Always broadcast.
- Don't grant `execute` on the broadcast function to `anon`/`authenticated`. **Correction (verified live 2026-06-02):** the old advice here — "grant to anon, authenticated, service_role or the trigger raises a permission error and the write rolls back" — was **wrong**. A trigger function fires regardless of the writing role's `EXECUTE` on it, and these are `SECURITY DEFINER` (run as the owner), so the broadcast works with **no grant at all**. Granting `anon`/`authenticated` doesn't enable the trigger — it only exposes the function as a callable RPC at `/rest/v1/rpc/*` (flagged by Supabase security advisors 0028/0029). Grant `execute` only to the role that actually writes the table (cron-written tables → `service_role`).

## Broadcast topics — naming convention

Register every live feed here as you add it, so topics stay consistent across the app. Example shapes:

| Topic | Pattern | Payload |
|:---|:---|:---|
| `<feature>:global` | value (row-driven) | `{id, …minimal fields}` — client merges into local state |
| `<feature>:global` | signal | `{op, id}` — client calls `router.refresh()` |
| `<feature>:<user_id>` | signal (per-user) | `{op, id, user_id}` |

Event name: `'change'` for row-driven broadcasts. Each subscribing client also fetches an initial server snapshot — broadcast only fires on change. Migration files for the triggers live in `supabase/migrations/`.

## Universal lessons from the prior project (worth keeping in mind)

These are the patterns that survived the audit. Apply them on this project:

1. **`SUBSCRIBED` is not proof events flow.** A channel can report `SUBSCRIBED` and silently receive zero events forever. Verify every new feed end-to-end.

2. **`private := false` payloads must not carry PII.** Public topics are readable by anyone who knows the topic name. Convention: payload carries just enough to drive the UI (`{op, id, ...}`); the authenticated client re-fetches the full row via its own Supabase session if it needs more.

3. **Topic naming.** Use `<feature>:global` for shared feeds and `<feature>:<user_id>` for per-user feeds. Don't open parallel channels for the same logical feed — extend the existing topic with a discriminator field if needed.

4. **Event name convention.** Use `'change'` as the event name for all row-driven broadcasts. Feature-specific event names are fine for aggregate broadcasts, but consistency within a feed matters more than across.

5. **Signal vs value payloads.** Two valid patterns:
   - **Value payload** — broadcast carries the new value; client merges into local state. Good when the value is small and the client can render directly.
   - **Signal payload** — broadcast carries just `{op, id}`; client calls `router.refresh()` to let the server component re-fetch. Good when the value requires server-side computation or when avoiding TS-vs-SQL logic duplication.
   Rule of thumb: use a **value** payload for a small, directly-renderable value reused widely; use a **signal** payload when the value needs server-side computation or you'd otherwise duplicate logic between TS and SQL.

6. **Post-SUBSCRIBED settle delay (test harnesses only).** A fire-immediately-after-subscribe test script may need to wait ~200ms after `SUBSCRIBED` before firing the triggering change — otherwise the broadcast fan-out registration races behind the trigger. Production UIs don't need this (real user actions are already much slower than 200ms).
