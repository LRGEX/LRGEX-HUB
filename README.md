<div align="center">
  <img src="https://download.lrgex.com/Dark%20Full%20Logo.png" alt="LRGEX Logo" width="300">

  # LRGEX HUB

  **Version 1.0.0**

</div>

## Description

LRGEX HUB is a customizable dashboard application for managing web apps, widgets, and bookmarks. It features an integrated AI assistant supporting multiple providers (Gemini, OpenAI, OpenRouter, and Ollama) that can modify the dashboard through tool calls. The application uses a dual-server architecture with Vite for development and Express for production.

## Features

- **Dashboard Management**: Organize widgets, bookmarks, and web applications in a drag-and-drop grid layout
- **AI Assistant**: Integrated chat with support for Gemini, OpenAI, OpenRouter, and Ollama
- **Tool Execution**: AI can modify dashboard via tool calls (add widgets, bookmarks, web apps)
- **Custom Code Widgets**: Execute user-provided React code with `React.createElement` syntax
- **Multiple Widget Types**: Custom code, weather, Proxmox, Sabnzbd, Universal JSON API fetcher
- **CORS Proxy**: Built-in proxy for widgets to fetch from external APIs
- **Backup System**: Manual and scheduled backups with restore functionality
- **Persistent Configuration**: Auto-saves to server every 1 second (debounced)
- **Responsive Design**: CSS Grid layout with responsive column spans (1-4 columns)
- **Section Ordering**: Drag-and-drop section reordering
- **Dark Mode**: Full dark mode support throughout the interface

## Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/LRGEX/LRGEX-HUB.git
   cd LRGEX-HUB
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   Create `.env.local` in the project root with your API key:
   ```
   GEMINI_API_KEY=your_key_here
   ```

## Usage

### Development Mode

Run the Vite dev server with hot module replacement:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`

### Production Mode

Build the application bundle:
```bash
npm run build
```

Start the Express production server:
```bash
npm start
```
The application will be available at `http://localhost:3000`

## Requirements

- **Node.js**: >= 18.0.0
- **Operating System**: Windows, Linux, macOS
- **API Key**: Gemini API key (or other supported AI provider)
- **Browser**: Modern browser with JavaScript and CSS Grid support

## Architecture

### Dual Server Setup

- **Development**: Vite dev server on port 3000 with HMR
- **Production**: Express server serving bundled files

### Express Server Endpoints

- `/` - Static file serving
- `/api/config` - Persistent configuration storage (JSON file)
- `/api/backups` - Backup/restore functionality
- `/api/proxy` - CORS proxy for widgets

### State Management

Single `AppData` object stored in `App.tsx` containing widgets, categories, web apps, AI settings, templates, general settings, backup settings, section order, and section visibility.

### Component Structure

```
App.tsx (main state container)
├── components/
│   ├── widgets/
│   │   ├── CustomCodeWidget.tsx
│   │   ├── GeminiWidget.tsx
│   │   ├── UniversalWidget.tsx
│   │   └── [Specialized widgets]
│   ├── WidgetWrapper.tsx
│   ├── LinkGroup.tsx
│   └── WebAppCard.tsx
├── services/
│   ├── aiService.ts
│   └── backupService.ts
└── types.ts
```

## License

This project is part of the LRGEX ecosystem. Contact LRGEX for licensing information.

## Contributing

Contributions are welcome. Please ensure all code follows LRGEX Guidelines:

- No emojis in code or documentation
- All functions documented with Synopsis, Parameters, Returns
- Comprehensive error handling
- Input validation at entry points
- Clear, professional code with descriptive naming

For detailed guidelines, refer to the LRGEX-Global-Guidelines.md document.
