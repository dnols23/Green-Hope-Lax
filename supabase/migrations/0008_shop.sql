-- ════════════════════════════════════════════════════════════════════════════
-- Green Hope Falcons — Team Store (spirit wear)
-- Run once in Supabase SQL Editor. Safe to re-run.
--
-- Model: a branded /shop page on our own domain showcases products (photo, price,
-- sizes, description) managed in /admin → Shop. Each product's "Buy" button links
-- OUT to our print-on-demand team store (SquadLocker / Bonfire / Custom Ink, etc.)
-- where the vendor takes payment, prints on demand, and ships. The team keeps the
-- fundraising markup. No inventory, no cart, no Stripe, no sales tax on our end.
-- ════════════════════════════════════════════════════════════════════════════

-- ── products ─────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null,
  description  text,                          -- short blurb shown on the tile
  category     text        not null default 'Apparel',  -- groups tiles on /shop
  price        numeric(8,2),                  -- retail price in dollars (nullable = "See store")
  price_note   text,                          -- e.g. "from" / "+ tax at checkout"
  sizes        text,                          -- comma-separated, e.g. "YS, YM, S, M, L, XL, 2XL"
  image_url    text,                          -- product photo (paste any URL); blank = branded placeholder
  buy_url      text,                          -- vendor product link; blank = falls back to store link
  badge        text,                          -- optional ribbon, e.g. "Best Seller" / "New"
  sort_order   int         not null default 0,
  is_published boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.products enable row level security;

-- Public sees published products; admins see everything and can write.
drop policy if exists "public read published products" on public.products;
create policy "public read published products" on public.products
  for select to anon using (is_published = true);

drop policy if exists "admin read all products" on public.products;
create policy "admin read all products" on public.products
  for select to authenticated using (true);

drop policy if exists "admin all products" on public.products;
create policy "admin all products" on public.products
  for all to authenticated using (true) with check (true);

create index if not exists products_sort_idx
  on public.products (category, sort_order, created_at);

-- ── Store link + intro (key/value in app_settings; service-role read/write) ────
-- The "Shop the full store" button and page intro. Editable in /admin → Shop.
insert into public.app_settings (key, value) values
  ('shop_store_url', ''),
  ('shop_intro', 'Show your Falcons pride! Every purchase supports Green Hope Lacrosse. Gear is printed on demand and shipped straight to you.')
on conflict (key) do nothing;

-- ── Register the page (nav + visibility toggle in /admin → Pages) ──────────────
insert into public.page_settings (key, label, href, sort_order) values
  ('shop', 'Shop', '/shop', 12)
on conflict (key) do update
  set label = excluded.label, href = excluded.href, sort_order = excluded.sort_order;

-- ── Seed the catalog (only if empty, so re-running won't duplicate) ────────────
-- Prices are suggested retail; adjust to your vendor's base + markup. Photos and
-- buy links are blank on purpose — paste each product's vendor image + link in
-- /admin → Shop once your team store is set up. Until then tiles show a branded
-- placeholder and the button reads "Coming soon."
do $$ begin
if not exists (select 1 from public.products) then
  insert into public.products (name, description, category, price, sizes, badge, sort_order) values
    ('Falcons Performance Hoodie',    'Soft midweight fleece hoodie with the falcon logo — the go-to sideline layer for chilly spring games.', 'Outerwear',   48.00, 'YM, YL, S, M, L, XL, 2XL',     'Best Seller', 1),
    ('Green Hope Lacrosse 1/4-Zip',   'Lightweight performance quarter-zip pullover. Great for warmups and cool mornings.',                     'Outerwear',   55.00, 'S, M, L, XL, 2XL',            null,          2),
    ('Falcons Cotton Tee',            'Classic soft cotton tee with the Green Hope Lacrosse wordmark. An everyday staple.',                     'Tops',        22.00, 'YS, YM, YL, S, M, L, XL, 2XL', null,          3),
    ('Performance Shooter Shirt',     'Long-sleeve moisture-wicking shooting shirt in Falcons green — a lacrosse classic.',                     'Tops',        38.00, 'S, M, L, XL, 2XL',            'New',         4),
    ('Lax Mom / Lax Dad Tee',         'Show your player some love. Pick Mom or Dad in the vendor store. Comfy unisex fit.',                     'Fan Gear',    24.00, 'S, M, L, XL, 2XL',            null,          5),
    ('Falcons Joggers',               'Tapered fleece joggers with the falcon head on the hip. Warm, comfy, team-proud.',                       'Bottoms',     45.00, 'YM, YL, S, M, L, XL, 2XL',    null,          6),
    ('Falcons Mesh Shorts',           'Breathable practice shorts with side pockets and the team logo.',                                        'Bottoms',     28.00, 'YM, YL, S, M, L, XL',         null,          7),
    ('Falcons Structured Cap',        'Adjustable structured cap with an embroidered falcon head. One size fits most.',                         'Headwear',    26.00, 'One size',                    null,          8),
    ('Falcons Cuffed Beanie',         'Warm knit beanie with a woven team tag — perfect for early-season night games.',                         'Headwear',    22.00, 'One size',                    null,          9),
    ('Falcons Team Backpack',         'Roomy backpack with a laptop sleeve and stick straps. Personalize with a name/number in-store.',        'Bags & Gear', 60.00, 'One size',                    'Team Pick',   10),
    ('Falcons Stainless Water Bottle','Insulated 24oz bottle that keeps water cold through a doubleheader. Add a name in-store.',               'Bags & Gear', 25.00, 'One size',                    null,          11),
    ('Falcons Car Magnet (2-Pack)',   'Two weatherproof falcon-logo magnets for the family cars. Support the team on the road.',                'Fan Gear',    12.00, 'One size',                    null,          12),
    ('Falcons Yard Sign',             '18x24 double-sided yard sign to cheer on your player. Add a name/number in the vendor store.',           'Fan Gear',    20.00, 'One size',                    null,          13),
    ('Falcons Stadium Blanket',       'Cozy fleece stadium blanket with the team logo — claim your spot in the stands.',                        'Fan Gear',    40.00, 'One size',                    null,          14);
end if;
end $$;
