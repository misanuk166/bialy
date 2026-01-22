# Bialy

**A time series data visualization and analysis tool for business executives who need to understand trends without code.**

[![Production Status](https://img.shields.io/badge/status-live-success)](https://bialy.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)]()

**🚀 Live Application**: [https://bialy.vercel.app](https://bialy.vercel.app)

---

## What is Bialy?

Bialy is a web-based tool that makes it easy to:
- Upload CSV data and visualize time series trends
- Smooth noisy data to see patterns
- Compare time periods (this year vs last year)
- Set goals and track progress
- Generate forecasts with confidence intervals
- Share dashboards with your team or publicly

**No coding required. Just upload your data and explore.**

---

## Recent Updates (January 2026)

### New Features
- ✨ **Resizable Row Heights** - Drag the gray separator between rows to resize chart heights (40px-320px)
- ✨ **Shadow Line Customization** - Configure shadow line colors and styles (solid/dashed/dotted/dash-dot) with automatic fading for older shadows
- ✨ **Improved Date Pickers** - Migrated to react-datepicker for better date input handling
- ✨ **Adaptive UI** - Table values automatically scale font size at compact heights (<60px)
- ✨ **Per-Row Expansion** - Lock individual rows at full height (320px) while keeping others compact

### Bug Fixes & Improvements
- ✅ **Multi-CSV Upload** - Fixed issue where only first CSV saved when uploading multiple metrics
- ✅ **Metric Name Persistence** - Database names now override CSV filenames (user edits preserved)
- ✅ **Date Range Persistence** - Date range selections now save correctly across page refreshes
- ✅ **Dashboard Settings** - Added configurable decimal places, series line colors, and shadow styles
- ✅ **Shadow Day-of-Week Alignment** - Shadows can align by weekday (up to 3 days shift)
- ✅ **Date Input Reliability** - Fixed timezone issues causing date auto-correction

### Technical Improvements
- Improved filename parsing to remove timestamps from metric names
- Fixed filePath parameter passing in Add Metric modal
- Removed date range from preferences (now part of dashboard state)
- Enhanced error logging for troubleshooting
- Optimized forecast confidence interval rendering based on chart height

## Features

### Core Capabilities
- **CSV Upload** - Drag and drop your data files
- **Interactive Charts** - Zoom, pan, and explore with D3.js
- **Smoothing** - Moving average to reduce noise
- **Shadows** - Compare current data to past periods (with day-of-week alignment)
- **Goals** - Set continuous or end-of-period targets
- **Forecasting** - Linear regression with confidence intervals
- **Focus Periods** - Analyze specific date ranges with statistics

### Dashboard Management
- **Multi-Dashboard** - Organize metrics by project or team
- **Multi-Metric** - View multiple charts in a synchronized grid
- **Drag & Drop** - Reorder metrics easily
- **Shared X-Axis** - Synchronize time across all charts
- **Dashboard Settings** - Customize decimal places and chart colors per dashboard

### Collaboration
- **Private** - Keep dashboards to yourself
- **Domain Sharing** - Share with anyone at your company
- **Public Sharing** - Create public reports with read-only links
- **Secure** - Row-level security ensures data isolation

---

## Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **TailwindCSS** - Utility-first styling
- **D3.js** - Powerful data visualization
- **React Router** - Client-side routing

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Google OAuth authentication
  - File storage
  - Row-level security (RLS)

### Deployment
- **Vercel** - Edge hosting with automatic deployments
- **GitHub** - Source control

---

## Quick Start

### For Users

1. **Visit**: https://bialy.vercel.app
2. **Sign in** with your Google account
3. **Create** a dashboard
4. **Upload** your CSV file (format: date, numerator, denominator)
5. **Explore** your data with charts and analytics

See **[User Guide](docs/USER_GUIDE.md)** for detailed instructions.

### For Developers

#### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Vercel account (free tier)

#### Local Development

```bash
# Clone the repository
git clone https://github.com/misanuk166/bialy.git
cd bialy

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase URL and anon key to .env.local

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

#### Environment Variables

Create `.env.local` with:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Database Setup

Run the RLS policies:

```bash
# Copy SQL from sql/create_rls_policies.sql
# Run in Supabase SQL Editor
```

See **[RLS Policy Verification](docs/RLS_POLICY_VERIFICATION.md)** for details.

---

## Documentation

### User Documentation
- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for end users

### Production & Launch
- **[Production Ready Status](docs/PRODUCTION_READY_STATUS.md)** - Current deployment state
- **[Launch Checklist](docs/LAUNCH_CHECKLIST.md)** - Deployment process

### Development
- **[Execution Plan](docs/EXECUTION_PLAN.md)** - 9-phase development roadmap
- **[Phase 8 Testing Report](docs/PHASE_8_TESTING_REPORT.md)** - Testing results

### Security
- **[RLS Policy Verification](docs/RLS_POLICY_VERIFICATION.md)** - Security setup
- **[RLS Verification Results](docs/RLS_VERIFICATION_RESULTS.md)** - Verification complete

See **[docs/README.md](docs/README.md)** for complete documentation index.

---

## Project Status

**Status**: ✅ **Production Deployed**
**Version**: 1.0 MVP
**Completion Date**: January 7, 2026

### Phase Completion
- ✅ Phase 1: Project Setup & Authentication
- ✅ Phase 2: Dashboard & Metrics Management
- ✅ Phase 3: Time Series Visualization
- ✅ Phase 4: Data Operations
- ✅ Phase 5: Dashboard Features
- ✅ Phase 6: Sharing & Permissions
- ⏭️ Phase 7: Vercel API Routes (skipped for MVP)
- ✅ Phase 8: Testing & Optimization
- ✅ Phase 9: Production Launch

See **[PROJECT_COMPLETE.md](PROJECT_COMPLETE.md)** for full completion report.

---

## Architecture

### Frontend Structure
```
src/
├── components/          # React components
│   ├── TimeSeriesChart.tsx
│   ├── CompactTimeSeriesChart.tsx
│   └── ...
├── pages/              # Page components
│   └── DashboardPage.tsx
├── lib/                # Utilities
│   ├── supabase.ts     # Supabase client
│   ├── forecasting.ts  # Forecasting logic
│   └── ...
└── types/              # TypeScript types
    └── index.ts
```

### Database Schema
```sql
dashboards (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES auth.users,
  name TEXT,
  permission_level TEXT (private|domain|public),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

metrics (
  id UUID PRIMARY KEY,
  dashboard_id UUID REFERENCES dashboards ON DELETE CASCADE,
  name TEXT,
  csv_file_path TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

metric_configurations (
  id UUID PRIMARY KEY,
  metric_id UUID REFERENCES metrics ON DELETE CASCADE,
  config_key TEXT,
  config_value JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Security

### Row-Level Security (RLS)
- **17 policies** across 4 tables/buckets
- User-isolated file storage
- Permission-based data access
- Cascading security inheritance

### Verified Security Behaviors
- ✅ Users can only access their own private dashboards
- ✅ Public dashboards viewable by anyone (read-only)
- ✅ Domain dashboards viewable by same email domain (read-only)
- ✅ CSV files isolated per user folder
- ✅ Unauthorized access prevented

See **[RLS Verification Results](docs/RLS_VERIFICATION_RESULTS.md)** for complete audit.

---

## Performance

### Build Metrics
- **Build Time**: 1.36s
- **Bundle Size**: 748.15 KB (216.64 KB gzipped)
- **Modules**: 755
- **Compression**: 71%

### Runtime Performance
- **Initial Load**: < 3s on 3G
- **Chart Rendering**: 60 fps
- **Data Operations**: Client-side (instant)
- **Database Queries**: Optimized with indexes

---

## Contributing

This is currently a solo project. Future contributions may be welcomed.

### Development Guidelines
- TypeScript strict mode enabled
- ESLint configuration provided
- Granular D3 imports (no wildcards)
- Comprehensive error handling
- RLS policies for all data access

---

## Deployment

### Automatic Deployment
- Push to `main` branch → Vercel auto-deploys
- Build time: ~90 seconds
- Zero-downtime deployments

### Manual Deployment
```bash
# Build locally
npm run build

# Deploy to Vercel
vercel --prod
```

### Environment Setup
See **[Launch Checklist](docs/LAUNCH_CHECKLIST.md)** for production setup.

---

## Future Enhancements

### Planned Features
- PDF export
- Excel file support
- Database connections
- Custom date ranges
- Automated email reports
- Team collaboration
- Advanced forecasting models
- Anomaly detection

### When User Base Grows
- Sentry error tracking (at 50+ users)
- Analytics (Plausible or GA4)
- Code splitting
- Performance optimizations
- Mobile app

---

## License

MIT License - See LICENSE file for details

---

## Support

### For Users
- **User Guide**: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- **FAQ**: See User Guide Troubleshooting section

### For Developers
- **Documentation**: [docs/README.md](docs/README.md)
- **Issues**: GitHub Issues (coming soon)

---

## Acknowledgments

**Built with**:
- React, TypeScript, Vite
- D3.js for visualization
- Supabase for backend
- Vercel for hosting
- TailwindCSS for styling

**Inspired by**: The need for simple, no-code time series analysis tools for business users.

---

## Links

- **Production App**: https://bialy.vercel.app
- **GitHub Repository**: https://github.com/misanuk166/bialy
- **Documentation**: [docs/](docs/)
- **Project Completion Report**: [PROJECT_COMPLETE.md](PROJECT_COMPLETE.md)

---

**🎉 Bialy is live and ready for users! 🎉**

*Last Updated: January 20, 2026*
