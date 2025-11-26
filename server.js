const express = require('express');
const fs = require('fs');
const path = require('path');

// Disable SSL validation to allow connecting to self-signed certs (Proxmox, Portainer, etc.)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for large backups
app.use(express.json({ limit: '50mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
    // Filter out internal/static noise if needed, but useful for debug
    if (req.path.startsWith('/api')) {
        console.log(`[${new Date().toISOString()}] [${req.method}] ${req.path}`);
    }
    next();
});

// Directory Structure
const CONFIG_DIR = path.join(__dirname, 'config');
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');
const CHATS_DIR = path.join(CONFIG_DIR, 'chats');

// Ensure directories exist
[CONFIG_DIR, BACKUPS_DIR, CHATS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        } catch (e) {
            console.error(`Failed to create directory ${dir}: ${e.message}`);
        }
    }
});

const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Check bundle existence
const bundlePath = path.join(__dirname, 'bundle.js');
if (fs.existsSync(bundlePath)) {
    console.log(`[Startup] bundle.js found (${fs.statSync(bundlePath).size} bytes)`);
} else {
    console.error(`[Startup] WARNING: bundle.js NOT FOUND at ${bundlePath}`);
}

// --- API Router ---
const api = express.Router();

// GET /api/config
api.get('/config', (req, res) => {
    if (fs.existsSync(CONFIG_FILE)) {
        fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error("Error reading config:", err);
                return res.status(500).json({ error: 'Failed to read config' });
            }
            if (!data || data.trim() === "") return res.json({});
            try {
                res.json(JSON.parse(data));
            } catch (e) {
                console.error("Config corrupted, returning empty:", e);
                res.json({});
            }
        });
    } else {
        res.json({});
    }
});

// POST /api/config
api.post('/config', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    fs.writeFile(CONFIG_FILE, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Error writing config:", err);
            return res.status(500).json({ error: 'Failed to save config' });
        }
        res.json({ success: true });
    });
});

// GET /api/backups
api.get('/backups', (req, res) => {
    fs.readdir(BACKUPS_DIR, (err, files) => {
        if (err) {
            console.error("Error listing backups:", err);
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const stats = fs.statSync(path.join(BACKUPS_DIR, file));
                return { name: file, created: stats.birthtime };
            })
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        res.json(backupFiles);
    });
});

// POST /api/backups
api.post('/backups', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Error saving backup:", err);
            return res.status(500).json({ error: 'Failed to write file' });
        }
        console.log(`Backup saved: ${filename}`);
        res.json({ success: true, filename });
    });
});

// GET /api/backups/:filename
api.get('/backups/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/')) return res.status(400).json({ error: 'Invalid filename' });
    const filePath = path.join(BACKUPS_DIR, filename);
    
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Error reading file' });
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Invalid JSON' });
        }
    });
});

// GET /api/chats/:id - Get messages for a specific chat
api.get('/chats/:id', (req, res) => {
    const chatId = req.params.id;
    if (chatId.includes('..') || chatId.includes('/')) {
        return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chatFile = path.join(CHATS_DIR, `${chatId}.json`);

    if (!fs.existsSync(chatFile)) {
        return res.status(404).json({ error: 'Chat not found' });
    }

    fs.readFile(chatFile, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading chat ${chatId}:`, err);
            return res.status(500).json({ error: 'Failed to read chat' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            console.error(`Chat ${chatId} corrupted:`, e);
            res.status(500).json({ error: 'Chat file corrupted' });
        }
    });
});

// POST /api/chats/:id - Save/update messages for a specific chat
api.post('/chats/:id', (req, res) => {
    const chatId = req.params.id;
    if (chatId.includes('..') || chatId.includes('/')) {
        return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chatData = req.body;
    if (!chatData || !chatData.messages) {
        return res.status(400).json({ error: 'Invalid chat data' });
    }

    const chatFile = path.join(CHATS_DIR, `${chatId}.json`);

    fs.writeFile(chatFile, JSON.stringify(chatData, null, 2), (err) => {
        if (err) {
            console.error(`Error saving chat ${chatId}:`, err);
            return res.status(500).json({ error: 'Failed to save chat' });
        }
        res.json({ success: true });
    });
});

// DELETE /api/chats/:id - Delete a chat's messages
api.delete('/chats/:id', (req, res) => {
    const chatId = req.params.id;
    if (chatId.includes('..') || chatId.includes('/')) {
        return res.status(400).json({ error: 'Invalid chat ID' });
    }

    const chatFile = path.join(CHATS_DIR, `${chatId}.json`);

    if (!fs.existsSync(chatFile)) {
        return res.json({ success: true }); // Already deleted
    }

    fs.unlink(chatFile, (err) => {
        if (err) {
            console.error(`Error deleting chat ${chatId}:`, err);
            return res.status(500).json({ error: 'Failed to delete chat' });
        }
        res.json({ success: true });
    });
});

// POST /api/proxy - Bypass CORS
api.post('/proxy', async (req, res) => {
    const { url, method = 'GET', headers = {}, body } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Missing target URL' });
    }

    try {
        console.log(`[Proxy Request] ${method} ${url}`);
        
        // Validate URL
        let targetUrlObj;
        try {
            targetUrlObj = new URL(url);
        } catch (e) {
            console.error(`[Proxy] Invalid URL provided: ${url}`);
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Prepare Body: Pass string as string, stringify object
        let fetchBody = body;
        if (body && typeof body === 'object') {
            fetchBody = JSON.stringify(body);
        }

        // Prepare Headers: Clean restricted headers
        const safeHeaders = { ...headers };
        const restrictedHeaders = ['host', 'content-length', 'connection'];
        restrictedHeaders.forEach(h => delete safeHeaders[h]);

        // Auto-Inject Origin/Referer if missing to bypass strict CSRF checks (Proxmox, qBittorrent, etc.)
        if (!safeHeaders['Origin'] && !safeHeaders['origin']) {
            safeHeaders['Origin'] = targetUrlObj.origin;
        }
        if (!safeHeaders['Referer'] && !safeHeaders['referer']) {
            safeHeaders['Referer'] = targetUrlObj.origin + '/';
        }
        // Inject User-Agent if missing (some APIs block unknown agents)
        if (!safeHeaders['User-Agent'] && !safeHeaders['user-agent']) {
            safeHeaders['User-Agent'] = 'Mozilla/5.0 (LRGEX-HUB-Proxy)';
        }

        // Forward the request
        let response;
        try {
            response = await fetch(url, {
                method,
                headers: safeHeaders,
                body: fetchBody
            });
        } catch (networkError) {
            console.error(`[Proxy Network Fail] ${url}`, networkError);
            if (networkError.cause) {
                console.error(`[Proxy Cause]`, networkError.cause);
            }
            return res.status(502).json({ 
                error: 'Network Error - Could not reach target', 
                details: networkError.message,
                cause: networkError.cause ? String(networkError.cause) : undefined
            });
        }

        const responseText = await response.text();

        // Log if the remote server returned an error status
        if (!response.ok) {
            console.warn(`[Proxy Remote Error] Status: ${response.status} from ${url}`);
        }

        // Forward Response Headers (Critical for Auth/Cookies)
        response.headers.forEach((val, key) => {
            // Skip headers that might conflict with Node/Express response handling
            if (['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                return;
            }
            res.setHeader(key, val);
            
            // CRITICAL: Copy Set-Cookie to X-Set-Cookie
            // Browsers hide standard Set-Cookie headers from JavaScript fetch responses.
            // We expose it via a custom header so the widget can read the SID/Token.
            if (key.toLowerCase() === 'set-cookie') {
                res.setHeader('X-Set-Cookie', val);
            }
        });

        // Forward status
        res.status(response.status);
        
        // Try to return JSON if possible (and if not already handled by setHeader content-type)
        try {
            const json = JSON.parse(responseText);
            res.json(json);
        } catch (e) {
            // Fallback to text if not JSON
            res.send(responseText);
        }

    } catch (error) {
        console.error(`[Proxy Internal Error] ${error.message}`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Mount API Router
app.use('/api', api);

// Serve bundle.js explicitly
app.get('/bundle.js', (req, res) => {
    if (fs.existsSync(bundlePath)) res.sendFile(bundlePath);
    else res.status(404).send('bundle.js missing');
});

// Serve static assets
app.use(express.static(path.join(__dirname), { index: false }));

// SPA Fallback
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading app');
        }
        const envScript = `
        <script>
            window.env = { API_KEY: "${process.env.API_KEY || ''}" };
        </script>`;
        res.send(htmlData.replace('<!-- ENV_INJECTION_PLACEHOLDER -->', envScript));
    });
});

app.listen(PORT, () => {
    console.log(`LRGEX HUB Server running on port ${PORT}`);
    console.log(`Config Directory: ${CONFIG_DIR}`);
});