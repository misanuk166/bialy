# Bialy - User Guide

**Welcome to Bialy!** A tool for visualizing and analyzing time series data without code.

---

## Getting Started (2 minutes)

### 1. Sign Up

1. Go to: https://bialy.vercel.app
2. Click **"Sign in with Google"**
3. Choose your Google account
4. You're in! 🎉

### 2. Create Your First Dashboard

1. Click **"+ New Dashboard"**
2. Give it a name (e.g., "Q1 Sales")
3. Click **Create**

### 3. Add Your First Metric

**Option A: Upload CSV File**
1. Click **"Add Metric"** button
2. Drag and drop your CSV file, or click to browse
3. CSV format should have these columns:
   ```
   date,numerator,denominator
   2024-01-01,5000,1
   2024-01-02,5200,1
   2024-01-03,4800,1
   ```
4. Your chart appears!

**Option B: Try Sample Data**
1. Click **"Add Metric"** button
2. Click **"Add Synthetic Metric"** at the bottom
3. Sample data loads instantly

---

## Core Features

### Smoothing Your Data

**What**: Smooth out daily noise to see trends
**How**:
1. Toggle **"Smooth"** in the controls
2. Choose smoothing period (default: 7 days)
3. Original data shown as dots, smoothed line overlays

**Use case**: See weekly trends instead of daily fluctuations

### Comparing Time Periods (Shadows)

**What**: Compare current data to past periods
**How**:
1. Click **"Add Shadow"**
2. Choose offset: "1 year ago", "1 quarter ago", etc.
3. Past data shows in gray
4. Add up to 10 shadows

**Use case**: Compare this year's sales to last year

### Setting Goals

**What**: Add target lines to track progress
**How**:
1. Click **"Add Goal"**
2. Choose goal type:
   - **Continuous**: Fixed target (e.g., "above 80%")
   - **End-of-period**: Growth trajectory
3. Goal shows as dashed line

**Use case**: Track progress toward quarterly targets

### Forecasting

**What**: Project future values based on historical data
**How**:
1. Toggle **"Forecast"** in controls
2. Choose horizon (7, 30, 90 days)
3. Forecast shows in blue with confidence intervals

**Use case**: Predict next quarter's revenue

### Focus Period Analysis

**What**: Zoom into specific date ranges with stats
**How**:
1. Click **"Focus Period"** button
2. Select start and end dates
3. Stats panel shows: mean, min, max, comparisons

**Use case**: Analyze performance during a campaign

---

## Managing Dashboards

### Creating Multiple Dashboards

1. Click dashboard name in top-left
2. Select **"+ Create New Dashboard"**
3. Each dashboard holds multiple metrics

**Tip**: Create separate dashboards for different teams or time periods

### Switching Between Dashboards

1. Click current dashboard name
2. Choose from **"My Dashboards"** list
3. Your last dashboard is remembered

### Renaming a Dashboard

1. Click dashboard name
2. Click **"Rename"** icon (pencil)
3. Type new name and press Enter

### Deleting a Dashboard

1. Click dashboard name
2. Click **"Delete"** icon (trash)
3. Confirm deletion
4. **Note**: This deletes all metrics in the dashboard

---

## Sharing Dashboards

### Sharing Options

**Private** (default):
- Only you can see it
- Not shared with anyone

**Domain**:
- Anyone with same email domain can view
- Example: alice@company.com shares with bob@company.com
- Read-only for viewers

**Public**:
- Anyone with the link can view
- Read-only for viewers
- Use for public reports

### How to Share

1. Open dashboard you want to share
2. Click **"Share"** button
3. Choose sharing level
4. Copy link if Domain or Public
5. Send link to recipients

**Tip**: Recipients will see "Read-Only Mode" banner

---

## Working with Data

### CSV File Format

Your CSV must have 3 columns:

```csv
date,numerator,denominator
2024-01-01,100,1
2024-01-02,105,1
2024-01-03,98,1
```

**Columns**:
- **date**: Format as YYYY-MM-DD or MM/DD/YYYY
- **numerator**: The value (e.g., sales, visitors)
- **denominator**: Use `1` for simple counts, or actual denominator for rates

**Example for rates** (conversion rate):
```csv
date,numerator,denominator
2024-01-01,50,5000    (50 sales / 5000 visitors = 1%)
2024-01-02,55,5200    (55 sales / 5200 visitors = 1.06%)
```

### Uploading Multiple Metrics

1. Click **"Add Metric"** for each dataset
2. All metrics show in dashboard grid
3. Drag to reorder metrics
4. All share same controls (smoothing, shadows, etc.)

### Removing a Metric

1. Click **"..."** menu on metric card
2. Select **"Remove"**
3. Metric is deleted

**Note**: You cannot remove the last metric (dashboard needs at least one)

---

## Tips & Best Practices

### Data Quality

✅ **Do**:
- Use consistent date format
- Ensure dates are in chronological order
- Remove header rows (except column names)
- Check for missing values

❌ **Avoid**:
- Duplicate dates (last value wins)
- Non-numeric values in numerator/denominator
- Zero or negative denominators

### Dashboard Organization

**For teams**: Create one dashboard per team
- Sales Team Dashboard
- Marketing Dashboard
- Product Metrics Dashboard

**For time periods**: Create dashboards for quarters/years
- Q1 2024 Performance
- 2024 Annual Metrics

**For projects**: Create dashboards per initiative
- Website Redesign Metrics
- Product Launch Tracking

### Performance

**Large files**: App handles 1000+ rows well
**Many metrics**: Up to 10 metrics per dashboard recommended
**Slow charts**: Try grouping by week/month instead of daily

---

## Keyboard Shortcuts

- **Zoom**: Scroll on chart
- **Pan**: Click and drag on chart
- **Reset Zoom**: Double-click chart
- **New Dashboard**: (none yet - coming soon!)

---

## Common Questions

### Why can't I edit a shared dashboard?

You're viewing someone else's dashboard. Only the owner can edit. Create your own dashboard to modify data.

### My data isn't smoothing correctly

Check your time unit:
- Daily data → Use 7 or 30 day smoothing
- Weekly data → Use 4 week smoothing
- Monthly data → Use quarterly smoothing

### Forecast looks wrong

Forecasts work best with:
- At least 90 days of historical data
- Relatively stable trends
- No major outliers

For volatile data, forecasts may be less accurate.

### Can I export my dashboard?

Not yet! Export features (PDF, CSV) are coming soon.

### Can I connect to a database?

Not yet! Currently CSV upload only. Database connections are planned for future.

---

## Troubleshooting

### Problem: Can't sign in

**Solution**:
1. Try different browser
2. Check pop-up blocker isn't blocking OAuth
3. Clear browser cache and try again

### Problem: CSV upload fails

**Solution**:
1. Check file format (must be .csv)
2. Verify 3 columns: date, numerator, denominator
3. Check for invalid characters in data
4. File must be under 10MB

### Problem: Chart doesn't render

**Solution**:
1. Check data has valid dates
2. Check numerator values are numbers
3. Ensure at least 2 data points
4. Try refreshing page

### Problem: Dashboard won't save

**Solution**:
1. Check internet connection
2. Try signing out and back in
3. Check browser console for errors
4. Contact support if persistent

---

## Getting Help

### Support Contact

Email: [your-support-email]
Response time: 24-48 hours

### What to Include

When reporting issues, please provide:
1. What you were trying to do
2. What happened instead
3. Your browser (Chrome/Safari/Firefox)
4. Screenshot if possible

### Known Issues

- Mobile experience not fully optimized (use desktop for best experience)
- Large CSV files (>5000 rows) may slow down
- Some features don't work in Internet Explorer (use modern browser)

---

## Feature Requests

Have an idea? We'd love to hear it!
Email: [your-support-email]

### Planned Features

- Export dashboards as PDF
- Excel file support
- Database connections
- Custom date ranges
- Automated reports
- Team collaboration features

---

## Privacy & Security

### Your Data

- ✅ Your data is private by default
- ✅ Only you can access your private dashboards
- ✅ Shared dashboards are read-only for viewers
- ✅ Data stored securely in Supabase (enterprise-grade)
- ✅ Files encrypted in transit and at rest

### Sharing

- **Private**: Only you
- **Domain**: Anyone @yourcompany.com can view (read-only)
- **Public**: Anyone with link can view (read-only)

You can change sharing level anytime.

### Account Deletion

Email [your-support-email] to delete your account. We'll remove:
- All your dashboards
- All your metrics
- All your CSV files

This cannot be undone.

---

## About Bialy

**Built for**: Business executives and analysts who need to understand time series data without code

**Name**: "Bialy" (pronounced bee-AH-lee) - inspired by the bagel, representing the cycles and patterns in data

**Technology**: React, D3.js, Supabase, Vercel

**Version**: 1.0 (January 2026)

---

## Quick Reference Card

```
📊 CREATE DASHBOARD: + New Dashboard button
📈 ADD METRIC: Add Metric button → Upload CSV
🔍 SMOOTH DATA: Toggle "Smooth" → Choose period
👥 COMPARE PERIODS: Add Shadow → Choose offset
🎯 SET GOALS: Add Goal → Choose type and value
🔮 FORECAST: Toggle "Forecast" → Choose horizon
📅 FOCUS PERIOD: Focus Period button → Select dates
🔗 SHARE: Share button → Choose level → Copy link
```

---

**Need more help?** Contact: [your-support-email]

**Last updated**: January 7, 2026
