# Vercel Deployment Guide

This project is configured for deployment on Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Vercel CLI installed (optional, for CLI deployment):
   ```bash
   npm install -g vercel
   ```

## Deployment Methods

### Method 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub/GitLab/Bitbucket**
   - Make sure all files are committed and pushed to your repository

2. **Import Project on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your Git repository
   - Vercel will automatically detect the Python project

3. **Configure Build Settings**
   - Build Command: (leave empty, Vercel will auto-detect)
   - Output Directory: (leave empty)
   - Install Command: `pip install -r requirements.txt`

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete

### Method 2: Deploy via Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   For production deployment:
   ```bash
   vercel --prod
   ```

## Project Structure

The project is configured with:
- `vercel.json` - Vercel configuration file
- `api/index.py` - Serverless function handler for Flask app
- `.vercelignore` - Files to exclude from deployment

## Important Notes

1. **Large Dependencies**: The `fastf1` library and its dependencies are quite large. The first deployment may take several minutes.

2. **Memory Limits**: Vercel serverless functions have memory limits. If you encounter memory issues with large telemetry data, consider:
   - Using Vercel Pro plan for higher limits
   - Optimizing data processing
   - Using external storage for computed data

3. **Cache Directory**: The `.fastf1-cache` directory is excluded from deployment. Cache will be rebuilt on each cold start.

4. **Environment Variables**: If needed, add environment variables in Vercel dashboard under Project Settings > Environment Variables.

5. **Function Timeout**: Vercel has execution time limits (10s on Hobby, 60s on Pro). Large telemetry processing may need optimization.

## Troubleshooting

- **Build Failures**: Check the build logs in Vercel dashboard
- **Import Errors**: Ensure all dependencies are in `requirements.txt`
- **Memory Issues**: Consider upgrading to Vercel Pro or optimizing data processing
- **Timeout Issues**: Break down large operations into smaller chunks

## Post-Deployment

After deployment, your app will be available at:
- `https://your-project-name.vercel.app`

You can also set up a custom domain in Vercel project settings.

