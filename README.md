# Todo List

React + Vite todo app with Supabase-backed sign-in and hosted task storage.

## Run locally

```bash
npm install
npm run dev
```

## Connect Supabase

1. Copy `.env.example` to `.env.local`
2. Fill in:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

3. In the Supabase SQL editor, run:

```sql
create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  priority text not null default 'medium',
  due_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create policy "Users can read their own todos"
on public.todos
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own todos"
on public.todos
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own todos"
on public.todos
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own todos"
on public.todos
for delete
to authenticated
using ((select auth.uid()) = user_id);
```

4. Start the app and create an account from the sign-in screen.

If you already created the table earlier, add the new columns with:

```sql
alter table public.todos
add column if not exists due_at timestamptz;

alter table public.todos
add column if not exists tags text[] not null default '{}';
```

## Notes

- Theme preference stays in local storage.
- Todos are stored in Supabase once you sign in.
- Due dates are optional, but require both a date and a time when set.
- Tags are entered as a comma-separated list and stored as a Postgres text array.
- If the app says the Supabase keys are missing, check `.env.local`.
