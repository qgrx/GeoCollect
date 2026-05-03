-- ═══════════════════════════════════════════════════════════════════
-- GeoCards — Schéma PostgreSQL
-- À coller dans : Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── 1. Profils joueurs ─────────────────────────────────────────────
-- Étend la table auth.users gérée par Supabase Auth
create table if not exists public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  pseudo            text        not null unique,
  email             text        not null,
  role              text        not null default 'user' check (role in ('user', 'admin')),
  status            text        not null default 'actif' check (status in ('actif', 'banni')),
  gold              integer     not null default 0,
  joined_at         timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  pseudo_changed_at timestamptz,
  pseudo_history    jsonb       not null default '[]',
  streak            integer     not null default 0,
  last_active_date  date,
  last_card_date    date,
  daily_gold        integer     not null default 0,
  daily_cards       integer     not null default 0,
  daily_reset_at    date        not null default current_date,
  can_sell          boolean     not null default true,
  score             integer     not null default 0,
  deleted_at        timestamptz,
  is_bot            boolean     not null default false,
  welcome_given     boolean     not null default false
);

-- ─── Config cache TTL (secondes) ───────────────────────────────────────────
-- INSERT INTO config (key,value) VALUES
--   ('cache_ttl_cards','600'),('cache_ttl_config','300'),
--   ('cache_ttl_leaderboard','30'),('cache_ttl_quiz_stats','600'),('cache_ttl_market','15')
-- ON CONFLICT (key) DO NOTHING;

-- ─── Bots ───────────────────────────────────────────────────────────────────
create table if not exists public.bot_configs (
  id          bigserial   primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null check (type in ('seller','buyer','quiz')),
  active      boolean     not null default true,
  config      jsonb       not null default '{}',
  last_run_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Index pour la recherche de pseudo (insensible à la casse)
create unique index if not exists profiles_pseudo_ci on public.profiles (lower(pseudo));

-- ─── 2. Cartes (pool global, géré par admin) ────────────────────────
create table if not exists public.cards (
  id          serial      primary key,
  name        text        not null,
  type        text        not null default 'Normal',
  rarity      text        not null check (rarity in ('commun','rare','épique','légendaire','achievement')),
  image_url   text,
  description text        not null default '',
  sellable    boolean     not null default true,
  min_price   integer,
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- ─── 3. Collections joueurs ─────────────────────────────────────────
create table if not exists public.collections (
  id         bigserial   primary key,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  card_id    integer     not null references public.cards(id),
  quantity   integer     not null default 1 check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create index if not exists collections_user_id on public.collections(user_id);

-- ─── 4. Marché (listings actifs) ────────────────────────────────────
create table if not exists public.market_listings (
  id         bigserial   primary key,
  seller_id  uuid        not null references public.profiles(id) on delete cascade,
  card_id    integer     not null references public.cards(id),
  price      integer     not null check (price > 0),
  status     text        not null default 'active' check (status in ('active','sold','cancelled')),
  buyer_id   uuid        references public.profiles(id),
  created_at timestamptz not null default now(),
  sold_at    timestamptz
);

create index if not exists listings_card_price on public.market_listings(card_id, status, price);
create index if not exists listings_seller     on public.market_listings(seller_id, status);

-- ─── 5. Transactions (historique) ───────────────────────────────────
create table if not exists public.transactions (
  id           bigserial   primary key,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  type         text        not null check (type in ('achat','vente')),
  card_id      integer     not null references public.cards(id),
  card_name    text        not null,
  rarity       text        not null,
  price        integer     not null,
  counterpart  text        not null,  -- pseudo de l'acheteur/vendeur
  listing_id   bigint      references public.market_listings(id),
  created_at   timestamptz not null default now()
);

create index if not exists transactions_user on public.transactions(user_id, created_at desc);

-- ─── 6. Questions géocaching ────────────────────────────────────────
create table if not exists public.questions (
  id         serial      primary key,
  question   text        not null,
  answer     text        not null,
  hint       text        not null default '',
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

-- ─── 7. Sessions quiz ───────────────────────────────────────────────
create table if not exists public.quiz_sessions (
  id          bigserial   primary key,
  question_id integer     references public.questions(id),
  card_id     integer     references public.cards(id),
  started_at  timestamptz not null default now(),
  solved_by   uuid        references public.profiles(id),
  solved_at   timestamptz,
  status      text        not null default 'active' check (status in ('active','solved','expired'))
);

-- ─── 8. Participations quiz (1 Gold par session par joueur) ─────────
create table if not exists public.quiz_participations (
  user_id         uuid    not null references public.profiles(id) on delete cascade,
  quiz_session_id bigint  not null references public.quiz_sessions(id) on delete cascade,
  gold_granted    integer not null default 1,
  created_at      timestamptz not null default now(),
  primary key (user_id, quiz_session_id)
);

-- ─── 9. Achievements débloqués ──────────────────────────────────────
create table if not exists public.achievements (
  id              bigserial   primary key,
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  achievement_key text        not null,
  unlocked_at     timestamptz not null default now(),
  unique (user_id, achievement_key)  -- idempotent
);

-- ─── 9. IPs bannies ─────────────────────────────────────────────────
create table if not exists public.banned_ips (
  id         serial      primary key,
  ip         inet        not null unique,
  reason     text,
  banned_at  timestamptz not null default now(),
  expires_at timestamptz  -- null = permanent
);

-- ─── 10. Configuration (limites, maintenance) ───────────────────────
create table if not exists public.config (
  key   text primary key,
  value jsonb not null
);

-- Valeurs par défaut
insert into public.config (key, value) values
  ('limits_connected',   '{"dailyGold": 200, "dailyCards": 20}'),
  ('limits_guest',       '{"dailyGold": 50,  "dailyCards": 5}'),
  ('maintenance',        '{"on": false, "text": ""}'),
  ('registration_whitelist', '{
    "enabled": false,
    "domains": [
      "gmail.com","googlemail.com",
      "yahoo.com","yahoo.fr","yahoo.co.uk","yahoo.de","yahoo.es","yahoo.it","yahoo.co.jp","yahoo.com.br","yahoo.com.ar","yahoo.com.mx","yahoo.com.au","yahoo.ca","yahoo.in",
      "hotmail.com","hotmail.fr","hotmail.co.uk","hotmail.de","hotmail.es","hotmail.it","hotmail.com.br","hotmail.com.ar","hotmail.be","hotmail.nl",
      "outlook.com","outlook.fr","outlook.de","outlook.es","outlook.it","outlook.com.br","outlook.be","outlook.nl","outlook.co.uk","outlook.jp","outlook.in",
      "live.com","live.fr","live.co.uk","live.de","live.nl","live.be","live.it","live.com.ar","live.com.br","live.com.mx","live.ca","live.in","live.jp",
      "msn.com","windowslive.com",
      "icloud.com","me.com","mac.com",
      "aol.com","aol.fr","aol.de","aol.co.uk",
      "protonmail.com","protonmail.ch","proton.me","pm.me",
      "tutanota.com","tutanota.de","tuta.io",
      "gmx.com","gmx.fr","gmx.de","gmx.net","gmx.at","gmx.ch","gmx.co.uk","gmx.us","gmx.org",
      "web.de","t-online.de","freenet.de","arcor.de","mailbox.org",
      "orange.fr","sfr.fr","free.fr","wanadoo.fr","laposte.net","bbox.fr","neuf.fr","aliceadsl.fr","numericable.fr","club-internet.fr","cegetel.net",
      "libero.it","virgilio.it","tin.it","tiscali.it","alice.it","fastwebnet.it","inwind.it","iol.it",
      "terra.es","telefonica.net","vodafone.es","jazztel.es","ya.com",
      "bluewin.ch","sunrise.ch","hispeed.ch",
      "skynet.be","telenet.be","proximus.be","scarlet.be","pandora.be",
      "xs4all.nl","ziggo.nl","kpnmail.nl","upcmail.nl","hetnet.nl","chello.nl",
      "btinternet.com","sky.com","virginmedia.com","talktalk.net","ntlworld.com","blueyonder.co.uk","lineone.net","tiscali.co.uk","fsnet.co.uk","btopenworld.com",
      "yandex.ru","yandex.com","yandex.ua","yandex.kz","yandex.by","mail.ru","bk.ru","inbox.ru","list.ru","rambler.ru","ya.ru",
      "qq.com","163.com","126.com","sina.com","sina.cn","foxmail.com","sohu.com","yeah.net","139.com","189.cn",
      "rediffmail.com","in.com","sify.com","indiatimes.com","dataone.in",
      "uol.com.br","terra.com.br","bol.com.br","ig.com.br","r7.com","oi.com.br","zipmail.com.br","globomail.com",
      "bigpond.com","bigpond.net.au","optusnet.com.au","internode.on.net","iinet.net.au","tpg.com.au",
      "rogers.com","shaw.ca","telus.net","videotron.ca","sympatico.ca","bell.net","eastlink.ca",
      "fastmail.com","fastmail.fm","fastmail.net","fastmail.org","fastmail.us",
      "zoho.com","zohomail.com",
      "mailfence.com","posteo.de","posteo.net","mailbox.org","disroot.org","riseup.net",
      "hey.com","basecamp.com",
      "yopmail.fr","guerrillamail.com","mailinator.com"
    ]
  }')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.collections       enable row level security;
alter table public.market_listings   enable row level security;
alter table public.transactions      enable row level security;
alter table public.achievements      enable row level security;

-- Profils : lecture publique, écriture propre uniquement
create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own"   on public.profiles for insert with check (auth.uid() = id);

-- Collections : lecture publique (classement), écriture propre
create policy "collections_select_all"  on public.collections for select using (true);
create policy "collections_write_own"   on public.collections for all using (auth.uid() = user_id);

-- Marché : lecture publique, écriture propre
create policy "listings_select_all"   on public.market_listings for select using (true);
create policy "listings_write_own"    on public.market_listings for all using (auth.uid() = seller_id);

-- Transactions : lecture propre uniquement
create policy "transactions_own"      on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert"   on public.transactions for insert with check (auth.uid() = user_id);

-- Achievements : lecture publique, insert propre
create policy "achievements_select"   on public.achievements for select using (true);
create policy "achievements_insert"   on public.achievements for insert with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER : créer le profil automatiquement après signup
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  _pseudo text;
begin
  -- Récupérer le pseudo depuis user_metadata (passé lors du signUp)
  _pseudo := coalesce(
    new.raw_user_meta_data->>'pseudo',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- S'assurer de l'unicité du pseudo
  if exists (select 1 from public.profiles where lower(pseudo) = lower(_pseudo)) then
    _pseudo := _pseudo || '_' || substring(new.id::text, 1, 4);
  end if;

  insert into public.profiles (id, pseudo, email, pseudo_history)
  values (
    new.id,
    _pseudo,
    new.email,
    jsonb_build_array(jsonb_build_object('pseudo', _pseudo, 'date', to_char(now(), 'DD/MM/YYYY')))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Attacher le trigger à auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- FONCTION : réinitialiser les limites quotidiennes (appelée par cron)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.reset_daily_limits()
returns void language plpgsql as $$
begin
  update public.profiles
  set daily_gold = 0, daily_cards = 0, daily_reset_at = current_date
  where daily_reset_at < current_date;
end;
$$;
