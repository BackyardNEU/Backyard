-- Club memberships: role hierarchy + custom role labels
-- Run this against the Supabase SQL editor or via `supabase db push`

-- 1. Mechanical role enum
CREATE TYPE club_role AS ENUM ('top_moderator', 'moderator', 'member');

-- 2. club_memberships: one row per user-club pair
CREATE TABLE club_memberships (
  user_id    uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  club_id    uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  role       club_role   NOT NULL DEFAULT 'member',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX idx_club_memberships_club_id ON club_memberships (club_id);

-- 3. club_custom_roles: display labels created per-club
-- grants_moderator_privileges=true: top_moderator only can create/assign.
-- grants_moderator_privileges=false: any moderator or top_moderator can create/assign.
CREATE TABLE club_custom_roles (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                     uuid        NOT NULL REFERENCES demo_club_data(id) ON DELETE CASCADE,
  name                        text        NOT NULL,
  grants_moderator_privileges boolean     NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);

-- 4. Add custom_role_id to memberships (nullable — not every member has a label)
-- ON DELETE SET NULL: deleting a custom role removes the label from members
-- but does NOT change their club_memberships.role.
ALTER TABLE club_memberships
  ADD COLUMN custom_role_id uuid REFERENCES club_custom_roles(id) ON DELETE SET NULL;

-- 5. Row-level security
ALTER TABLE club_memberships ENABLE ROW LEVEL SECURITY;

-- School-gated joins: users can only join clubs at their own school.
-- supabaseAdmin bypasses RLS; this is defense-in-depth.
CREATE POLICY "members can only join clubs at their own school"
ON club_memberships
FOR INSERT
WITH CHECK (
  (SELECT school FROM profiles WHERE id = user_id) =
  (SELECT school FROM demo_club_data WHERE id = club_id)
);

ALTER TABLE club_custom_roles ENABLE ROW LEVEL SECURITY;

-- Custom role creation gated by privilege level.
-- Non-privileged roles: moderator or top_moderator may create.
-- Privileged roles: top_moderator only.
CREATE POLICY "role creation based on privilege level"
ON club_custom_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM club_memberships cm
    WHERE cm.user_id = auth.uid()
      AND cm.club_id = club_custom_roles.club_id
      AND (
        (cm.role = 'moderator' AND club_custom_roles.grants_moderator_privileges = false)
        OR cm.role = 'top_moderator'
      )
  )
);

-- 6. Seed: existing member_list members → role='member'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT p.id, unnest(p.member_list)::uuid, 'member'
FROM profiles p
WHERE array_length(p.member_list, 1) > 0
ON CONFLICT (user_id, club_id) DO NOTHING;

-- 7. Seed: approved editors → upgrade to 'moderator'
INSERT INTO club_memberships (user_id, club_id, role)
SELECT user_id, club_id, 'moderator'
FROM approved_club_accounts
ON CONFLICT (user_id, club_id) DO UPDATE SET role = 'moderator';

-- Note: top_moderators are NOT auto-assigned during migration.
-- Designate them manually via the DB after verifying seeded data.
