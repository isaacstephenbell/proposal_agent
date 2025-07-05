# AI Assistant Briefing - Isaac's Proposal System

## CRITICAL: Read This First
This document contains 3 months of development decisions and workflows. NEVER ignore or override these without explicit permission.

## System Overview
- **Current State**: Fully working proposal processing system with Supabase + pgvector
- **Upload System**: Automated metadata extraction using LLM - NO manual client specification needed
- **Architecture**: Next.js 14 + TypeScript + Supabase + OpenAI embeddings
- **LangChain Status**: Pipeline implemented but system works with direct Supabase calls

## Core Workflows

### Document Upload Process
1. **Command**: `.\upload.ps1 -FolderPath "PATH" -ClientName "Auto-Extract"`
2. **System automatically extracts**: Client, Author, Date, Sector from document content
3. **Auto-generates tags** using LLM analysis
4. **Never ask for client names** - the system determines this from document content
5. **Supported formats**: .docx, .txt, .md, .pdf

### Key File Locations
- **Upload scripts**: `upload.ps1` (main), `bulk-upload.ts` (core)
- **API endpoints**: `src/app/api/ask/route.ts` (chat), `src/app/api/generate/route.ts` (generation)
- **Database functions**: `src/lib/supabase.ts` (vector search)
- **LangChain pipeline**: `src/lib/langchain-pipeline.ts` (implemented but optional)

### User Preferences
- **Don't ask for metadata** - system extracts automatically
- **Don't make changes without understanding** - explore first, then act
- **Preserve working functionality** - system is production-ready
- **Test changes carefully** - has real data and users

### System Capabilities
- **Vector search**: Uses pgvector with OpenAI embeddings
- **Metadata extraction**: Automatic client/author/date/sector detection
- **Auto-tagging**: LLM-generated relevant tags
- **Deduplication**: SHA-256 hash checking
- **Multiple upload methods**: PowerShell, batch, direct CLI

## What NOT to Do
- ❌ Don't ask for client names - system auto-extracts
- ❌ Don't make changes without understanding current state
- ❌ Don't override working functionality
- ❌ Don't ignore this briefing document

## Common Tasks
- **Upload documents**: Use upload.ps1 with folder path only
- **Check system status**: Test API endpoints with curl/PowerShell
- **Query proposals**: Use chat interface or API directly
- **Add new features**: Understand existing architecture first

## Recent Major Changes
- Enhanced metadata extraction with canonical author matching
- Token-based chunking with semantic overlap
- LangChain pipeline implementation (optional)
- Improved error handling and debugging

## Environment
- **Database**: Supabase with pgvector extension
- **Embeddings**: OpenAI text-embedding-3-small
- **Development**: Windows 10, PowerShell, npm run dev
- **Production**: Working system with real proposal data

---
**Last Updated**: [Current Date]
**Status**: Production system - handle with care 