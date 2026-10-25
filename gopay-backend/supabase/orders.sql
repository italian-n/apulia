-- Orders for the payment admin. Written/read ONLY by the Vercel backend with
-- the service_role key; RLS is on with no policies, so anon/authenticated get nothing.
create table if not exists public.shop_orders (
    payment_id   text primary key,
    order_number text,
    state        text not null default 'CREATED',
    amount       numeric,
    currency     text default 'CZK',
    method       text,
    customer_name text,
    email        text,
    phone        text,
    address      text,
    delivery     text,
    items        jsonb not null default '[]'::jsonb,
    fulfillment  text not null default 'new' check (fulfillment in ('new','packed','shipped','delivered','cancelled')),
    note         text,
    emailed_at   timestamptz,
    paid_at      timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists shop_orders_created_idx on public.shop_orders (created_at desc);
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;
