# Supabase Migrations

This directory contains all database migrations and setup files for the Bialy production backend.

## Files

### Migrations (Run in Order)

1. **001_create_schema.sql** - Creates all database tables and indexes
2. **002_enable_rls.sql** - Enables Row Level Security and creates all access policies
3. **003_storage_setup.sql** - Creates storage bucket RLS policies
4. **004_triggers.sql** - Creates triggers for auto-updates and cleanup

### Documentation

- **SETUP_INSTRUCTIONS.md** - Complete step-by-step setup guide
- **README.md** - This file

## Quick Start

1. Follow instructions in `SETUP_INSTRUCTIONS.md`
2. Run migrations in order (001 → 002 → 003 → 004)
3. Verify each migration succeeds before proceeding

## Database Schema

### Tables

- **profiles** - User profiles (extends auth.users)
- **dashboards** - User dashboards with sharing permissions
- **metrics** - Time series metrics within dashboards
- **metric_configurations** - Configuration data for metrics

### Key Features

- **Row Level Security** - 18 policies controlling access
- **Auto-timestamps** - updated_at automatically maintained
- **Auto-cleanup** - CSV files deleted when metrics are removed
- **Profile creation** - Automatic on first Google OAuth login

## Storage Structure

```
csv-files/
  {user_id}/
    {dashboard_id}/
      {metric_id}.csv
```

Example:
```
csv-files/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    d1e2f3a4-b5c6-7890-def1-234567890abc/
      m1n2o3p4-q5r6-7890-ghi1-234567890def.csv
```

## Security Model

- **Private** (default): Only owner can access
- **Domain**: Anyone with same email domain can VIEW
- **Public**: Anyone with link can VIEW
- Only owners can EDIT/DELETE their content

## Development

These migrations are designed to be idempotent where possible. However, some operations (like CREATE TRIGGER) may fail if run multiple times. Use DROP statements to reset if needed.

## Production

Before running in production:
1. Test all migrations in staging environment
2. Backup database before applying changes
3. Run migrations during low-traffic period
4. Monitor logs for errors
5. Verify RLS policies work correctly

## Support

For issues or questions, refer to:
- Supabase documentation: https://supabase.com/docs
- Project PRD: `docs/PRD_WEB_PRODUCTION.md`
- Execution plan: `docs/EXECUTION_PLAN.md`
