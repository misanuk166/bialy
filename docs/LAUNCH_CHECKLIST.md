# Bialy - Minimal Production Launch Checklist

**Launch Date**: _____________
**Status**: 🟡 IN PROGRESS
**Approach**: Minimal viable launch - add monitoring/analytics later

---

## Why Minimal Launch?

- ✅ Core features working
- ✅ Security verified (RLS policies)
- ✅ App deployed on Vercel
- ⏱️ Skip complex monitoring for MVP
- 📊 Add analytics/monitoring when usage grows

---

## Pre-Launch Checklist

### 1. Environment & Deployment ✅ (Already Done)

- [x] App deployed to Vercel
- [x] Environment variables configured
- [x] SSL certificate active (Vercel automatic)
- [x] Database (Supabase) configured
- [x] Storage bucket configured
- [x] Google OAuth working

### 2. Security ✅ (Already Done)

- [x] RLS policies verified
- [x] All tables have RLS enabled
- [x] Unauthorized access prevented
- [x] File storage isolated per user
- [x] OAuth credentials not in repo

### 3. Build & Code Quality ✅ (Already Done)

- [x] TypeScript build passing
- [x] No critical bugs
- [x] D3 imports optimized
- [x] Error handling comprehensive
- [x] JSX structure bug fixed

---

## Launch Day Tasks (30 minutes)

### Task 1: Verify Production Environment (5 min)

**Vercel Environment Variables Check:**

1. Go to: https://vercel.com/dashboard
2. Select `bialy` project
3. Go to **Settings** → **Environment Variables**
4. Verify these exist:
   - [ ] `VITE_SUPABASE_URL`
   - [ ] `VITE_SUPABASE_ANON_KEY`

**If missing:** See `VERCEL_ENV_SETUP.md`

### Task 2: Production Smoke Test (10 min)

**Test the live app:** https://bialy.vercel.app (or your domain)

#### Test 1: Authentication (2 min)
- [ ] Go to app URL
- [ ] Click "Sign in with Google"
- [ ] Complete OAuth flow
- [ ] Verify redirect back to app
- [ ] Check user profile displayed in header

#### Test 2: Dashboard Management (3 min)
- [ ] Click "+ New Dashboard"
- [ ] Name it: "Launch Test Dashboard"
- [ ] Verify it appears in dashboard list
- [ ] Switch between dashboards
- [ ] Rename dashboard
- [ ] Verify name updates

#### Test 3: Metric Upload (3 min)
- [ ] Click "Add Metric" button
- [ ] Upload a CSV file (or use synthetic data)
- [ ] Verify chart renders correctly
- [ ] Hover over chart - verify hover data shows
- [ ] Test zoom/pan functionality

#### Test 4: Core Features (2 min)
- [ ] Enable smoothing - verify works
- [ ] Add a shadow - verify displays
- [ ] Add a goal - verify displays
- [ ] Generate forecast - verify displays
- [ ] Toggle focus period - verify highlights

#### Test 5: Sharing & Permissions (5 min)
- [ ] Click "Share" button on dashboard
- [ ] Change to "Public"
- [ ] Copy shareable link
- [ ] Open link in incognito window (logged out)
- [ ] Verify dashboard loads in read-only mode
- [ ] Verify "Read-Only Mode" banner shows
- [ ] Verify edit controls hidden

#### Test 6: Error Handling (3 min)
- [ ] Try uploading invalid CSV - verify error message
- [ ] Try accessing non-existent dashboard URL - verify graceful handling
- [ ] Sign out and try accessing dashboard - verify redirect to login

**✅ All tests passed**: Ready to launch!
**❌ Any test failed**: Document issue and fix before launch

### Task 3: Browser Compatibility Check (5 min)

Test on at least 2 browsers:
- [ ] Chrome (latest)
- [ ] Safari (latest) OR Firefox (latest)

**Quick test**: Sign in, create dashboard, upload metric, verify chart renders

### Task 4: Mobile Check (5 min) - Optional but Recommended

Open app on mobile device:
- [ ] Site loads on mobile
- [ ] Can sign in
- [ ] Charts visible (may not be fully interactive - that's okay for MVP)

**Note**: Full mobile optimization is a future enhancement

### Task 5: Document Known Issues (5 min)

List any known issues that are acceptable for MVP launch:

**Known Issues** (write down any you've noticed):
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Future Enhancements** (not blocking launch):
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Post-Launch Monitoring (Without Sentry)

### Manual Monitoring (First Week)

**Daily checks**:
1. Open app and verify it loads
2. Check Vercel deployment status: https://vercel.com/dashboard
3. Check Supabase dashboard for errors: https://supabase.com/dashboard
4. Review browser console for any errors (spot check)

**What to look for**:
- App doesn't load → Check Vercel deployment status
- Login broken → Check Google OAuth credentials
- Data not saving → Check Supabase logs

### Vercel Built-in Monitoring (Free)

**Enable Vercel Speed Insights** (1 minute):
1. Go to Vercel dashboard → Project settings
2. Click **Speed Insights** tab
3. Toggle **Enable**
4. No code changes needed!

This gives you:
- Page load times
- Real user metrics
- Core Web Vitals
- **All free and built-in**

### Supabase Built-in Monitoring (Free)

**Check Supabase Dashboard**:
1. Database Health: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/reports/database
2. API Usage: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/reports/api
3. Storage Usage: https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/storage/usage

**What to monitor**:
- Database connections (should be low for small user base)
- API requests per day (track growth)
- Storage usage (CSV files accumulate)

---

## When to Add Sentry / Advanced Monitoring

**Add when you reach**:
- 50+ active users
- Multiple error reports from users
- Need to debug production issues remotely
- Want detailed error stack traces

**For now**: Browser console + Vercel/Supabase dashboards are sufficient

---

## When to Add Analytics

**Add when you want to know**:
- How many visitors/signups
- Which features are used most
- User retention metrics
- A/B testing

**Recommended options** (when ready):
- **Plausible** (privacy-friendly, simple, ~$9/month)
- **Google Analytics 4** (free, complex)
- **Vercel Analytics** (paid add-on, $10/month)

---

## User Support Strategy (Minimal)

### For MVP Launch:

**Support Email**: Create one email for bug reports
- Example: `support@yourdomain.com` or use your personal email

**Response Template**:
```
Hi [User],

Thanks for trying Bialy! I'm actively fixing bugs and improving the app.

Could you provide:
1. What you were trying to do
2. What happened instead
3. Your browser (Chrome/Firefox/Safari)
4. Screenshot if possible

I'll get back to you within 24-48 hours.

Thanks!
[Your Name]
```

**Where to put support email**:
- In app footer
- In user documentation
- On any error pages

### Documentation (Minimal)

**Create ONE page** (see Task 4 below) with:
- How to sign up
- How to upload data
- How to create dashboards
- How to share dashboards
- Contact for support

---

## Go/No-Go Decision

### ✅ GO if:
- [x] Smoke test passed (Task 2)
- [x] RLS policies verified
- [x] Core features working
- [ ] No critical bugs found
- [ ] Environment variables set

### ❌ NO-GO if:
- [ ] Authentication broken
- [ ] Data not persisting
- [ ] Security issue found
- [ ] Critical bug in core flow

---

## Launch Announcement (Optional)

**If you want to announce**:
- Tweet/LinkedIn post
- Email to friends/colleagues
- Post in relevant communities

**Keep it simple**:
```
🚀 Just launched Bialy - a tool for time series data visualization and forecasting.

Built for business executives who need to understand trends without code.

Try it: [your-url]

Feedback welcome!
```

---

## Week 1 Post-Launch Plan

### Day 1-3: Monitor & Respond
- Check app daily (5 min)
- Respond to any user feedback
- Fix critical bugs immediately

### Day 4-7: Review & Plan
- Review Vercel metrics
- Review Supabase usage
- List top 3 improvements based on feedback
- Decide on next features

### Week 2+: Iterate
- Implement high-priority fixes/features
- Consider adding analytics (if >10 users)
- Consider adding Sentry (if seeing errors)

---

## Success Metrics (Week 1)

**Don't overthink metrics for MVP!** Just track:
- [ ] Number of signups (manual count in Supabase)
- [ ] Any bugs reported (count in email)
- [ ] App uptime (100% = good!)

That's it! Advanced metrics come later.

---

## Rollback Plan

**If something goes critically wrong**:

### Option 1: Quick Fix
1. Fix bug locally
2. `git commit` and `git push`
3. Vercel auto-deploys (2-3 min)

### Option 2: Rollback Deployment
1. Go to Vercel dashboard
2. Click **Deployments**
3. Find last working deployment
4. Click **...** → **Promote to Production**

### Option 3: Maintenance Mode
- Add temporary "Under maintenance" message
- Fix issue without pressure
- Redeploy when ready

**Note**: With only a few users, downtime is acceptable while you fix

---

## Final Sign-Off

**Pre-Launch Checklist** (Must all be ✅):
- [ ] Task 1: Environment verified
- [ ] Task 2: Smoke test passed
- [ ] Task 3: Browser compatibility checked
- [ ] Task 4: Known issues documented
- [ ] Go/No-Go decision: **GO**

**Launched By**: _______________
**Launch Date**: _______________
**Launch Time**: _______________
**Production URL**: https://bialy.vercel.app

---

## Post-Launch Log

**Day 1**:
- Status: _____________
- Issues: _____________
- User count: _____________

**Day 3**:
- Status: _____________
- Issues: _____________
- User count: _____________

**Day 7**:
- Status: _____________
- Issues: _____________
- User count: _____________
- Top feedback: _____________

---

## Questions?

**When you're ready to add monitoring later**:
- Sentry setup guide: https://docs.sentry.io/platforms/javascript/guides/react/
- Plausible setup: https://plausible.io/docs
- Vercel Analytics: https://vercel.com/docs/concepts/analytics

**For now**: Keep it simple. Launch and learn!

🚀 **Good luck with your launch!**
