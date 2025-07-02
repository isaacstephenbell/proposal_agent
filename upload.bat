@echo off
echo ========================================
echo    Enhanced Proposal Bulk Upload Tool
echo ========================================
echo.

REM Check if arguments are provided
if "%~1"=="" (
    echo Usage: upload.bat "folder-path" "client-name" [options]
    echo.
    echo Examples:
    echo   upload.bat "C:\Users\%USERNAME%\OneDrive\Documents\Proposals" "Acme Corp"
    echo   upload.bat "C:\Users\%USERNAME%\OneDrive\Documents\Proposals" "Tech Startup" --date "2024-01-15" --tags "crm,enterprise"
    echo   upload.bat "C:\Users\%USERNAME%\OneDrive\Documents\Proposals" "Client Name" --recursive
    echo.
    echo Common OneDrive paths:
    echo   "C:\Users\%USERNAME%\OneDrive\Documents\Proposals"
    echo   "C:\Users\%USERNAME%\OneDrive\Business\Proposals"
    echo   "C:\Users\%USERNAME%\OneDrive\Work\Proposals"
    echo.
    pause
    exit /b 1
)

REM Run the bulk upload tool
echo Starting bulk upload...
npx tsx bulk-upload.ts %*

echo.
echo Upload completed!
pause 