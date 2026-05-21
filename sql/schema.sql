-- =====================================================
-- Student Attendance & Homework Tracker — Supabase Schema
-- Steps:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire file and click "Run"
-- =====================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Students
create table if not exists students (
  id           uuid        primary key default uuid_generate_v4(),
  student_code varchar(20) unique not null,
  name         varchar(100) not null,
  gender       varchar(10)  not null,
  dob          date,
  classroom    varchar(30)  not null,
  status       varchar(20)  not null default 'active'
                            check (status in ('active','quit','transfer')),
  created_at   timestamptz  default now()
);

-- Subjects
create table if not exists subjects (
  id           serial       primary key,
  subject_name varchar(100) unique not null
);

-- Attendance  (unique per student + subject + date)
create table if not exists attendance (
  id         bigserial    primary key,
  student_id uuid         references students(id) on delete cascade,
  subject_id integer      references subjects(id)  on delete cascade,
  date       date         not null default current_date,
  status     varchar(20)  not null,
  created_at timestamptz  default now(),
  constraint attendance_unique unique (student_id, subject_id, date)
);

-- Homework records
create table if not exists homework_records (
  id             bigserial    primary key,
  student_id     uuid         references students(id) on delete cascade,
  subject_id     integer      references subjects(id)  on delete cascade,
  date           date         not null default current_date,
  homework_title varchar(200) not null,
  status         varchar(40)  not null,
  created_at     timestamptz  default now()
);

-- Indexes for faster queries
create index if not exists idx_att_student   on attendance(student_id);
create index if not exists idx_att_date      on attendance(date);
create index if not exists idx_att_subject   on attendance(subject_id);
create index if not exists idx_hw_student    on homework_records(student_id);
create index if not exists idx_hw_date       on homework_records(date);
create index if not exists idx_stu_classroom on students(classroom);

-- Pre-seed default subjects
insert into subjects (subject_name) values
  ('គណិតវិទ្យា'),
  ('រូបវិទ្យា'),
  ('គីមីវិទ្យា'),
  ('ជីវវិទ្យា'),
  ('ភាសាខ្មែរ'),
  ('ភាសាអង់គ្លេស'),
  ('ភាសាបារាំង'),
  ('ប្រវត្តិវិទ្យា'),
  ('ភូមិវិទ្យា'),
  ('សីលធម៌-ពលរដ្ឋ'),
  ('កីឡា'),
  ('ព័ត៌មានវិទ្យា')
on conflict (subject_name) do nothing;

-- =====================================================
-- Row Level Security (RLS) — enable for production
-- For a single-teacher app, the simplest approach is
-- to allow all operations from the anon key.
-- =====================================================
alter table students         enable row level security;
alter table subjects         enable row level security;
alter table attendance       enable row level security;
alter table homework_records enable row level security;

create policy "allow_all_students"         on students         for all using (true) with check (true);
create policy "allow_all_subjects"         on subjects         for all using (true) with check (true);
create policy "allow_all_attendance"       on attendance       for all using (true) with check (true);
create policy "allow_all_homework_records" on homework_records for all using (true) with check (true);

-- =====================================================
-- MIGRATION — run this if the students table already
-- exists (e.g. you ran the schema before this update)
-- =====================================================
alter table students
  add column if not exists status varchar(20) not null default 'active'
  check (status in ('active','quit','transfer'));

create index if not exists idx_stu_status on students(status);

-- =====================================================
-- PROFILES — user roles (admin / teacher)
-- Run this block after the tables above.
-- =====================================================
create table if not exists profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text        not null default '',
  email      text        not null default '',
  role       text        not null default 'teacher'
             check (role in ('admin','teacher')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "profiles_select"       on profiles for select using (true);
create policy "profiles_insert"       on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_admin" on profiles for update
  using ((select role from profiles where id = auth.uid()) = 'admin' or auth.uid() = id);

-- Auto-create profile when a new Supabase Auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'teacher')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ⚠️ IMPORTANT: After running this SQL, make yourself admin:
--   update profiles set role = 'admin' where email = 'your-email@example.com';
-- (replace with your actual login email)

-- =====================================================
-- DASHBOARD HELPER FUNCTIONS
-- Run this block to fix the 1000-row classroom limit.
-- =====================================================

-- Returns every classroom with its active student count.
-- Bypasses PostgREST row-limit; one round-trip from the browser.
create or replace function get_classroom_stats()
returns table(classroom text, total bigint)
language sql security definer
set search_path = public
as $$
  select classroom, count(*)::bigint as total
  from students
  where status = 'active'
  group by classroom
  order by classroom;
$$;

-- Allow anon / authenticated roles to call it
grant execute on function get_classroom_stats() to anon, authenticated;

-- =====================================================
-- MSTUDENT (ប្រធានថ្នាក់) ROLE
-- =====================================================
-- Add classroom column to profiles (which class this mstudent monitors)
alter table profiles add column if not exists classroom varchar(30) default '';

-- Update profiles role check to allow mstudent
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','teacher','mstudent'));

-- Teacher attendance table
create table if not exists teacher_attendance (
  id          bigserial    primary key,
  teacher_id  uuid         references profiles(id) on delete cascade,
  date        date         not null default current_date,
  status      varchar(20)  not null default 'វត្តមាន',
  note        text         default '',
  created_at  timestamptz  default now(),
  constraint teacher_att_unique unique (teacher_id, date)
);
alter table teacher_attendance enable row level security;
create policy "allow_all_teacher_att" on teacher_attendance for all using (true) with check (true);
create index if not exists idx_teacher_att_date on teacher_attendance(date);
