# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LRGEX HUB is a customizable dashboard application for managing web apps, widgets, and bookmarks. It features an integrated AI assistant (supporting Gemini, OpenAI, OpenRouter, and Ollama) that can modify the dashboard through tool calls.

## Development Commands

```bash
# Install dependencies
npm install

# Development (Vite dev server)
npm run dev

# Production build
npm run build

# Production server
npm start
```

**Environment Setup:**
- Create `.env.local` with `GEMINI_API_KEY=your_key_here`
- The API key is injected at runtime via server-side environment variable substitution

## Architecture

### Dual Server Setup

The app uses **two different servers** depending on the mode:

1. **Development (Vite)**: `npm run dev` runs Vite dev server on port 3000 with HMR
2. **Production (Express)**: `npm start` runs Express server serving bundled files

The **Express server** (`server.js`) provides:
- Static file serving
- `/api/config` - Persistent configuration storage (JSON file)
- `/api/backups` - Backup/restore functionality
- `/api/proxy` - CORS proxy for widgets to fetch from external APIs
- Environment variable injection into HTML

### State Management

The entire application state lives in `App.tsx` as a single `AppData` object that includes:
- `widgets` - Dashboard widgets (custom code, weather, proxmox, etc.)
- `categories` - Bookmark link groups
- `webApps` - Application cards organized by tabs/categories
- `aiSettings` - AI provider configuration
- `templates` - Saved widget configurations
- `generalSettings` - Timezone, layout, default tabs
- `backupSettings` - Auto-backup schedule
- `sectionOrder` - Drag-and-drop section ordering
- `sectionVisibility` - Show/hide sections

**Persistence:** Auto-saves to server every 1 second (debounced) via `/api/config`

### Component Structure

```
App.tsx (main state container)
├── components/
│   ├── widgets/
│   │   ├── CustomCodeWidget.tsx - Executes user-provided React code
│   │   ├── GeminiWidget.tsx - AI chat sidebar with tool execution
│   │   ├── UniversalWidget.tsx - Generic JSON API fetcher
│   │   └── [Specialized widgets: Weather, Proxmox, Sabnzbd]
│   ├── WidgetWrapper.tsx - Drag/resize/delete wrapper
│   ├── LinkGroup.tsx - Bookmark categories
│   ├── WebAppCard.tsx - Application cards
│   └── [Modal components]
├── services/
│   ├── aiService.ts - Multi-provider AI integration with tool calling
│   ├── backupService.ts - Backup export/download
│   └── geminiService.ts - (Legacy, check if still used)
└── types.ts - TypeScript definitions
```

### AI Tool System

The AI assistant (`services/aiService.ts`) operates in two modes:
- **COMMANDER**: Can modify dashboard via tool calls (`addWidget`, `addBookmark`, `addWebApp`)
- **ASSISTANT**: Chat-only mode without modification tools

**Custom Code Widgets:**
- User/AI-provided JavaScript is executed in `CustomCodeWidget.tsx`
- Code runs in function component body with globals: `React`, `useState`, `useEffect`, `useRef`, `Lucide`, `proxyFetch`
- Uses `customData` prop for persistent configuration storage (survives reload)
- **Critical:** No JSX allowed - must use `React.createElement` syntax
- Error boundary catches crashes and offers "Fix Code" button to send error + code to AI

**CORS Proxy:**
- Widgets use `proxyFetch()` instead of `fetch()` to bypass CORS
- Server routes requests through `/api/proxy` with proper headers injected

### CSS Grid Layout

Widgets and bookmarks use **CSS Grid** with responsive column spans:
- Mobile: 1 column
- Medium (md): 2 columns
- Large (lg): 3 columns
- XLarge (xl): 4 columns

Rows use `auto-rows-[180px]` with `row-span-{h}` for vertical sizing.

Web Apps section uses a **fixed card grid** with 160px card height.

### Infinite Render Loop Detection

`CustomCodeWidget.tsx` tracks render frequency:
- If renders exceed **170 per second**, shows error
- Common cause: Defining React components inside render body (recreates on every render)
- Solution: Move helper components outside or use plain variables

## Common Patterns

**Adding a new widget type:**
1. Add enum to `WidgetType` in `types.ts`
2. Create widget component in `components/widgets/`
3. Add case in `App.tsx` `renderWidgetContent()`
4. Update AI tool definitions in `aiService.ts` if needed

**Modifying AI behavior:**
- Edit `getSystemPrompt()` in `aiService.ts`
- Tool definitions at top of `aiService.ts`
- Tool executors passed from `App.tsx` via callbacks

**Backup system:**
- Manual backup via UI downloads JSON file
- Server-side backups saved to `config/backups/` directory
- Scheduled backups run every hour/day/week based on settings

## Important Notes

- **SSL Validation Disabled:** `server.js` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` to allow self-signed certs (Proxmox, etc.)
- **No build errors allowed:** Build must succeed (`npm run build`) before committing
- **React StrictMode:** Enabled in `index.tsx` - components mount twice in dev mode
- **Recent fixes:** Infinite render loop threshold adjusted to 170/sec (see recent commits)
