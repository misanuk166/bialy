# Dashboard Settings Migrations

This directory contains database migrations for the dashboard settings feature.

## Migrations to Apply

To enable the dashboard settings feature, you need to apply these migrations to your Supabase database:

1. **007_create_dashboard_settings.sql** - Creates the `dashboard_settings` table
2. **008_dashboard_settings_rls.sql** - Enables Row Level Security policies for settings

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** tab
3. Click **New Query**
4. Copy the contents of `007_create_dashboard_settings.sql` and paste it into the editor
5. Click **Run** to execute the migration
6. Repeat steps 3-5 for `008_dashboard_settings_rls.sql`

### Option 2: Supabase CLI (if linked)

If you have the Supabase CLI installed and your project linked:

```bash
npx supabase db push
```

## Verification

After applying the migrations, verify they were successful by running this query in the SQL Editor:

```sql
-- Check if the table was created
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'dashboard_settings';

-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'dashboard_settings';

-- Check if policies exist

```

You should see:
- The `dashboard_settings` table exists
- `rowsecurity` is `true` (RLS enabled)
- 4 policies exist (view, insert, update, delete)

## What This Feature Does

Once the migrations are applied, users can:

1. **Configure Global Defaults** - Set default values for all dashboards:
   - Number formatting (decimal places)
   - Chart appearance (colors, date ranges, aggregation)
   - Data display (show/hide shadows, goals, annotations, confidence intervals)

2. **Dashboard-Specific Overrides** - Customize settings for individual dashboards:
   - Each dashboard can override global settings
   - Settings are user-specific (each user has their own preferences)

3. **Access the Settings Page** - Navigate to `/settings` to configure preferences

## Database Schema

The `dashboard_settings` table stores:
- `user_id` - The user who owns the settings
- `dashboard_id` - NULL for global settings, dashboard ID for overrides
- `setting_id` - The setting identifier (e.g., 'decimalPlaces', 'seriesColor')
- `setting_value` - JSONB value supporting any data type
- Unique constraint on (user_id, dashboard_id, setting_id)

## Rollback

If you need to rollback these migrations, run:

```sql
-- Drop the table (will cascade delete all settings)
DROP TABLE IF EXISTS public.dashboard_settings CASCADE;
```

**Warning:** This will permanently delete all user settings!
