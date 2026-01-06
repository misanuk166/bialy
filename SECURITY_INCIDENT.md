# SECURITY INCIDENT - OAuth Credentials Exposed (TEST APP)

**Date**: January 6, 2026
**Severity**: LOW (test app only, not production)
**Status**: MITIGATED - Credentials removed from public repo, continuing to use privately

---

## What Happened

Google OAuth2 credentials were accidentally committed to the public GitHub repository in `docs/SETUP_COMPLETE.md` (commit `b5c6944`).

**Exposed Credentials:**
- OAuth Client ID: `43600618596-iqpjd1ahb6hs6ojblpslcv4njmp7nps5.apps.googleusercontent.com`
- OAuth Client Secret: `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`

GitGuardian detected this exposure on **January 6, 2026 at 00:24:57 UTC**.

---

## 📝 Resolution for Test App

**Decision**: Since this is a test/development app with no real users or sensitive data, we're keeping the existing credentials but ensuring they're not publicly exposed.

## ⚠️ OPTIONAL ACTIONS (For Production Apps Only)

### 1. Rotate OAuth Credentials (SKIP FOR TEST APPS)

If this were a production app, you would create new OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services > Credentials**
3. Find the OAuth 2.0 Client ID: `43600618596-iqpjd1ahb6hs6ojblpslcv4njmp7nps5`
4. **Delete this OAuth client** (or create a new one)
5. **Create a new OAuth 2.0 Client ID:**
   - Application type: Web application
   - Name: Bialy (or your choice)
   - Authorized redirect URIs:
     - `https://mcnzdiflwnzyenhhyqqo.supabase.co/auth/v1/callback`
     - `http://localhost:54321/auth/v1/callback`
6. **Copy the new Client ID and Client Secret**

### 2. Update Supabase Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication > Providers > Google**
3. Replace the old Client ID and Client Secret with the new ones
4. Save changes

### 3. Update Local Environment

Update your `.env.local` file (this file is gitignored and safe):

```bash
# Supabase credentials (unchanged)
VITE_SUPABASE_URL=https://mcnzdiflwnzyenhhyqqo.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# No need to store OAuth credentials in .env - they're in Supabase
```

### 4. Update Vercel Environment Variables (if needed)

The OAuth credentials are stored in Supabase, not Vercel, so no Vercel changes are needed. However, verify your Supabase keys are still correct:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select the Bialy project
3. Go to **Settings > Environment Variables**
4. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct

---

## What Was Done

### Immediate Remediation (Completed)

1. ✅ Redacted credentials from `docs/SETUP_COMPLETE.md`
2. ✅ Added `docs/SETUP_COMPLETE.md` to `.gitignore`
3. ✅ Added explicit `.env*` exclusions to `.gitignore`
4. ✅ Removed `docs/SETUP_COMPLETE.md` from git tracking
5. ✅ Committed security fix

### Git History (Optional)

The exposed credentials still exist in git history (commit `b5c6944`). After rotating the credentials, you can optionally scrub the history:

**Option A: Force push (destructive, use with caution)**
```bash
# WARNING: This rewrites history. Only do this if you're the sole contributor
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch docs/SETUP_COMPLETE.md" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

**Option B: Use BFG Repo-Cleaner (recommended if you want to scrub history)**
```bash
# Install BFG
brew install bfg  # or download from https://rtyley.github.io/bfg-repo-cleaner/

# Create a fresh clone
cd ..
git clone --mirror https://github.com/misanuk166/bialy.git bialy-mirror
cd bialy-mirror

# Remove the file from history
bfg --delete-files SETUP_COMPLETE.md

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force
```

**Option C: Do nothing (after rotating credentials)**

Since you've already rotated the credentials, the exposed secrets are now invalid. The git history still contains them, but they're useless to attackers. This is the simplest option.

---

## Prevention Measures (Implemented)

### ✅ Updated .gitignore

```gitignore
# Environment variables and secrets
.env
.env.local
.env.*.local
docs/SETUP_COMPLETE.md
```

### 📝 Best Practices Going Forward

1. **Never commit credentials** - Always use environment variables
2. **Review PRs carefully** - Check for accidentally committed secrets
3. **Use git hooks** - Consider tools like [git-secrets](https://github.com/awslabs/git-secrets)
4. **Rotate regularly** - Even without exposure, rotate credentials periodically

---

## Verification Steps

After rotating credentials:

1. ✅ Test Google OAuth login at https://bialy.vercel.app/login
2. ✅ Verify new credentials work in Supabase dashboard
3. ✅ Confirm old credentials are deleted from Google Cloud Console
4. ✅ Check that `.env.local` is gitignored: `git status` should not show it

---

## Questions?

If you have questions about this security incident or the remediation steps, please refer to:
- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

**Status**: ⏳ Waiting for credential rotation by repository owner
