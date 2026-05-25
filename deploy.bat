@echo off
title FlexTrack GitHub Deployment Assistant
color 0a

echo ===================================================
echo   FLEXTRACK GITHUB DEPLOYMENT ASSISTANT
echo ===================================================
echo.
echo Step 1: Please create a NEW repository on GitHub:
echo   - Name: flextrack
echo   - Keep it PUBLIC (required for free GitHub Pages)
echo   - DO NOT initialize it with a README, license, or .gitignore
echo.
echo Step 2: Copy the repository URL (e.g., https://github.com/username/flextrack.git)
echo.
set /p REPO_URL="Paste your GitHub Repository URL and press Enter: "

if "%REPO_URL%"=="" (
    echo.
    echo Error: No URL entered. Exiting...
    pause
    exit /b
)

echo.
echo Connecting local repository to GitHub...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo.
echo Pushing code to GitHub...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Push failed. Make sure you are logged in to Git/GitHub on your PC.
    pause
    exit /b
)

echo.
echo ===================================================
echo   DEPLOYMENT SUCCESSFUL!
echo ===================================================
echo.
echo Step 3: Enable GitHub Pages:
echo   - Go to your repository on GitHub.com
echo   - Go to Settings -^> Pages
echo   - Under "Build and deployment" -^> "Source", select "Deploy from a branch"
echo   - Under "Branch", select "main" and click "Save"
echo.
echo The app will be live at: https://[your-username].github.io/flextrack/
echo.
pause
