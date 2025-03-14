# Find Git executable
$gitPath = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $gitPath)) {
    $gitPath = "C:\Program Files (x86)\Git\bin\git.exe"
}
if (-not (Test-Path $gitPath)) {
    Write-Host "Git executable not found. Please install Git and try again."
    exit 1
}

Write-Host "Using Git from: $gitPath"

# Run Git commands
Write-Host "Adding README file..."
echo "# Chat-App" > README.md

Write-Host "Initializing Git repository..."
& $gitPath init

Write-Host "Adding all files to Git..."
& $gitPath add .

Write-Host "Committing changes..."
& $gitPath commit -m "first commit"

Write-Host "Setting branch to main..."
& $gitPath branch -M main

Write-Host "Adding remote origin..."
& $gitPath remote add origin https://github.com/hadesxkore/Chat-App.git

Write-Host "Pushing to GitHub..."
& $gitPath push -u origin main

Write-Host "Done!" 