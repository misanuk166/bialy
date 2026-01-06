# Bialy Web Production - Execution Plan

**Based on**: PRD_WEB_PRODUCTION.md
**Stack**: Vercel + Supabase

---

## Phase 1: Supabase Backend Setup

### Goal
Set up Supabase project with complete database schema, authentication, and storage configuration.

### Tasks

#### 1.1 Create Supabase Project
- [ ] Sign up at supabase.com
- [ ] Create new project: "bialy-production"
- [ ] Choose region (closest to target users)
- [ ] Note project URL and API keys
- [ ] Set up 2FA for Supabase account

#### 1.2 Database Schema Setup
- [ ] Navigate to SQL Editor in Supabase
- [ ] Create `profiles` table with schema from PRD
- [ ] Create `dashboards` table with schema from PRD
- [ ] Create `metrics` table with schema from PRD
- [ ] Create `metric_configurations` table with schema from PRD
- [ ] Add all indexes (dashboards_owner, metrics_dashboard, metric_configs_metric)
- [ ] Verify foreign key relationships

#### 1.3 Row Level Security (RLS) Policies
- [ ] Enable RLS on all tables
- [ ] Create profiles RLS policies (view/update own profile)
- [ ] Create dashboards RLS policies:
  - [ ] Users can view own dashboards
  - [ ] Users can view domain-shared dashboards
  - [ ] Anyone can view public dashboards
  - [ ] Users can insert/update/delete own dashboards
- [ ] Create metrics RLS policies (inherit from dashboard access)
- [ ] Create metric_configurations RLS policies (inherit from metric access)
- [ ] Test RLS policies with SQL queries

#### 1.4 Google OAuth Setup
- [ ] Go to Google Cloud Console (console.cloud.google.com)
- [ ] Create new project or select existing
- [ ] Enable Google+ API
- [ ] Create OAuth 2.0 credentials:
  - [ ] Application type: Web application
  - [ ] Authorized redirect URI: `https://[project-id].supabase.co/auth/v1/callback`
- [ ] Copy Client ID and Client Secret
- [ ] In Supabase: Authentication > Providers > Google
- [ ] Paste Client ID and Client Secret
- [ ] Enable Google provider
- [ ] Test OAuth flow in Supabase dashboard

#### 1.5 Storage Setup
- [ ] Navigate to Storage in Supabase
- [ ] Create bucket: `csv-files`
- [ ] Set bucket to private (not public)
- [ ] Configure allowed MIME types: `text/csv, application/csv`
- [ ] Set max file size: 10MB
- [ ] Create storage RLS policies:
  - [ ] Users can upload to their own folders
  - [ ] Users can read files from accessible dashboards
- [ ] Test file upload and download via Supabase dashboard

#### 1.6 Database Functions/Triggers (Optional)
- [ ] Create trigger for auto-updating `updated_at` timestamps
- [ ] Create trigger for cleaning up CSV files on metric deletion
- [ ] Create function for domain extraction from email

**Deliverable**: Fully configured Supabase backend ready for frontend integration

---

## Phase 2: Vercel Deployment Setup

### Goal
Deploy current application to Vercel with proper configuration.

### Tasks

#### 2.1 Vercel Account Setup
- [ ] Sign up at vercel.com (use GitHub account for easy integration)
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Connect GitHub repository to Vercel

#### 2.2 Project Configuration
- [ ] Create `vercel.json` in project root:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```
- [ ] Verify `.gitignore` excludes `.vercel` directory
- [ ] Add environment variable placeholders to `.env.example`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

#### 2.3 Environment Variables
- [ ] In Vercel dashboard, navigate to project settings
- [ ] Add environment variables:
  - [ ] `VITE_SUPABASE_URL` = Supabase project URL
  - [ ] `VITE_SUPABASE_ANON_KEY` = Supabase anon/public key
- [ ] Make variables available to all environments (preview, production)

#### 2.4 Initial Deployment
- [ ] Push current code to GitHub
- [ ] Trigger deployment from Vercel dashboard
- [ ] Verify build succeeds
- [ ] Visit deployment URL and verify app loads
- [ ] Test that environment variables are accessible

#### 2.5 Domain Setup (Optional)
- [ ] Purchase domain (if not already owned)
- [ ] Add custom domain in Vercel dashboard
- [ ] Update DNS records as instructed by Vercel
- [ ] Wait for SSL certificate provisioning
- [ ] Verify HTTPS works on custom domain

#### 2.6 Deployment Configuration
- [ ] Enable automatic deployments from main branch
- [ ] Configure preview deployments for pull requests
- [ ] Set up deployment notifications (Slack, email, etc.)

**Deliverable**: Live deployment of current app on Vercel with environment variables configured

---

## Phase 3: Frontend Authentication

### Goal
Implement Google OAuth login and authentication state management.

### Tasks

#### 3.1 Install Dependencies
- [ ] Install Supabase client: `npm install @supabase/supabase-js`
- [ ] Install React Router: `npm install react-router-dom`
- [ ] Update package.json and commit

#### 3.2 Supabase Client Setup
- [ ] Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
- [ ] Test client initialization

#### 3.3 Authentication Context
- [ ] Create `src/contexts/AuthContext.tsx`
- [ ] Implement AuthProvider with:
  - [ ] `user` state (from Supabase session)
  - [ ] `loading` state
  - [ ] `signInWithGoogle()` function
  - [ ] `signOut()` function
  - [ ] `useAuth()` hook
- [ ] Set up `onAuthStateChange` listener
- [ ] Handle session persistence

#### 3.4 Login Page
- [ ] Create `src/pages/LoginPage.tsx`
- [ ] Design login UI:
  - [ ] Bialy logo/branding
  - [ ] "Sign in with Google" button
  - [ ] Loading state during OAuth flow
- [ ] Implement Google OAuth flow
- [ ] Handle OAuth callback and errors
- [ ] Add redirect after successful login

#### 3.5 Protected Routes
- [ ] Set up React Router in `src/App.tsx`
- [ ] Create `ProtectedRoute` component
- [ ] Define routes:
  - [ ] `/login` - Public
  - [ ] `/dashboard` - Protected (redirects to login if not authenticated)
- [ ] Implement redirect logic

#### 3.6 User Profile Display
- [ ] Create `src/components/Header.tsx`
- [ ] Display user name and profile picture
- [ ] Add user menu dropdown with:
  - [ ] User email
  - [ ] "Logout" button
- [ ] Style header consistently with app

#### 3.7 Profile Creation on First Login
- [ ] Create database function or trigger to auto-create profile
- [ ] Or implement in frontend: check if profile exists, create if not
- [ ] Store user metadata (email, name, profile_picture_url)

#### 3.8 Testing
- [ ] Test login flow end-to-end
- [ ] Test logout functionality
- [ ] Test session persistence (refresh page)
- [ ] Test protected route access control
- [ ] Test error handling (network failure, OAuth cancellation)

**Deliverable**: Working authentication system with Google OAuth

---

## Phase 4: Dashboard Management

### Goal
Enable users to create, view, switch between, and delete multiple dashboards.

### Tasks

#### 4.1 Dashboard State Management
- [ ] Create `src/hooks/useDashboards.ts`
- [ ] Implement functions:
  - [ ] `fetchDashboards()` - Get all user's dashboards
  - [ ] `createDashboard(name)` - Create new dashboard
  - [ ] `updateDashboard(id, updates)` - Update dashboard
  - [ ] `deleteDashboard(id)` - Delete dashboard
- [ ] Add loading and error states

#### 4.2 Dashboard List UI
- [ ] Create `src/components/DashboardSelector.tsx`
- [ ] Display list of dashboards:
  - [ ] Group: "My Dashboards"
  - [ ] Group: "Shared with Me" (placeholder for Phase 6)
- [ ] Show dashboard name and last modified date
- [ ] Highlight currently active dashboard
- [ ] Add "+ New Dashboard" button

#### 4.3 Create Dashboard Flow
- [ ] Create `src/components/CreateDashboardModal.tsx`
- [ ] Modal UI:
  - [ ] Input field for dashboard name
  - [ ] Cancel and Create buttons
  - [ ] Loading state during creation
- [ ] Implement dashboard creation with Supabase
- [ ] Navigate to new dashboard after creation
- [ ] Show success message

#### 4.4 Dashboard Switching
- [ ] Store active dashboard ID in state/context
- [ ] Create `src/contexts/DashboardContext.tsx`:
  - [ ] `activeDashboard` state
  - [ ] `setActiveDashboard(id)` function
  - [ ] `useDashboard()` hook
- [ ] Update URL when switching dashboards (`/dashboard/:id`)
- [ ] Load dashboard data when switching

#### 4.5 Dashboard Settings
- [ ] Create `src/components/DashboardSettings.tsx`
- [ ] Implement inline editing for dashboard name
- [ ] Add "Delete Dashboard" button
- [ ] Access via gear icon or menu in header

#### 4.6 Delete Dashboard Confirmation
- [ ] Create `src/components/DeleteDashboardModal.tsx`
- [ ] Show confirmation dialog:
  - [ ] Warning message
  - [ ] Dashboard name
  - [ ] Cancel and Delete buttons
- [ ] Implement deletion with cascade (metrics auto-deleted via DB)
- [ ] Redirect to dashboard list after deletion

#### 4.7 Empty States
- [ ] Create empty state for when user has no dashboards
- [ ] Add CTA: "Create your first dashboard"
- [ ] Create empty state for when dashboard has no metrics
- [ ] Add CTA: "Add your first metric"

#### 4.8 Testing
- [ ] Test creating multiple dashboards
- [ ] Test switching between dashboards
- [ ] Test renaming dashboards
- [ ] Test deleting dashboards
- [ ] Test edge cases (no dashboards, single dashboard)
- [ ] Test error handling (network failures, DB errors)

**Deliverable**: Multi-dashboard management system

---

## Phase 5: Data Persistence

### Goal
Migrate from in-memory data to persistent storage in Supabase.

### Tasks

#### 5.1 CSV Upload to Storage
- [ ] Update CSV upload logic to use Supabase Storage
- [ ] Generate unique file path: `{user_id}/{dashboard_id}/{uuid}.csv`
- [ ] Upload file using `supabase.storage.from('csv-files').upload()`
- [ ] Store file path in `metrics` table
- [ ] Add upload progress indicator
- [ ] Handle upload errors

#### 5.2 Metric Metadata Persistence
- [ ] Create `src/hooks/useMetrics.ts`
- [ ] Implement functions:
  - [ ] `createMetric(dashboardId, data)` - Create metric with CSV upload
  - [ ] `fetchMetrics(dashboardId)` - Get all metrics for dashboard
  - [ ] `updateMetric(id, updates)` - Update metric metadata
  - [ ] `deleteMetric(id)` - Delete metric and CSV file
  - [ ] `reorderMetrics(dashboardId, newOrder)` - Update order_index

#### 5.3 Load Metrics from Storage
- [ ] Implement CSV download from Supabase Storage
- [ ] Parse CSV data on load
- [ ] Update existing metric loading logic
- [ ] Add loading states during fetch
- [ ] Cache parsed data in memory for performance

#### 5.4 Configuration Persistence
- [ ] Create `src/hooks/useMetricConfigurations.ts`
- [ ] Implement functions:
  - [ ] `saveConfiguration(metricId, configType, configData)`
  - [ ] `loadConfigurations(metricId)`
  - [ ] `updateConfiguration(configId, updates)`
  - [ ] `deleteConfiguration(configId)`

#### 5.5 Aggregation Settings Persistence
- [ ] Save aggregation config to `metric_configurations` table
- [ ] config_type: 'aggregation'
- [ ] config_data: JSON with aggregation settings
- [ ] Load and apply on metric load

#### 5.6 Shadow Settings Persistence
- [ ] Save shadow config to `metric_configurations` table
- [ ] config_type: 'shadow'
- [ ] config_data: JSON with shadow definitions
- [ ] Load and apply on metric load

#### 5.7 Forecast Settings Persistence
- [ ] Save forecast config to `metric_configurations` table
- [ ] config_type: 'forecast'
- [ ] config_data: JSON with forecast settings
- [ ] Save forecast snapshots in config_data
- [ ] Load and apply on metric load

#### 5.8 Goal Settings Persistence
- [ ] Save goals to `metric_configurations` table
- [ ] config_type: 'goal'
- [ ] config_data: JSON array of goal definitions
- [ ] Load and apply on metric load

#### 5.9 Annotation Persistence
- [ ] Save annotations to `metric_configurations` table
- [ ] config_type: 'annotation'
- [ ] config_data: JSON array of annotations
- [ ] Load and apply on metric load

#### 5.10 Focus Period Persistence
- [ ] Save focus period to `metric_configurations` table
- [ ] config_type: 'focus_period'
- [ ] config_data: JSON with start/end dates
- [ ] Load and apply on metric load

#### 5.11 Auto-save Implementation
- [ ] Implement debounced auto-save (2 second delay)
- [ ] Create `src/hooks/useAutoSave.ts`
- [ ] Save configuration changes automatically
- [ ] Show save status indicator ("Saving...", "Saved", "Error")
- [ ] Handle conflicts and race conditions

#### 5.12 Metric Reordering
- [ ] Update drag-and-drop logic to save new order
- [ ] Update `order_index` in database
- [ ] Optimistic UI update

#### 5.13 File Cleanup
- [ ] Implement CSV file deletion when metric is deleted
- [ ] Use Supabase Storage `remove()` function
- [ ] Handle cleanup errors gracefully

#### 5.14 Testing
- [ ] Test CSV upload and download
- [ ] Test metric CRUD operations
- [ ] Test configuration persistence for all types
- [ ] Test auto-save functionality
- [ ] Test data integrity after page refresh
- [ ] Test concurrent updates (multiple tabs)
- [ ] Test file cleanup on deletion

**Deliverable**: Fully persistent dashboard with all features saving to Supabase

---

## Phase 6: Sharing & Permissions

### Goal
Implement dashboard sharing with private/domain/public permissions.

### Tasks

#### 6.1 Sharing UI
- [ ] Create `src/components/ShareDashboardModal.tsx`
- [ ] Modal UI:
  - [ ] Radio buttons for permission levels (private/domain/public)
  - [ ] Shareable link display (for domain/public)
  - [ ] Copy link button
  - [ ] Save button
- [ ] Add "Share" button to dashboard header

#### 6.2 Permission Level Selection
- [ ] Implement permission level update
- [ ] Call `supabase.from('dashboards').update({ permission_level })`
- [ ] Show success message
- [ ] Update UI immediately (optimistic update)

#### 6.3 Shareable Link Generation
- [ ] Generate shareable link: `https://bialy.app/dashboard/{id}`
- [ ] Show link only when permission is 'domain' or 'public'
- [ ] Implement copy-to-clipboard functionality
- [ ] Show "Copied!" feedback

#### 6.4 Public Dashboard Access
- [ ] Update routing to allow unauthenticated access to public dashboards
- [ ] Check dashboard permission level before requiring auth
- [ ] Show read-only UI for public viewers
- [ ] Hide edit controls (settings, delete, add metrics, etc.)
- [ ] Test access from incognito/logged-out state

#### 6.5 Domain-Shared Dashboard Discovery
- [ ] Implement "Shared with Me" section in dashboard selector
- [ ] Query dashboards with:
  - [ ] `permission_level = 'domain'`
  - [ ] Owner's email domain matches current user's domain
- [ ] Use Supabase RLS policy (already handles filtering)
- [ ] Display shared dashboards with owner info

#### 6.6 Read-Only Mode
- [ ] Create `isReadOnly` computed property in dashboard context
- [ ] Set to true if user is not owner
- [ ] Disable all edit actions in read-only mode:
  - [ ] Hide/disable metric upload
  - [ ] Hide/disable dashboard settings
  - [ ] Hide/disable delete button
  - [ ] Disable configuration changes
- [ ] Show "View Only" badge for shared dashboards

#### 6.7 Permission Indicators
- [ ] Show permission level in dashboard settings
- [ ] Add icon/badge for private/domain/public
- [ ] Show owner name for shared dashboards

#### 6.8 Testing
- [ ] Test changing permission levels
- [ ] Test accessing public dashboard (logged out)
- [ ] Test accessing domain dashboard (same domain, different user)
- [ ] Test domain blocking (different domain user cannot access)
- [ ] Test read-only enforcement
- [ ] Test RLS policies prevent unauthorized edits
- [ ] Test shareable link copy functionality

**Deliverable**: Full sharing functionality with proper access control

---

## Phase 7: Vercel API Routes

### Goal
Create serverless functions for CSV parsing and custom business logic.

### Tasks

#### 7.1 API Route Setup
- [ ] Create `api` directory in project root
- [ ] Configure Vercel to recognize API routes

#### 7.2 CSV Parsing Endpoint
- [ ] Create `api/metrics/parse-csv.ts`
- [ ] Install dependencies: `npm install papaparse formidable`
- [ ] Implement file upload handling (multipart/form-data)
- [ ] Parse CSV with PapaParse
- [ ] Validate CSV format:
  - [ ] Required columns present
  - [ ] Data types correct
  - [ ] No malicious content
- [ ] Return parsed data preview (first 100 rows)
- [ ] Add error handling and validation messages

#### 7.3 Session Verification Middleware
- [ ] Create `api/_middleware.ts` (or per-route)
- [ ] Verify Supabase session from request headers
- [ ] Return 401 if not authenticated
- [ ] Attach user info to request

#### 7.4 File Upload Validation
- [ ] Verify file size < 10MB
- [ ] Verify MIME type is CSV
- [ ] Sanitize filename
- [ ] Implement timeout (10 seconds max)

#### 7.5 Error Handling
- [ ] Consistent error response format
- [ ] Proper HTTP status codes
- [ ] User-friendly error messages
- [ ] Log errors for monitoring

#### 7.6 Testing
- [ ] Test CSV parsing with valid files
- [ ] Test CSV parsing with invalid files
- [ ] Test file size limits
- [ ] Test authentication requirement
- [ ] Test error responses

**Deliverable**: Working API routes for CSV processing

---

## Phase 8: Testing & Optimization

### Goal
Comprehensive testing and performance optimization.

### Tasks

#### 8.1 End-to-End Testing
- [ ] Test complete user journey:
  1. [ ] Sign up with Google
  2. [ ] Create first dashboard
  3. [ ] Upload metric
  4. [ ] Configure metric (aggregation, shadows, goals, forecast)
  5. [ ] Create second dashboard
  6. [ ] Switch between dashboards
  7. [ ] Share dashboard (domain level)
  8. [ ] Access shared dashboard from another account
  9. [ ] Delete dashboard
  10. [ ] Sign out
- [ ] Document any bugs found

#### 8.2 Cross-Browser Testing
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Document browser-specific issues

#### 8.3 Mobile Responsiveness
- [ ] Test on mobile Chrome (iOS/Android)
- [ ] Test on mobile Safari (iOS)
- [ ] Verify touch interactions work
- [ ] Verify charts render correctly
- [ ] Fix any mobile-specific issues

#### 8.4 Performance Optimization
- [ ] Audit with Lighthouse
- [ ] Optimize bundle size:
  - [ ] Code splitting for routes
  - [ ] Lazy load heavy components (charts)
  - [ ] Tree shake unused dependencies
- [ ] Optimize images (if any)
- [ ] Implement React.memo for expensive components
- [ ] Add loading states to prevent layout shift

#### 8.5 Database Query Optimization
- [ ] Review slow queries in Supabase dashboard
- [ ] Add missing indexes if needed
- [ ] Optimize RLS policies if causing slowdowns
- [ ] Use `.select()` to fetch only needed columns
- [ ] Implement pagination for large result sets

#### 8.6 Error Handling Review
- [ ] Ensure all API calls have try/catch
- [ ] Ensure all errors show user-friendly messages
- [ ] Test network failure scenarios
- [ ] Test database errors
- [ ] Test file upload failures

#### 8.7 Security Review
- [ ] Verify all RLS policies work correctly
- [ ] Test unauthorized access attempts
- [ ] Verify sensitive data not exposed in client
- [ ] Check for XSS vulnerabilities
- [ ] Review environment variable handling
- [ ] Test SQL injection resistance (Supabase handles this)

#### 8.8 Load Testing
- [ ] Use tool like Artillery or k6
- [ ] Simulate 100 concurrent users
- [ ] Monitor Supabase metrics
- [ ] Monitor Vercel metrics
- [ ] Identify bottlenecks

#### 8.9 Bug Fixes
- [ ] Create GitHub issues for all bugs found
- [ ] Prioritize critical bugs
- [ ] Fix all critical and high-priority bugs
- [ ] Retest after fixes

**Deliverable**: Tested, optimized, production-ready application

---

## Phase 9: Production Launch

### Goal
Deploy to production and monitor initial usage.

### Tasks

#### 9.1 Pre-Launch Checklist
- [ ] All critical bugs fixed
- [ ] All features working as expected
- [ ] Performance benchmarks met
- [ ] Security review complete
- [ ] Backups configured in Supabase
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active

#### 9.2 Monitoring Setup
- [ ] Set up Sentry for error tracking
  - [ ] Create Sentry account
  - [ ] Install Sentry SDK: `npm install @sentry/react`
  - [ ] Configure Sentry in app
  - [ ] Test error reporting
- [ ] Set up Vercel Analytics
  - [ ] Enable in Vercel dashboard
  - [ ] Verify data collection
- [ ] Set up Supabase monitoring
  - [ ] Configure alerts for high DB usage
  - [ ] Configure alerts for storage limits

#### 9.3 Analytics Setup (Optional)
- [ ] Choose analytics tool (Plausible, Google Analytics, etc.)
- [ ] Install and configure
- [ ] Set up event tracking for key actions:
  - [ ] User signup
  - [ ] Dashboard creation
  - [ ] Metric upload
  - [ ] Dashboard sharing

#### 9.4 Documentation
- [ ] Create user guide (how to use Bialy)
- [ ] Document dashboard features
- [ ] Create FAQ
- [ ] Add help/support contact info

#### 9.5 Production Deployment
- [ ] Merge all changes to main branch
- [ ] Verify production build succeeds
- [ ] Verify production deployment
- [ ] Smoke test production:
  - [ ] Sign up
  - [ ] Create dashboard
  - [ ] Upload metric
  - [ ] Share dashboard
  - [ ] Sign out

#### 9.6 Launch Communications
- [ ] Announce launch (blog post, social media, etc.)
- [ ] Invite beta users
- [ ] Collect initial feedback

#### 9.7 Monitoring & Support
- [ ] Monitor Sentry for errors
- [ ] Monitor Vercel for performance issues
- [ ] Monitor Supabase for database issues
- [ ] Respond to user feedback
- [ ] Create GitHub issues for reported bugs
- [ ] Plan next iteration

#### 9.8 Post-Launch Review
- [ ] Review success metrics (signups, dashboard creation, etc.)
- [ ] Review performance metrics
- [ ] Review error rates
- [ ] Identify areas for improvement
- [ ] Plan Phase 2 features

**Deliverable**: Live, production-ready application with monitoring

---

## Success Criteria

### Technical Metrics
- [ ] Dashboard list loads in < 500ms
- [ ] Dashboard with data loads in < 2 seconds
- [ ] CSV upload processes in < 5 seconds (10MB file)
- [ ] Error rate < 1%
- [ ] Uptime > 99.9%

### User Metrics
- [ ] User registration success rate > 95%
- [ ] Dashboard creation success rate > 98%
- [ ] 30-day retention > 40%
- [ ] Average dashboards per user > 2

### Feature Completeness
- [ ] All PRD features implemented
- [ ] All critical bugs fixed
- [ ] Security review passed
- [ ] Performance benchmarks met

---

## Risk Mitigation

### High Risk Items
1. **RLS Policy Bugs**: Could expose private data
   - Mitigation: Extensive testing with multiple users/scenarios

2. **Google OAuth Issues**: Could block user signups
   - Mitigation: Test thoroughly, have fallback support contact

3. **CSV Upload Failures**: Core feature, can't be broken
   - Mitigation: Comprehensive error handling, file validation

4. **Performance with Large Datasets**: Charts may be slow
   - Mitigation: Implement data sampling, lazy loading

### Medium Risk Items
1. **Browser Compatibility**: Features may not work on older browsers
   - Mitigation: Test on all major browsers, set minimum version requirements

2. **Mobile Experience**: Charts may not render well on small screens
   - Mitigation: Responsive design testing, consider mobile-specific views

---

## Dependencies

### External Services
- Supabase account (free tier sufficient for MVP)
- Vercel account (free tier sufficient for MVP)
- Google Cloud Console (free OAuth setup)
- GitHub account (for deployments)

### Optional Services
- Sentry (error monitoring) - Free tier available
- Domain registrar (if custom domain desired)
- Analytics service (if tracking needed)

---

## Notes

- Phases should be completed sequentially due to dependencies
- Regular testing throughout prevents major issues at end
- User feedback should be incorporated continuously

---

## Next Steps

1. Review and approve this execution plan
2. Set up development environment
3. Create GitHub project board with tasks
4. Begin Phase 1: Supabase Backend Setup
