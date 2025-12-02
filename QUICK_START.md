# Quick Start: Deploy to Vercel

## Method 1: Deploy via Vercel Website (Easiest)

### Step 1: Push to GitHub
1. Create a new repository on GitHub (if you haven't already)
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository
5. Vercel will auto-detect Python - click **"Deploy"**
6. Wait for deployment to complete (may take 5-10 minutes due to large dependencies)

### Step 3: Access Your App
- Your app will be live at: `https://your-project-name.vercel.app`

---

## Method 2: Deploy via Command Line

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login
```bash
vercel login
```
This will open your browser to authenticate.

### Step 3: Deploy
From your project directory:
```bash
vercel
```

For production deployment:
```bash
vercel --prod
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (Select your account)
- Link to existing project? **No** (for first time)
- Project name? (Press Enter for default)
- Directory? (Press Enter for current directory)

---

## What Happens During Deployment

1. **Install Dependencies**: Vercel installs packages from `requirements.txt`
2. **Build**: Creates serverless functions from `api/index.py`
3. **Deploy**: Uploads your app to Vercel's edge network

**Note**: First deployment may take 5-10 minutes because:
- `fastf1` and its dependencies are large
- Vercel needs to download and install everything

---

## Troubleshooting

### Build Fails?
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `requirements.txt`
- Check that `api/index.py` exists

### App Doesn't Work?
- Check function logs in Vercel dashboard
- Verify static files are being served correctly
- Check browser console for errors

### Memory/Timeout Issues?
- Consider upgrading to Vercel Pro plan
- Optimize data processing in your code
- Break large operations into smaller chunks

---

## After Deployment

Your app will be available at:
- **Preview URL**: `https://your-project-name-git-main-yourusername.vercel.app`
- **Production URL**: `https://your-project-name.vercel.app`

You can also add a custom domain in Vercel project settings!

