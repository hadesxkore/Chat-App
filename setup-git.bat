@echo off
echo Setting up Git repository...
echo "# Chat App" > README.md
git init
git add .
git commit -m "Initial commit: Chat app with voice messages and modern UI"
git branch -M main
git remote add origin https://github.com/hadesxkore/Chat-App.git
git push -u origin main
echo Done!
pause 