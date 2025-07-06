# Enhanced Proposal Bulk Upload Tool - PowerShell Version
param(
    [Parameter(Mandatory=$true)]
    [string]$FolderPath,
    
    [Parameter(Mandatory=$true)]
    [string]$ClientName,
    
    [string]$Date,
    [string]$Tags,
    [switch]$Recursive,
    [string]$FileTypes
)

# Function to display help
function Show-Help {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Enhanced Proposal Bulk Upload Tool" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\upload.ps1 -FolderPath 'path' -ClientName 'name' [options]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -FolderPath    Path to folder containing proposal files"
    Write-Host "  -ClientName    Name of the client for these proposals"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Date          Date for the proposals (YYYY-MM-DD)"
    Write-Host "  -Tags          Comma-separated tags"
    Write-Host "  -Recursive     Search subdirectories recursively"
    Write-Host "  -FileTypes     Comma-separated file extensions"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\upload.ps1 -FolderPath 'C:\Users\$env:USERNAME\OneDrive\Documents\Proposals' -ClientName 'Acme Corp'"
    Write-Host "  .\upload.ps1 -FolderPath 'C:\Users\$env:USERNAME\OneDrive\Documents\Proposals' -ClientName 'Tech Startup' -Date '2024-01-15' -Tags 'crm,enterprise'"
    Write-Host "  .\upload.ps1 -FolderPath 'C:\Users\$env:USERNAME\OneDrive\Documents\Proposals' -ClientName 'Client Name' -Recursive"
    Write-Host ""
    Write-Host "Common OneDrive paths:"
    Write-Host "  'C:\Users\$env:USERNAME\OneDrive\Documents\Proposals'"
    Write-Host "  'C:\Users\$env:USERNAME\OneDrive\Business\Proposals'"
    Write-Host "  'C:\Users\$env:USERNAME\OneDrive\Work\Proposals'"
    Write-Host ""
}

# Show help if no parameters provided
if (-not $FolderPath -or -not $ClientName) {
    Show-Help
    exit 1
}

# Build the command arguments for LangChain upload
$args = @($FolderPath)

if ($Recursive) {
    $args += "--recursive"
}

if ($FileTypes) {
    $args += "--file-types=$FileTypes"
}

# Display what we're about to do
Write-Host "🚀 Starting LangChain-powered proposal upload..." -ForegroundColor Green
Write-Host "  Folder: $FolderPath" -ForegroundColor Yellow
Write-Host "  Auto-extracting: Client, Author, Date, Sector, Tags" -ForegroundColor Yellow
if ($Recursive) { Write-Host "  Recursive: Yes" -ForegroundColor Yellow }
if ($FileTypes) { Write-Host "  File Types: $FileTypes" -ForegroundColor Yellow }
Write-Host ""

# Check if folder exists
if (-not (Test-Path $FolderPath)) {
    Write-Host "❌ Folder not found: $FolderPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Tip: Make sure the OneDrive folder is synced locally and the path is correct." -ForegroundColor Yellow
    Write-Host "   Example: 'C:\Users\$env:USERNAME\OneDrive\Documents\Proposals'" -ForegroundColor Yellow
    exit 1
}

# Run the LangChain upload tool
try {
    Write-Host "🔗 Using LangChain pipeline with enhanced metadata extraction..." -ForegroundColor Green
    npx tsx src/lib/langchain-upload.ts @args
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Upload completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Upload failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error running upload tool: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Read-Host "Press Enter to continue"