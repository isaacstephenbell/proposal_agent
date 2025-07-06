# AI Assistant Briefing - Isaac's Proposal System

## CRITICAL: Read This First
This document contains 3 months of development decisions and workflows. NEVER ignore or override these without explicit permission.

## System Overview
- **Current State**: Production-ready intelligent proposal assistant with 8 major enhancements
- **Upload System**: Automated metadata extraction using LLM - NO manual client specification needed
- **Architecture**: Next.js 14 + TypeScript + Supabase + OpenAI embeddings
- **User Interface**: 3-tab navigation (Discovery Chat, Thought Partner, Proposal Generator)
- **Database Status**: 8 real proposals successfully uploaded (MGT, PowerParts, Crux Capital, etc.)

## Major Enhancement Features (Implemented)

### 1. Proactive Follow-up Suggestions
- **Context-aware AI suggestions** appear after each response
- **Clickable buttons** auto-populate chat input
- **Smart suggestion generation** based on query type and results
- **Multi-dimensional suggestions**: client focus, author exploration, sector analysis

### 2. Metadata Confidence Indicators
- **Visual confidence dots** (green/yellow/red) for all metadata fields
- **Confidence legend** with clear explanations
- **Calculated confidence scores** based on extraction patterns
- **Audit mode toggle** for detailed confidence percentages

### 3. Transparent Filter Explainability
- **Filter badges** show exactly what was applied ("Client: MGT", "Context: followup")
- **Query enhancement indicators** show when queries are modified
- **Applied filters display** with full transparency about result selection
- **Context retention indicators** show when maintaining client focus

### 4. Proposal Snippet Previews
- **Contextual snippet extraction** shows relevant excerpts matching query intent
- **Italicized quote display** of most relevant content sections
- **Smart snippet generation** based on query keywords and content analysis

### 5. Ambiguity Detection + Clarification
- **Detects ambiguous terms**: OEM, consulting, management, development
- **Asks for clarification** before returning potentially irrelevant results
- **Prevents poor search results** by ensuring query clarity

### 6. Automatic Duplicate Detection
- **Comprehensive detection system** using file hashes and content similarity
- **Upload-time prevention** (95%+ blocks, 85%+ warns)
- **Search-time duplicate warnings** with similarity percentages
- **Smart logic** distinguishes between duplicates and revisions

### 7. Learning from Corrections
- **Edit-in-place functionality** for any metadata field (client, author, date, sector)
- **Persistent storage** in corrections.json
- **Auto-application** to future similar documents
- **Correction API endpoint** for seamless user experience

### 8. Context Retention System
- **Smart conversation state management** maintains client focus across queries
- **Auto-detects explicit vs implicit context** in follow-up questions
- **Query enhancement** with previous context when appropriate
- **Filter transparency** shows when context is applied

## New Thought Partner Mode

### 5-Step Strategic Thinking Flow
1. **Goals Selection**: Multiple choice + custom options (workforce planning, operational efficiency, etc.)
2. **Audience Identification**: Target stakeholders with custom options
3. **Challenges/Constraints**: Open text for specific considerations
4. **Smart Recommendations**: AI-powered suggestions from historical proposals
5. **Summary & Handoff**: Complete brief with seamless transition to Proposal Generator

### Visual Progress Indicators
- **Progress bars** show completion percentage
- **Step indicators** with current position
- **Color-coded navigation** (purple theme for Thought Partner)

## Core Workflows

### Document Upload Process
1. **Command**: `.\upload.ps1 -FolderPath "PATH" -ClientName "Auto-Extract"`
2. **System automatically extracts**: Client, Author, Date, Sector from document content
3. **Auto-generates tags** using LLM analysis
4. **Duplicate detection** prevents redundant uploads
5. **Never ask for client names** - the system determines this from document content
6. **Supported formats**: .docx, .txt, .md, .pdf

### Enhanced Chat Experience
- **Context-aware responses** maintain conversation flow
- **Proactive suggestions** guide user exploration
- **Metadata editing** allows real-time corrections
- **Audit mode** provides transparency for debugging
- **Filter explanations** show exactly what was applied

### Key File Locations
- **Main interface**: `src/app/page.tsx` (3-tab navigation with all enhancements)
- **Enhanced API**: `src/app/api/ask/route.ts` (context retention, suggestions, filters)
- **Corrections API**: `src/app/api/corrections/route.ts` (learning system)
- **Types**: `src/lib/types.ts` (comprehensive interfaces)
- **Duplicate Detection**: `src/lib/duplicate-detector.ts` (comprehensive prevention)
- **Upload scripts**: `upload.ps1` (main), `bulk-upload.ts` (core)

### User Interface Features
- **3-Tab Navigation**: Discovery Chat (blue), Thought Partner (purple), Proposal Generator (green)
- **Context Indicators**: Show when focusing on specific clients
- **Confidence Indicators**: Visual dots showing metadata reliability
- **Filter Badges**: Transparent display of applied search filters
- **Edit-in-Place**: Click to edit any metadata field
- **Proactive Suggestions**: Clickable follow-up questions

## Technical Implementation Details

### Context Retention
- **Smart client detection** from explicit mentions vs. implicit context
- **Follow-up query recognition** maintains previous conversation state
- **Query enhancement** adds context when appropriate
- **Filter transparency** shows what was applied and why

### Duplicate Prevention
- **File hash comparison** for exact matches
- **Content similarity analysis** using word overlap algorithms
- **Threshold-based decisions** (95%+ blocks, 85%+ warns)
- **Upload-time and search-time detection**

### Learning System
- **Correction storage** in corrections.json
- **Pattern-based application** to similar documents
- **Real-time UI updates** after corrections
- **Persistent learning** across sessions

### User Preferences
- **Don't ask for metadata** - system extracts automatically
- **Don't make changes without understanding** - explore first, then act
- **Preserve working functionality** - system is production-ready
- **Test changes carefully** - has real data and users
- **Maintain enhancement features** - all 8 major improvements are production-ready

## System Status
- **Database**: 8 real proposals successfully uploaded
- **Clients**: MGT, PowerParts, Crux Capital, U.S. Chamber, Baton Rouge Youth Coalition
- **Enhancement Status**: All 8 major features fully implemented and tested
- **Performance**: 2-6 second response times including LLM processing
- **Reliability**: Context retention and duplicate detection working perfectly

## What NOT to Do
- ❌ Don't ask for client names - system auto-extracts
- ❌ Don't make changes without understanding current state
- ❌ Don't override working functionality
- ❌ Don't ignore this briefing document
- ❌ Don't assume .env.local issues - system works perfectly

## Common Tasks
- **Upload documents**: Use upload.ps1 with folder path only
- **Chat with context**: System maintains conversation flow automatically
- **Edit metadata**: Click edit icon next to any field
- **Enable audit mode**: Check box for detailed confidence info
- **Use Thought Partner**: 5-step guided strategic thinking
- **Generate proposals**: Enhanced with historical context

## Recent Major Changes
- **8 comprehensive enhancements** transforming basic search into intelligent assistant
- **Complete UI overhaul** with 3-tab navigation and modern design
- **Context retention system** for natural conversation flow
- **Duplicate detection** preventing redundant content
- **Learning from corrections** with persistent memory
- **Thought Partner mode** for strategic proposal planning

## Environment
- **Database**: Supabase with pgvector extension
- **Embeddings**: OpenAI text-embedding-3-small
- **Development**: Windows 10, PowerShell, npm run dev (port 3001)
- **Production**: Working system with real proposal data and enhanced features

---
**Last Updated**: December 2024
**Status**: Production-ready intelligent proposal assistant with comprehensive enhancements 