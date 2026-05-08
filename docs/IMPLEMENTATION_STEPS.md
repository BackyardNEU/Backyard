# "This Week" Feature - Step-by-Step Implementation Guide

## Quick Reference: Implementation Order

### Step 1: Database Setup (Supabase)
**Time Estimate: 30-45 minutes**

1. **Create `club_weekly_activities` table**
   - Go to Supabase Dashboard → SQL Editor
   - Run the CREATE TABLE statement from architecture doc
   - Add RLS policy: `CREATE POLICY "Anyone can read activities" ON club_weekly_activities FOR SELECT USING (true);`
   - Add RLS policy: `CREATE POLICY "Authenticated users can insert" ON club_weekly_activities FOR INSERT WITH CHECK (auth.role() = 'authenticated');`

2. **Create `user_weekly_interests` table**
   - Run CREATE TABLE statement
   - Add RLS policy: `CREATE POLICY "Users can manage own interests" ON user_weekly_interests FOR ALL USING (auth.uid() = user_id);`
   - Add RLS policy: `CREATE POLICY "Users can read all interests" ON user_weekly_interests FOR SELECT USING (true);`

3. **Create indexes**
   ```sql
   CREATE INDEX idx_activities_club_week ON club_weekly_activities(club_id, week_start_date);
   CREATE INDEX idx_interests_user_activity ON user_weekly_interests(user_id, activity_id);
   CREATE INDEX idx_interests_activity_day ON user_weekly_interests(activity_id, day_of_week);
   ```

### Step 2: Add Icon to IconBar
**Time Estimate: 10 minutes**

1. Open `src/uni_components/IconBar.jsx`
2. Add to `icons` array (at the beginning for visibility):
   ```javascript
   { name: "calendar", label: "This Week", category: "this_week" },
   ```
3. Add calendar icon image to `/src/assets/calendar.png` (or use existing icon)

### Step 3: Create Helper Utilities
**Time Estimate: 15 minutes**

1. Create `src/utils/weekHelpers.js`:
   ```javascript
   export const getMondayOfWeek = (date) => {
     const d = new Date(date);
     const day = d.getDay();
     const diff = d.getDate() - day + (day === 0 ? -6 : 1);
     return new Date(d.setDate(diff));
   };

   export const getNextWeekMonday = () => {
     const today = new Date();
     const monday = getMondayOfWeek(today);
     monday.setDate(monday.getDate() + 7);
     return monday;
   };

   export const formatWeekRange = (monday) => {
     const friday = new Date(monday);
     friday.setDate(friday.getDate() + 4);
     return `${monday.toLocaleDateString()} - ${friday.toLocaleDateString()}`;
   };

   export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
   ```

### Step 4: Create InterestButton Component
**Time Estimate: 30 minutes**

1. Create `src/uni_components/InterestButton.jsx`:
   - Props: `activityId`, `dayOfWeek`, `initialInterested`, `onToggle`
   - State: `isInterested`
   - Function: `handleClick` that toggles interest in database
   - UI: Button with "I'm interested" / "Not interested" text

### Step 5: Create WeeklyClubCard Component
**Time Estimate: 45 minutes**

1. Create `src/uni_components/WeeklyClubCard.jsx`:
   - Props: `club`, `summary`, `dayOfWeek`, `activityId`
   - Display: Club image, name, summary text
   - Include `InterestButton` component
   - Placeholder for friends count (will implement later)
   - Click handler to expand (reuse ExpandedTile pattern)

2. Create `src/uni_components/WeeklyClubCard.css`:
   - Compact card styling
   - Hover effects
   - Responsive design

### Step 6: Create WeeklySchedule Component
**Time Estimate: 1-2 hours**

1. Create `src/uni_components/WeeklySchedule.jsx`:
   - Fetch activities for current week
   - Group activities by day
   - Render 5 columns (Monday-Friday)
   - Each column contains `WeeklyClubCard` components
   - Handle loading and empty states

2. Create `src/uni_components/WeeklySchedule.css`:
   - Grid or flexbox layout for days
   - Horizontal scroll on mobile
   - Day headers styling

### Step 7: Integrate into UniversityPage
**Time Estimate: 30 minutes**

1. Open `src/uni_components/UniversityPage.jsx`
2. Add case in `getClubsBasedOnCategory`:
   ```javascript
   else if (newCategory === "this_week") {
     setSelectedCategory(newCategory);
     // Fetch and display weekly schedule
     // For now, set results to empty and render WeeklySchedule separately
   }
   ```
3. Add conditional rendering:
   ```javascript
   {selectedCategory === "this_week" ? (
     <WeeklySchedule />
   ) : (
     <ClubList results={results} />
   )}
   ```

### Step 8: Create Data Fetching Functions
**Time Estimate: 45 minutes**

1. Create `src/utils/weeklyScheduleQueries.js`:
   ```javascript
   export const fetchWeeklyActivities = async (weekStartDate) => {
     // Query club_weekly_activities with club data
   };

   export const fetchUserInterests = async (activityIds, userId) => {
     // Query user_weekly_interests for current user
   };

   export const toggleInterest = async (activityId, dayOfWeek, userId, isInterested) => {
     // Insert or delete from user_weekly_interests
   };
   ```

### Step 9: Activity Input Modal (MVP)
**Time Estimate: 1-2 hours**

1. Create `src/uni_components/ActivityInputModal.jsx`:
   - Week selector (defaults to next week)
   - 5 text inputs (one per day)
   - Save button
   - Close button
   - Form validation

2. Add trigger button (can be in ExpandedTile for now):
   - "Add Weekly Activities" button
   - Opens modal
   - On save, upsert to `club_weekly_activities`

### Step 10: Testing & Refinement
**Time Estimate: 1 hour**

1. Test "I'm interested" button functionality
2. Test activity input and display
3. Test week navigation (if added)
4. Fix any styling issues
5. Test responsive design
6. Add error handling

## Future Steps (After MVP)

### Step 11: Friends System
1. Create `friendships` table
2. Add friend request UI
3. Update queries to show friends only
4. Add friend avatars to cards

### Step 12: Enhancements
1. Week navigation (previous/next week)
2. Notifications
3. Recurring activities
4. Admin dashboard

## File Structure After Implementation

```
src/
├── uni_components/
│   ├── IconBar.jsx (modified)
│   ├── UniversityPage.jsx (modified)
│   ├── WeeklySchedule.jsx (new)
│   ├── WeeklySchedule.css (new)
│   ├── WeeklyClubCard.jsx (new)
│   ├── WeeklyClubCard.css (new)
│   ├── InterestButton.jsx (new)
│   └── ActivityInputModal.jsx (new)
├── utils/
│   ├── weekHelpers.js (new)
│   └── weeklyScheduleQueries.js (new)
└── assets/
    └── calendar.png (new - if needed)
```

## Testing Checklist

- [ ] Icon appears in IconBar
- [ ] Clicking icon shows weekly schedule
- [ ] Activities display correctly grouped by day
- [ ] "I'm interested" button toggles correctly
- [ ] Interest persists after page refresh
- [ ] Activity input modal opens and saves
- [ ] Activities show up in correct week
- [ ] Empty states display correctly
- [ ] Mobile responsive design works
- [ ] Error handling works for failed queries

## Database Migration Script

Save this as a SQL file to run in Supabase:

```sql
-- Create club_weekly_activities table
CREATE TABLE IF NOT EXISTS club_weekly_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES demo_club_data(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  monday_summary TEXT,
  tuesday_summary TEXT,
  wednesday_summary TEXT,
  thursday_summary TEXT,
  friday_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_id, week_start_date)
);

-- Create user_weekly_interests table
CREATE TABLE IF NOT EXISTS user_weekly_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES club_weekly_activities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, activity_id, day_of_week)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activities_club_week ON club_weekly_activities(club_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_interests_user_activity ON user_weekly_interests(user_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_interests_activity_day ON user_weekly_interests(activity_id, day_of_week);

-- Enable RLS
ALTER TABLE club_weekly_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for club_weekly_activities
CREATE POLICY "Anyone can read activities" 
  ON club_weekly_activities FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can insert activities" 
  ON club_weekly_activities FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own activities" 
  ON club_weekly_activities FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- RLS Policies for user_weekly_interests
CREATE POLICY "Users can manage own interests" 
  ON user_weekly_interests FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read interests" 
  ON user_weekly_interests FOR SELECT 
  USING (true);
```
