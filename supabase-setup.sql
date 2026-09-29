-- ============================================================
-- ROGGA UNIFORMES — Setup do banco de dados (Supabase)
-- Rode este script inteiro no SQL Editor do Supabase.
-- ============================================================

-- Tabela de designers e administrador
create table if not exists designers (
  username    text primary key,
  nome        text not null,
  senha_hash  text not null,
  papel       text not null default 'designer',  -- 'designer' ou 'admin'
  criado_em   timestamptz not null default now()
);

-- Tabela de gerações de arte (métricas)
create table if not exists geracoes (
  id                 bigint generated always as identity primary key,
  designer_username  text not null references designers(username),
  empresa            text,
  categoria          text,
  tempo_ms           integer,
  criado_em          timestamptz not null default now()
);

create index if not exists idx_geracoes_designer on geracoes(designer_username);
create index if not exists idx_geracoes_data on geracoes(criado_em);

-- Usuários iniciais (senha padrão de todos: rogga123)
insert into designers (username, nome, senha_hash, papel) values
  ('gustavo',  'Gustavo',  '01dac11c97349fa603077177113151ce:693a8b5836ab00c51fbf04c80fb72be7aebb88fc1bd9e35a4eb4295b2f1d5cde4493bfda74d6136dd88538b5beb4961e127ed9c7f512780e656b780e6d853848', 'designer'),
  ('raphael',  'Raphael',  '01dac11c97349fa603077177113151ce:693a8b5836ab00c51fbf04c80fb72be7aebb88fc1bd9e35a4eb4295b2f1d5cde4493bfda74d6136dd88538b5beb4961e127ed9c7f512780e656b780e6d853848', 'designer'),
  ('fellipe',  'Fellipe',  '01dac11c97349fa603077177113151ce:693a8b5836ab00c51fbf04c80fb72be7aebb88fc1bd9e35a4eb4295b2f1d5cde4493bfda74d6136dd88538b5beb4961e127ed9c7f512780e656b780e6d853848', 'designer'),
  ('miqueias', 'Miqueias', '01dac11c97349fa603077177113151ce:693a8b5836ab00c51fbf04c80fb72be7aebb88fc1bd9e35a4eb4295b2f1d5cde4493bfda74d6136dd88538b5beb4961e127ed9c7f512780e656b780e6d853848', 'designer'),
  ('jonathas', 'Jonathas', '01dac11c97349fa603077177113151ce:693a8b5836ab00c51fbf04c80fb72be7aebb88fc1bd9e35a4eb4295b2f1d5cde4493bfda74d6136dd88538b5beb4961e127ed9c7f512780e656b780e6d853848', 'admin')
on conflict (username) do nothing;
