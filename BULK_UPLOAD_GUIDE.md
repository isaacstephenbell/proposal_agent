# Bulk Upload Guide

This guide will help you quickly upload your proposal files from OneDrive to the proposal assistant.

## 🚀 Quick Start

### 1. Prepare Your Files

Make sure your proposal files are in a OneDrive folder and synced locally. Supported formats:
- `.txt` - Plain text files
- `.md` - Markdown files
- `.docx` - Microsoft Word documents
- `.pdf` - PDF documents

### 2. Choose Your Upload Method

#### Option A: PowerShell (Recommended)
```powershell
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Your Client Name"
```

#### Option B: Batch File
```cmd
upload.bat "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Your Client Name"
```

#### Option C: Direct Command
```bash
npx tsx bulk-upload.ts "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Your Client Name"
```

## 📁 Common OneDrive Paths

Replace `IsaacBell` with your Windows username:

- **Documents**: `C:\Users\IsaacBell\OneDrive\Documents\Proposals`
- **Business**: `C:\Users\IsaacBell\OneDrive\Business\Proposals`
- **Work**: `C:\Users\IsaacBell\OneDrive\Work\Proposals`
- **Desktop**: `C:\Users\IsaacBell\OneDrive\Desktop\Proposals`

## 🎯 Advanced Usage

### Upload with Metadata

```powershell
# With date and tags
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Tech Startup" -Date "2024-01-15" -Tags "crm,enterprise"

# Recursive (includes subdirectories)
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Client Name" -Recursive

# Custom file types only
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Client Name" -FileTypes ".txt,.md"
```

### Batch File Examples

```cmd
# Simple upload
upload.bat "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Acme Corp"

# With options
upload.bat "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Tech Startup" --date "2024-01-15" --tags "crm,enterprise"
```

## 🔧 Troubleshooting

### Folder Not Found
```
❌ Folder not found: C:\Users\IsaacBell\OneDrive\Documents\Proposals
```

**Solutions:**
1. Make sure OneDrive is synced locally
2. Check the exact path in File Explorer
3. Use the correct Windows username
4. Try using quotes around the path

### No Files Found
```
❌ No supported files found.
Supported formats: .txt, .md, .docx, .pdf
```

**Solutions:**
1. Check that your files have the correct extensions
2. Make sure files are not in subdirectories (use `--recursive` flag)
3. Verify files are not corrupted or password-protected

### API Rate Limits
If you get rate limit errors, the tool automatically adds delays between requests. For large uploads, consider:
1. Breaking files into smaller batches
2. Running uploads during off-peak hours
3. Using the `--file-types` option to process specific formats first

### File Reading Errors
```
❌ Error reading .docx file: [error message]
```

**Solutions:**
1. Make sure the file is not password-protected
2. Try converting to .txt or .md format
3. Check if the file is corrupted
4. Ensure you have the latest version of the tool

## 📊 Understanding the Output

The upload tool provides detailed progress information:

```
🚀 Starting enhanced bulk proposal upload...
📁 Folder: C:\Users\IsaacBell\OneDrive\Documents\Proposals
👤 Client: Acme Corp
📄 Found 5 files to process

📖 Processing: proposal1.docx
  📝 Extracted 12 chunks
....................................................................

📊 Upload Summary:
  Total files found: 5
  Files processed: 5
  Total chunks processed: 45
  Successful chunks: 45
  Failed chunks: 0
  Success rate: 100.0%
```

## 🎯 Best Practices

### File Organization
- Keep proposals in dedicated folders by client or project
- Use descriptive filenames
- Consider using subdirectories for different proposal types

### Metadata Strategy
- Use consistent client names
- Add relevant tags for better searchability
- Include dates for temporal context

### Performance Tips
- Upload during off-peak hours for large batches
- Use recursive mode for organized folder structures
- Process different file types separately if needed

## 🔄 Updating Existing Proposals

The tool will create new entries for each upload. If you need to update existing proposals:

1. Delete old entries from the database (if needed)
2. Re-upload with the same metadata
3. Or use different client names/tags to distinguish versions

## 📞 Getting Help

If you encounter issues:

1. Check this guide first
2. Verify your environment variables are set correctly
3. Ensure OneDrive is synced and accessible
4. Try with a small test folder first
5. Check the console output for specific error messages

## 🚀 Next Steps

After uploading your proposals:

1. Test the chat interface to discover insights
2. Generate new proposals based on your historical data
3. Refine your upload strategy based on results
4. Consider organizing proposals by industry, project type, or other criteria 