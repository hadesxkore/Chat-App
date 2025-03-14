# Chat App Deployment Guide

## Deploying to GitHub

1. If not already installed, download and install Git from [https://git-scm.com/downloads](https://git-scm.com/downloads)
2. After installation, close and reopen your command prompt or PowerShell
3. Run these commands in your project directory:

```bash
# Initialize Git repository
git init

# Add all files to Git
git add .

# Commit the changes
git commit -m "Initial commit: Chat app with voice messages and modern UI"

# Set the branch name to main
git branch -M main

# Add your GitHub repository as the remote origin
git remote add origin https://github.com/hadesxkore/Chat-App.git

# Push the code to GitHub
git push -u origin main
```

## Deploying to Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy your project:
```bash
vercel
```

### Option 2: Using Vercel Web Interface

1. Go to [https://vercel.com/](https://vercel.com/) and log in
2. Click "Add New..." > "Project"
3. Import your GitHub repository
4. Configure your project:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: npm run build (default)
   - Output Directory: .next (default)
   - Install Command: npm install (default)
5. Set up environment variables if needed:
   - Add your Firebase configuration
   - Add any other API keys or secrets
6. Click "Deploy"

## Environment Variables

Make sure to set these environment variables in Vercel:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Post-Deployment

After deployment, you may need to set up:

1. Firebase Authentication providers
2. Firestore database rules
3. Storage rules for voice messages

Your app should now be live at a Vercel URL like `https://chat-app-yourname.vercel.app/` 