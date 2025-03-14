# Find Git executable
$gitPath = "C:\Program Files\Git\bin\git.exe"

# Add, commit and push changes
Write-Host "Adding changes to Git..."
& $gitPath add .

Write-Host "Committing changes..."
& $gitPath commit -m "Fix Vercel deployment configuration"

Write-Host "Pushing to GitHub..."
& $gitPath push

Write-Host "Done!" 