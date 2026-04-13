-- TEC Scheduling — Supabase schema
-- Run this in the Supabase SQL editor before first use.

create table if not exists crew (
  id               integer primary key,
  name             text    not null,
  nat              text    default '',
  airport          text    default '',
  email            text    default '',
  phone            text    default '',
  pos_id           integer,
  ship_id          integer,
  status           text    default 'Off',
  sign_on          text    default '',
  sign_off         text    default '',
  contract         integer default 6,
  certs            jsonb   default '[]',
  notes            text    default '',
  passport         text    default '',
  passport_no      text    default '',
  medical          text    default '',
  visa             text    default '',
  seaman_book      text    default '',
  seaman_book_exp  text    default '',
  docs             jsonb   default '[]',
  dob              text    default '',
  blood_type       text    default '',
  allergies        text    default '',
  med_notes        text    default '',
  ec_name          text    default '',
  ec_rel           text    default '',
  ec_phone         text    default '',
  ec_email         text    default '',
  ec_addr          text    default '',
  training         text    default '',
  rating           integer default 0,
  skills           jsonb   default '{}',
  abbr             text    default '',
  ship_code        text    default '',
  tenure           numeric default 0,
  category         text    default '',
  future_ship      text    default '',
  future_on        text    default '',
  future_off       text    default '',
  future_name      text    default '',
  sign_on_reason   text    default '',
  sign_off_reason  text    default '',
  ship_history     jsonb   default '[]'
);

create table if not exists ships (
  id          integer primary key,
  name        text    not null,
  ship_class  text    default '',
  imo         text    default '',
  port        text    default '',
  gt          text    default '',
  status      text    default 'Active',
  notes       text    default ''
);

create table if not exists positions (
  id          integer primary key,
  title       text    not null,
  abbr        text    default '',
  rank        text    default '',
  contract    integer default 6,
  handover    integer default 4,
  certs       jsonb   default '[]',
  description text    default ''
);

create table if not exists rotations (
  id          serial  primary key,
  ship        text    not null,
  pos_id      integer,
  type        text    default '',
  date        text    default '',
  port        text    default '',
  crew        text    default '',
  notes       text    default ''
);

create table if not exists offers (
  id          integer primary key,
  type        text    default 'Offer',
  crew_id     integer,
  ship_id     integer,
  pos_id      integer,
  stage       text    default 'draft',
  start_date  text    default '',
  end_date    text    default '',
  notes       text    default '',
  history     jsonb   default '[]'
);

create table if not exists compliance (
  id          integer primary key,
  title       text    not null,
  cat         text    default '',
  description text    default ''
);

create table if not exists app_meta (
  key         text    primary key,
  value       text    not null
);

-- Seed nextId
insert into app_meta (key, value) values ('nextId', '500')
  on conflict (key) do nothing;
