# PRD: Web-Hosted Production Application

## Overview

This document outlines the requirements for converting Bialy from a local preview application to a web-hosted, production-ready SaaS application with multi-user support, authentication, data persistence, and sharing capabilities.

## Goals and Objectives

1. Enable users to access Bialy from any web browser without local setup
2. Provide secure user authentication via Google OAuth
3. Allow users to create, manage, and persist multiple dashboards
4. Enable dashboard sharing with granular access control
5. Ensure data security and privacy with proper access management

## User Stories

### Authentication & Account Management
- As a new user, I want to sign up using my Google account so I can quickly get started
- As a returning user, I want to log in with my Google account so I can access my saved dashboards
- As a user, I want to log out to secure my account when I'm done

### Dashboard Management
- As a user, I want to create a new dashboard so I can organize different sets of metrics
- As a user, I want to name and rename my dashboards for easy identification
- As a user, I want to view a list of all my dashboards so I can navigate between them
- As a user, I want to delete dashboards I no longer need
- As a user, I want my dashboard configurations (metrics, settings, goals, annotations) to be saved automatically

### Metric Management
- As a user, I want to add metrics to my dashboard by uploading CSV files
- As a user, I want to configure metric settings (aggregation, shadows, forecasts, goals, annotations)
- As a user, I want to remove metrics from my dashboard
- As a user, I want to reorder metrics within my dashboard

### Sharing & Collaboration
- As a dashboard owner, I want to keep my dashboard private (only I can see it)
- As a dashboard owner, I want to share my dashboard with anyone in my organization (domain-level sharing)
- As a dashboard owner, I want to share my dashboard publicly with anyone who has the link
- As a dashboard viewer, I want to view dashboards shared with me
- As a dashboard owner, I want to change sharing permissions at any time

## Functional Requirements

### 1. Authentication System

**FR-1.1: Google OAuth Integration**
- Support Google OAuth 2.0 for user authentication
- Request minimal scopes (email, profile)
- Handle OAuth flow (redirect, callback, token exchange)

**FR-1.2: Session Management**
- Maintain user sessions with secure HTTP-only cookies
- Implement session timeout (e.g., 30 days with activity refresh)
- Support logout functionality

**FR-1.3: User Profile**
- Store user information: email, name, profile picture
- Auto-create user account on first login
- Display user info in application header

### 2. Dashboard Management

**FR-2.1: Dashboard CRUD Operations**
- Create: Initialize new dashboard with default settings
- Read: Load dashboard configuration and all associated data
- Update: Save dashboard name, metric configurations, and settings
- Delete: Remove dashboard and all associated data (with confirmation)

**FR-2.2: Dashboard Navigation**
- Display list of user's dashboards in a sidebar or dropdown
- Show dashboard name and last modified date
- Support quick switching between dashboards
- Highlight currently active dashboard

**FR-2.3: Dashboard Metadata**
- Track dashboard owner (creator)
- Track creation timestamp
- Track last modified timestamp
- Store dashboard name (max 100 characters)

### 3. Data Persistence

**FR-3.1: Metric Data Storage**
- Store uploaded CSV data for each metric
- Preserve data type and format from original CSV
- Associate metric data with specific dashboard
- Support metric metadata (name, unit, dimensions)

**FR-3.2: Configuration Storage**
- Save aggregation settings per metric
- Save shadow configurations
- Save forecast configurations
- Save goal definitions
- Save annotation data
- Save focus period settings
- Save metric grouping and ordering

**FR-3.3: Auto-save**
- Automatically save configuration changes
- Debounce rapid changes (e.g., 2-second delay)
- Provide visual feedback for save status

### 4. Access Control & Sharing

**FR-4.1: Permission Levels**
- **Private**: Only dashboard owner can view and edit
- **Domain**: Anyone with email address in same domain can view (read-only)
- **Public**: Anyone with link can view (read-only)
- Owner always retains edit permissions

**FR-4.2: Sharing Interface**
- Display current permission level in dashboard settings
- Provide dropdown to change permission level
- Show shareable link for domain/public dashboards
- Include "Copy link" functionality

**FR-4.3: Access Enforcement**
- Verify user authentication for all dashboard access
- Check ownership for edit operations
- Check domain match for domain-level sharing
- Allow anonymous access for public dashboards (view-only)
- Return 403 Forbidden for unauthorized access attempts

**FR-4.4: Dashboard Discovery**
- Show "My Dashboards" (owned by user)
- Show "Shared with Me" (domain-level dashboards from same organization)
- Do not list public dashboards (access via link only)

## Technical Requirements

### Architecture (Vercel + Supabase Stack)

**TA-1: Frontend (Vercel)**
- Maintain current React/TypeScript/Vite application
- Add React Router for multi-dashboard navigation
- Add Supabase client (`@supabase/supabase-js`) for authentication and data
- Deploy to Vercel with automatic Git deployments
- Environment variables for Supabase URL and anon key

**TA-2: Backend (Supabase)**
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth with Google OAuth provider
- **Storage**: Supabase Storage for CSV file uploads
- **API**: Supabase auto-generated REST API + Vercel API Routes for custom logic
- **Real-time** (optional): Supabase real-time subscriptions for collaborative features

**TA-3: Database Schema (Supabase PostgreSQL)**

```sql
-- Supabase automatically creates auth.users table for authenticated users
-- We'll reference auth.users via user_id (UUID)

-- Profiles Table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dashboards Table
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  permission_level TEXT CHECK (permission_level IN ('private', 'domain', 'public')) DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Metrics Table
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  data_file_path TEXT NOT NULL, -- Reference to Supabase Storage
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Metric Configurations Table
CREATE TABLE metric_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES metrics ON DELETE CASCADE NOT NULL,
  config_type TEXT CHECK (config_type IN ('aggregation', 'shadow', 'forecast', 'goal', 'annotation', 'focus_period')) NOT NULL,
  config_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dashboards_owner ON dashboards(owner_id);
CREATE INDEX idx_metrics_dashboard ON metrics(dashboard_id);
CREATE INDEX idx_metric_configs_metric ON metric_configurations(metric_id);
```

**Row Level Security (RLS) Policies:**

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_configurations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Dashboards: Complex policies for private/domain/public access
CREATE POLICY "Users can view their own dashboards"
  ON dashboards FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view domain-shared dashboards"
  ON dashboards FOR SELECT USING (
    permission_level = 'domain' AND
    SPLIT_PART(auth.email(), '@', 2) = SPLIT_PART((SELECT email FROM profiles WHERE id = owner_id), '@', 2)
  );

CREATE POLICY "Anyone can view public dashboards"
  ON dashboards FOR SELECT USING (permission_level = 'public');

CREATE POLICY "Users can insert their own dashboards"
  ON dashboards FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own dashboards"
  ON dashboards FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own dashboards"
  ON dashboards FOR DELETE USING (owner_id = auth.uid());

-- Metrics: Inherit access from dashboard
CREATE POLICY "Users can view metrics from accessible dashboards"
  ON metrics FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = metrics.dashboard_id
    )
  );

CREATE POLICY "Users can manage metrics in their own dashboards"
  ON metrics FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = metrics.dashboard_id
      AND dashboards.owner_id = auth.uid()
    )
  );

-- Metric Configurations: Inherit access from metric/dashboard
CREATE POLICY "Users can view configs from accessible metrics"
  ON metric_configurations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM metrics m
      JOIN dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
    )
  );

CREATE POLICY "Users can manage configs in their own dashboards"
  ON metric_configurations FOR ALL USING (
    EXISTS (
      SELECT 1 FROM metrics m
      JOIN dashboards d ON d.id = m.dashboard_id
      WHERE m.id = metric_configurations.metric_id
      AND d.owner_id = auth.uid()
    )
  );
```

**TA-4: API Architecture (Supabase + Vercel)**

Supabase provides auto-generated REST APIs for all database tables. The frontend will primarily use the Supabase JavaScript client for data operations. Vercel API Routes will handle custom business logic not covered by Supabase.

**Supabase Client Operations (Frontend):**

```typescript
// Authentication (via Supabase Auth)
supabase.auth.signInWithOAuth({ provider: 'google' })
supabase.auth.signOut()
supabase.auth.getSession()
supabase.auth.onAuthStateChange((event, session) => {...})

// Dashboards (via Supabase Database API with RLS)
supabase.from('dashboards').select('*')
supabase.from('dashboards').select('*, metrics(*)').eq('owner_id', userId)
supabase.from('dashboards').insert({ name, owner_id, permission_level })
supabase.from('dashboards').update({ name }).eq('id', dashboardId)
supabase.from('dashboards').delete().eq('id', dashboardId)

// Metrics (via Supabase Database API with RLS)
supabase.from('metrics').select('*').eq('dashboard_id', dashboardId)
supabase.from('metrics').insert({ dashboard_id, name, unit, data_file_path, order_index })
supabase.from('metrics').update({ name, unit }).eq('id', metricId)
supabase.from('metrics').delete().eq('id', metricId)

// Configurations (via Supabase Database API with RLS)
supabase.from('metric_configurations').select('*').eq('metric_id', metricId)
supabase.from('metric_configurations').insert({ metric_id, config_type, config_data })
supabase.from('metric_configurations').update({ config_data }).eq('id', configId)
supabase.from('metric_configurations').delete().eq('id', configId)

// File Storage (via Supabase Storage)
supabase.storage.from('csv-files').upload(filePath, file)
supabase.storage.from('csv-files').download(filePath)
supabase.storage.from('csv-files').remove([filePath])
```

**Vercel API Routes (Custom Business Logic):**

```
POST /api/metrics/parse-csv
  - Validate uploaded CSV file
  - Parse and extract metric data
  - Return structured data for preview
  - Input: multipart/form-data with CSV file
  - Output: { columns: [], rows: [], preview: [] }

GET /api/dashboards/:id/shared-users
  - List users who have access to a dashboard (domain sharing)
  - Extract domain from dashboard owner
  - Return list of users with matching domain
  - Input: dashboard_id
  - Output: { users: [] }

POST /api/export/dashboard/:id
  - Export dashboard configuration and data
  - Generate downloadable JSON or CSV
  - Input: dashboard_id, format (json|csv)
  - Output: File download
```

**Storage Bucket Configuration:**

```
Bucket: csv-files
- Public: false (private)
- File size limit: 10MB
- Allowed MIME types: text/csv, application/csv
- RLS Policies:
  - Users can upload to their own folders (user_id/*)
  - Users can read files from dashboards they have access to
```

**TA-5: File Storage (Supabase Storage)**
- Store uploaded CSV files in Supabase Storage bucket (`csv-files`)
- File path structure: `{user_id}/{dashboard_id}/{metric_id}.csv`
- Generate unique filenames using UUID to prevent collisions
- Associate files with metric records via `data_file_path` column
- Implement file cleanup on metric/dashboard deletion using database triggers
- Row Level Security policies ensure users can only access files from dashboards they have permission to view

**Example Storage RLS Policy:**
```sql
-- Users can insert files to their own user folder
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'csv-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read files from dashboards they have access to
CREATE POLICY "Users can read files from accessible dashboards"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'csv-files' AND
    EXISTS (
      SELECT 1 FROM metrics m
      JOIN dashboards d ON d.id = m.dashboard_id
      WHERE m.data_file_path = storage.objects.name
    )
  );
```

**TA-6: Hosting & Deployment (Vercel + Supabase)**
- **Frontend**: Vercel (automatic deployments from GitHub)
  - Build command: `npm run build`
  - Output directory: `dist`
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Automatic HTTPS and CDN distribution
  - Preview deployments for pull requests

- **Backend**: Supabase (fully managed)
  - PostgreSQL database (auto-scaling)
  - Authentication service (Google OAuth configured)
  - Storage service (CSV files)
  - Edge Functions (if needed for server-side logic)
  - Real-time subscriptions (optional)

- **Custom API**: Vercel Serverless Functions
  - Location: `/api/*` routes in Vercel project
  - Runtime: Node.js 18+
  - Used for CSV parsing, exports, and custom business logic

- **Domain & DNS**: Vercel DNS
  - Custom domain: `bialy.app` (or similar)
  - Automatic SSL certificate provisioning
  - Redirects and rewrites configured in `vercel.json`

### Security Requirements (Supabase Built-in + Custom)

**SR-1: Authentication Security (Supabase Auth)**
- HTTPS enforced by default on both Vercel and Supabase
- OAuth tokens managed securely by Supabase Auth
- Automatic session management with refresh tokens
- JWT-based authentication with configurable expiration
- Built-in CSRF protection via Supabase client

**SR-2: Authorization Security (Row Level Security)**
- All authorization enforced at database level via RLS policies
- RLS policies automatically validate user permissions on every query
- Supabase uses parameterized queries (SQL injection protection built-in)
- Validate all user inputs in frontend and Vercel API routes
- Supabase provides built-in rate limiting on Auth endpoints
- Additional rate limiting via Vercel middleware for custom API routes

**SR-3: Data Privacy (Supabase + Vercel)**
- All data encrypted in transit via TLS 1.3
- All data encrypted at rest in Supabase PostgreSQL
- Database access restricted to Supabase API (no direct DB connections)
- Environment variables stored securely in Vercel
- Supabase anon key is safe to expose (RLS policies enforce access control)
- Regular security audits via Supabase's SOC 2 compliance

**SR-4: Domain Verification (Custom Logic)**
- Extract domain from user's email via `SPLIT_PART(email, '@', 2)` in RLS policies
- Domain comparison implemented in PostgreSQL for performance
- Handle edge cases: subdomains, multiple domain formats
- Support for common enterprise email patterns (e.g., gmail.com, outlook.com filtered out from domain sharing)

**SR-5: API Security (Vercel Serverless Functions)**
- Verify Supabase session in all custom API routes
- Validate file uploads (CSV only, 10MB max)
- Sanitize file names to prevent path traversal
- Implement request timeouts (10 seconds max)
- Log security events for monitoring

### Performance Requirements

**PR-1: Load Times**
- Dashboard list: < 500ms
- Dashboard load (with data): < 2 seconds
- CSV upload and processing: < 5 seconds for files up to 10MB

**PR-2: Scalability**
- Support 1000+ concurrent users
- Support dashboards with 50+ metrics
- Support metrics with 10,000+ data points

**PR-3: Availability**
- 99.9% uptime SLA
- Automated health checks
- Error monitoring and alerting

## User Interface Requirements

### UI-1: Navigation Structure

```
Header:
- Bialy logo
- Dashboard selector dropdown
- User profile menu (name, picture, logout)

Sidebar (or Dropdown):
- My Dashboards section
  - List of owned dashboards
  - "+ New Dashboard" button
- Shared with Me section
  - List of shared dashboards (domain-level)

Dashboard View:
- Dashboard name (editable inline)
- Share button (opens sharing modal)
- Delete dashboard button
- Current dashboard content (metrics grid)
```

### UI-2: Dashboard Selector

- Dropdown or sidebar showing all accessible dashboards
- Search/filter capability (if user has many dashboards)
- Group by: "My Dashboards" and "Shared with Me"
- Indicate current dashboard
- Quick actions: Rename, Delete, Share

### UI-3: Sharing Modal

```
Share Dashboard: [Dashboard Name]

Access Level:
( ) Private - Only you can access
( ) Domain - Anyone at [user-domain.com] can view
( ) Public - Anyone with the link can view

[if Domain or Public]
Shareable link: [https://bialy.app/d/abc123xyz] [Copy Link button]

[Cancel] [Save]
```

### UI-4: New Dashboard Flow

1. User clicks "+ New Dashboard"
2. Modal appears: "Create New Dashboard"
   - Dashboard Name: [text input]
   - [Cancel] [Create]
3. On create, navigate to new empty dashboard
4. Show empty state: "Add your first metric by uploading a CSV file"

### UI-5: Delete Dashboard Confirmation

```
Delete Dashboard?

Are you sure you want to delete "[Dashboard Name]"?
This will permanently delete all metrics and data in this dashboard.

[Cancel] [Delete Dashboard]
```

## Cloud Hosting Provider Selection

### Overview

Choosing the right cloud provider is critical for cost, performance, developer experience, and scalability. This section evaluates major cloud providers for hosting Bialy.

### Provider Options

#### Option 1: AWS (Amazon Web Services)

**Pros:**
- Most mature and feature-rich cloud platform
- Excellent documentation and community support
- Wide range of services for future expansion
- Strong security and compliance certifications
- Best-in-class CDN (CloudFront)

**Cons:**
- Steeper learning curve for beginners
- More complex pricing model
- Can be more expensive for small-scale applications
- Requires more configuration and setup

**Services for Bialy:**
- Frontend: S3 + CloudFront or Amplify Hosting
- Backend: ECS (Fargate) or Lambda (serverless)
- Database: RDS (PostgreSQL or MySQL)
- File Storage: S3
- Authentication: Cognito (or custom implementation)

**Estimated Monthly Cost (low traffic):** $50-150

---

#### Option 2: Google Cloud Platform (GCP)

**Pros:**
- Native Google OAuth integration
- Excellent for data analytics (if future features needed)
- Competitive pricing with sustained use discounts
- Strong Kubernetes support (GKE)
- Good developer experience

**Cons:**
- Smaller community compared to AWS
- Fewer third-party integrations
- Some services less mature than AWS equivalents
- Documentation can be inconsistent

**Services for Bialy:**
- Frontend: Cloud Storage + Cloud CDN or Firebase Hosting
- Backend: Cloud Run or App Engine
- Database: Cloud SQL (PostgreSQL)
- File Storage: Cloud Storage
- Authentication: Firebase Auth (Google OAuth built-in)

**Estimated Monthly Cost (low traffic):** $40-120

---

#### Option 3: Vercel + Supabase (Jamstack Approach)

**Pros:**
- Best developer experience for React applications
- Automatic deployments from Git
- Excellent performance and global CDN
- Generous free tier
- Minimal DevOps required
- Supabase provides database + auth + storage in one platform

**Cons:**
- Less control over infrastructure
- Vendor lock-in
- Limited backend customization (unless using Vercel Serverless Functions)
- May need to migrate if requirements become complex

**Services for Bialy:**
- Frontend: Vercel
- Backend: Vercel Serverless Functions (API routes)
- Database: Supabase (PostgreSQL)
- File Storage: Supabase Storage
- Authentication: Supabase Auth (supports Google OAuth)

**Estimated Monthly Cost (low traffic):** $0-50 (starts free)

---

#### Option 4: Railway or Render (Platform-as-a-Service)

**Pros:**
- Extremely simple deployment (Git push to deploy)
- Great for monolithic applications
- Affordable pricing
- Built-in database provisioning
- Good developer experience

**Cons:**
- Less control over infrastructure
- Fewer advanced features than major clouds
- Smaller scale capabilities
- Less mature than AWS/GCP

**Services for Bialy:**
- Frontend: Static site deployment
- Backend: Docker container or Node.js service
- Database: Built-in PostgreSQL
- File Storage: Cloudinary or external S3
- Authentication: Custom implementation with Passport.js

**Estimated Monthly Cost (low traffic):** $20-60

---

### Recommendation

**For MVP/Early Stage: Vercel + Supabase**

This is the recommended approach for getting Bialy to production quickly:

**Why:**
1. **Fastest time to market** - Deploy in days, not weeks
2. **Lowest cost** - Free tier covers early usage, scales affordably
3. **Best DX** - Minimal configuration, automatic deployments
4. **Google OAuth ready** - Supabase Auth has built-in Google provider
5. **All-in-one backend** - Database, auth, storage, and API in Supabase
6. **Easy migration** - If needed, can migrate to AWS/GCP later (PostgreSQL is portable)

**Implementation Stack:**
```
Frontend:
- Vercel (React/Vite deployment)
- Automatic HTTPS, CDN, and deployments

Backend:
- Supabase (PostgreSQL database)
- Supabase Auth (Google OAuth)
- Supabase Storage (CSV files)
- Supabase Edge Functions or Vercel API Routes (business logic)

Domain:
- Custom domain via Vercel DNS
```

**Migration Path if Scaling:**
- If traffic grows significantly (100k+ users), migrate to AWS or GCP
- Supabase database can be exported to RDS/Cloud SQL
- Frontend stays on Vercel or moves to CloudFront/Cloud CDN
- Backend logic moves to containerized services

---

### Alternative: AWS for Enterprise/Scale

**Choose AWS if:**
- You need SOC2/HIPAA compliance from day one
- You expect rapid growth (10k+ users in first 6 months)
- You have existing AWS infrastructure
- You need advanced features (VPC, custom networking, etc.)
- You have DevOps expertise in-house

**Implementation Stack:**
```
Frontend:
- S3 + CloudFront (or Amplify Hosting)

Backend:
- ECS Fargate (containerized Node.js/Python API)
- Application Load Balancer
- RDS PostgreSQL (Multi-AZ for production)
- S3 for CSV file storage
- Cognito for authentication (Google OAuth federated)

Infrastructure as Code:
- Terraform or AWS CDK for reproducible deployments
```

---

### Decision Matrix

| Criteria | Vercel + Supabase | AWS | GCP | Railway |
|----------|-------------------|-----|-----|---------|
| Time to Market | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Developer Experience | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost (Early Stage) | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Scalability | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Feature Set | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Google OAuth Setup | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Vendor Lock-in Risk | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Community Support | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

### Implementation Guide (Vercel + Supabase)

#### Step 1: Supabase Setup (30 minutes)

1. Create account at supabase.com
2. Create new project
3. Set up database schema (Users, Dashboards, Metrics tables)
4. Enable Google OAuth in Authentication settings
5. Configure Storage bucket for CSV files
6. Note API URL and anon key

#### Step 2: Vercel Setup (15 minutes)

1. Create account at vercel.com
2. Connect GitHub repository
3. Configure build settings (Vite build)
4. Add environment variables (Supabase URL, anon key)
5. Deploy

#### Step 3: Google OAuth Setup (30 minutes)

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://[project].supabase.co/auth/v1/callback`
4. Add Client ID and Secret to Supabase
5. Test login flow

#### Step 4: Frontend Integration (1-2 weeks)

1. Install Supabase client: `npm install @supabase/supabase-js`
2. Implement authentication hooks
3. Implement dashboard API calls
4. Implement file upload to Supabase Storage
5. Test end-to-end flows

**Total Setup Time: ~2-3 hours for infrastructure, 1-2 weeks for code integration**

---

## Migration Considerations

### Current State
- Single-dashboard local application
- All data in browser memory (no persistence)
- No user accounts or authentication

### Migration Path (Vercel + Supabase Implementation)

**Phase 1: Supabase Backend Setup (Week 1)**
1. Create Supabase project
2. Set up database schema (tables, RLS policies, indexes)
3. Configure Google OAuth in Supabase Auth
4. Create Storage bucket for CSV files with RLS policies
5. Test database operations and auth flow in Supabase dashboard
6. Document API keys and configuration

**Phase 2: Vercel Deployment Setup (Week 1)**
1. Create Vercel account and connect GitHub repository
2. Configure build settings (Vite build command, dist output)
3. Add environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
4. Set up custom domain (if applicable)
5. Configure preview deployments for testing
6. Deploy initial version to verify setup

**Phase 3: Frontend Authentication (Week 2-3)**
1. Install dependencies: `npm install @supabase/supabase-js react-router-dom`
2. Create Supabase client singleton
3. Implement authentication context/provider
4. Build login page with Google OAuth button
5. Add auth state management and protected routes
6. Implement logout functionality
7. Add user profile display in header
8. Test auth flow end-to-end

**Phase 4: Dashboard Management (Week 4-5)**
1. Implement dashboard CRUD operations with Supabase client
2. Build dashboard list/selector UI (sidebar or dropdown)
3. Add "Create Dashboard" flow and modal
4. Add dashboard rename functionality
5. Add dashboard delete with confirmation
6. Implement dashboard switching/navigation
7. Add loading states and error handling
8. Test with multiple dashboards

**Phase 5: Data Persistence (Week 6-7)**
1. Migrate metric data loading to Supabase Storage
2. Implement CSV upload to Supabase Storage
3. Save metric metadata to database
4. Implement configuration persistence (aggregation, shadows, goals, etc.)
5. Add auto-save functionality with debouncing
6. Implement metric reordering and save to database
7. Add save status indicators
8. Test data integrity and persistence

**Phase 6: Sharing & Permissions (Week 8)**
1. Implement sharing modal UI
2. Add permission level selector (private/domain/public)
3. Create shareable link generation
4. Test RLS policies for all permission levels
5. Implement "Shared with Me" dashboard discovery
6. Add public dashboard access (no auth required)
7. Test domain-based sharing with different email domains

**Phase 7: Vercel API Routes (Week 8)**
1. Create `/api/metrics/parse-csv` for CSV validation and parsing
2. Add file upload handling and validation
3. Implement error handling and file size limits
4. Test CSV upload and parsing flow
5. Add optional export functionality (if needed)

**Phase 8: Testing & Optimization (Week 9-10)**
1. End-to-end testing of all user flows
2. Performance optimization (query optimization, caching)
3. Security review (RLS policies, input validation)
4. Browser compatibility testing
5. Mobile responsiveness testing
6. Load testing with multiple concurrent users
7. Fix bugs and edge cases

**Phase 9: Production Launch (Week 11)**
1. Final security audit
2. Set up error monitoring (Sentry or similar)
3. Configure analytics (if applicable)
4. Production deployment
5. Monitor for issues
6. Gather user feedback
7. Create user documentation/guide

## Open Questions & Future Considerations

1. **Collaboration**: Should multiple users be able to edit the same dashboard? (Future: Role-based permissions)
2. **Version History**: Should we track dashboard versions for rollback? (Future feature)
3. **Export**: Should users be able to export dashboards or data? (Future feature)
4. **Templates**: Should we provide dashboard templates for common use cases? (Future feature)
5. **API Access**: Should we provide programmatic API access for advanced users? (Future feature)
6. **Embedded Dashboards**: Should public dashboards support iframe embedding? (Future consideration)
7. **Usage Limits**: Should we implement limits on dashboards/metrics per user? (Depends on pricing model)
8. **Billing**: Will this be a paid service? What pricing model? (Business decision required)

## Success Metrics

- User registration and login success rate > 95%
- Dashboard creation success rate > 98%
- Dashboard load time p95 < 2 seconds
- API error rate < 1%
- User retention (30-day) > 40%
- Average dashboards per active user > 2

## Timeline Estimate (Vercel + Supabase)

- **Phase 1**: Supabase Backend Setup (1 week)
- **Phase 2**: Vercel Deployment Setup (1 week, parallel with Phase 1)
- **Phase 3**: Frontend Authentication (2 weeks)
- **Phase 4**: Dashboard Management (2 weeks)
- **Phase 5**: Data Persistence (2 weeks)
- **Phase 6**: Sharing & Permissions (1 week)
- **Phase 7**: Vercel API Routes (1 week, parallel with Phase 6)
- **Phase 8**: Testing & Optimization (2 weeks)
- **Phase 9**: Production Launch (1 week)
- **Total**: ~11 weeks (with some parallel work, potentially 9-10 weeks)

**Note**: This timeline assumes one full-time developer. With multiple developers working in parallel, timeline could be reduced to 6-8 weeks.

## Priority: High

This transformation is critical for making Bialy accessible to a broader audience and enabling real-world usage beyond local development.
