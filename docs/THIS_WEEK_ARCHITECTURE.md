# "This Week" Feature Architecture

## Overview
A new tab in the icon bar that curates club cards into Monday-Friday categories, showing weekly activities and which friends are interested.

## Database Schema Changes

### 1. `club_weekly_activities` Table
Stores weekly activity information for each club.

```sql
CREATE TABLE club_weekly_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES demo_club_data(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Monday of the week
  monday_summary TEXT,
  tuesday_summary TEXT,
  wednesday_summary TEXT,
  thursday_summary TEXT,
  friday_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, week_start_date)
);
```

**Purpose**: Each row represents one week's activities for a club. The week_start_date is always the Monday of that week.

### 2. `user_weekly_interests` Table
Tracks which users are interested in which club activities on which days.

```sql
CREATE TABLE user_weekly_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES club_weekly_activities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 4), -- 0=Monday, 4=Friday
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, activity_id, day_of_week)
);
```

**Purpose**: When a user clicks "I'm interested" for a specific day, a row is created here.

### 3. `friendships` Table (Future)
For tracking friend relationships (to be implemented later).

```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);
```

**Purpose**: Track friend relationships for showing "which friends are going" feature.

## Component Architecture

### 1. New Icon in IconBar
- **File**: `src/uni_components/IconBar.jsx`
- **Change**: Add new icon object to the `icons` array
- **Icon**: Suggest using a calendar icon (`calendar.png`)
- **Category**: `"this_week"`

### 2. WeeklySchedule Component (New)
- **File**: `src/uni_components/WeeklySchedule.jsx`
- **Purpose**: Main component that displays the weekly schedule
- **Structure**:
  - Header showing current week range
  - Five columns (Monday-Friday)
  - Each column contains cards for clubs with activities that day
  - Cards show: club image, name, 1-line summary, "X friends going" badge

### 3. WeeklyClubCard Component (New)
- **File**: `src/uni_components/WeeklyClubCard.jsx`
- **Purpose**: Individual card for a club's activity on a specific day
- **Props**:
  - `club`: Club data
  - `summary`: The 1-line summary for that day
  - `dayOfWeek`: Which day (0-4)
  - `friendsGoing`: Array of friend user IDs
  - `isInterested`: Boolean if current user is interested
- **Features**:
  - "I'm interested" button
  - Friend avatars/count display
  - Click to expand (reuse ExpandedTile pattern)

### 4. ActivityInputModal Component (New)
- **File**: `src/uni_components/ActivityInputModal.jsx`
- **Purpose**: Modal for clubs to input their weekly activities
- **Features**:
  - Week selector (defaults to next week)
  - Text inputs for each day (Monday-Friday)
  - Save button
  - Only accessible to club admins/owners (future: role-based access)

### 5. InterestButton Component (New)
- **File**: `src/uni_components/InterestButton.jsx`
- **Purpose**: Reusable button for "I'm interested" functionality
- **Features**:
  - Toggle state (interested/not interested)
  - Updates `user_weekly_interests` table
  - Visual feedback on click

## Data Flow

### Fetching Weekly Schedule
1. User clicks "This Week" icon
2. `UniversityPage` calls `getClubsForThisWeek()`
3. Query `club_weekly_activities` for current week (Monday of current week)
4. For each activity, join with:
   - `demo_club_data` for club info
   - `user_weekly_interests` to get interested users
   - `friendships` (when implemented) to filter to friends only
5. Group activities by day of week
6. Pass grouped data to `WeeklySchedule` component

### User Clicks "I'm Interested"
1. User clicks button on a `WeeklyClubCard`
2. `InterestButton` handler is called
3. Check if user is already interested (query `user_weekly_interests`)
4. If not interested: INSERT into `user_weekly_interests`
5. If already interested: DELETE from `user_weekly_interests`
6. Update local state and re-fetch friends list

### Adding Weekly Activities (Club Admin)
1. Club admin opens `ActivityInputModal`
2. Selects week (defaults to next week)
3. Fills in summaries for each day
4. On save: UPSERT into `club_weekly_activities`
5. Modal closes, schedule refreshes

## Implementation Steps

### Phase 1: Database Setup
1. Create `club_weekly_activities` table in Supabase
2. Create `user_weekly_interests` table in Supabase
3. Set up Row Level Security (RLS) policies:
   - `club_weekly_activities`: Read all, write for authenticated users
   - `user_weekly_interests`: Users can only read/write their own interests
4. Create indexes for performance:
   - `club_weekly_activities(club_id, week_start_date)`
   - `user_weekly_interests(user_id, activity_id, day_of_week)`

### Phase 2: UI Components
1. Add "This Week" icon to `IconBar.jsx`
2. Create `WeeklySchedule.jsx` component
3. Create `WeeklyClubCard.jsx` component
4. Create `InterestButton.jsx` component
5. Update `UniversityPage.jsx` to handle "this_week" category

### Phase 3: Data Integration
1. Create Supabase query functions for fetching weekly schedule
2. Implement "I'm interested" button functionality
3. Add data fetching to `WeeklySchedule` component
4. Handle loading and error states

### Phase 4: Activity Input (MVP)
1. Create `ActivityInputModal.jsx`
2. Add button/trigger to open modal (could be in ExpandedTile for now)
3. Implement form submission to Supabase
4. Add validation (at least one day must have content)

### Phase 5: Friends Integration (Future)
1. Create `friendships` table
2. Add friend request/acceptance UI
3. Update queries to filter and show friends only
4. Add friend avatars to `WeeklyClubCard`

## Key Functions Needed

### In UniversityPage.jsx
```javascript
const getClubsForThisWeek = async () => {
  // Get Monday of current week
  const today = new Date();
  const monday = getMondayOfWeek(today);
  
  // Fetch activities for this week
  const { data: activities, error } = await supabase
    .from('club_weekly_activities')
    .select(`
      *,
      club:demo_club_data(*)
    `)
    .eq('week_start_date', monday.toISOString().split('T')[0]);
  
  // Group by day and fetch user interests
  // Return structured data for WeeklySchedule
};
```

### Helper Functions
```javascript
// Get Monday of a given week
const getMondayOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

// Get next week's Monday
const getNextWeekMonday = () => {
  const today = new Date();
  const monday = getMondayOfWeek(today);
  monday.setDate(monday.getDate() + 7);
  return monday;
};
```

## Styling Considerations
- WeeklySchedule should use a horizontal scroll or grid layout
- Each day column should be clearly labeled
- Cards should be compact but readable
- "I'm interested" button should be prominent
- Friend avatars should be small and grouped
- Responsive design for mobile (stack days vertically)

## Security & Performance
- RLS policies to prevent unauthorized access
- Indexes on frequently queried columns
- Consider caching weekly data (changes infrequently)
- Pagination if many clubs have activities
- Optimistic UI updates for "I'm interested" button

## Future Enhancements
1. Notifications when friends show interest
2. Calendar view option
3. Recurring activities
4. Activity reminders
5. Club admin dashboard for managing activities
6. Analytics on interest levels
