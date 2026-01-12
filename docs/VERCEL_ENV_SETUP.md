# Vercel Environment Variables Setup

The production app needs these environment variables configured in Vercel.

## Required Environment Variables

You need to add these in the Vercel dashboard:

### 1. Go to Vercel Dashboard

1. Visit: [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your **bialy** project
3. Go to **Settings** → **Environment Variables**

### 2. Add These Variables

Add each of these environment variables:

#### `VITE_SUPABASE_URL`
- **Value**: `https://mcnzdiflwnzyenhhyqqo.supabase.co`
- **Environment**: Production, Preview, Development (select all)

#### `VITE_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon/public key from `.env.local`
- **Environment**: Production, Preview, Development (select all)
- **To find it**: Check your local `.env.local` file or Supabase dashboard

### 3. Redeploy

After adding the environment variables:

1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Select **Use existing Build Cache** (optional)
5. Click **Redeploy**

**OR** just push a new commit to trigger automatic deployment:
```bash
git commit --allow-empty -m "Trigger redeploy with env vars"
git push origin main
```

## How to Get Your Supabase Anon Key

If you don't have it:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/mcnzdiflwnzyenhhyqqo/settings/api)
2. Under **Project API keys**, copy the **anon** / **public** key
3. Paste it in Vercel as `VITE_SUPABASE_ANON_KEY`

## Verify Environment Variables

After redeployment, you can verify the variables are working by:

1. Visit: `https://bialy.vercel.app/`
2. Open browser console (F12)
3. Check for any errors about "Missing Supabase environment variables"
4. If you see this error, the env vars aren't configured correctly

## Common Issues

**"Missing Supabase environment variables" error**
- Environment variables weren't added in Vercel dashboard
- Need to redeploy after adding env vars

**Still showing old deployment**
- Clear your browser cache
- Try in incognito/private window
- Wait a few minutes for CDN to update

**OAuth redirect errors**
- Environment variables are correct
- This is a different issue (Google OAuth configuration)

---

**After completing these steps, the production app should work!** 🚀
