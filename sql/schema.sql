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
