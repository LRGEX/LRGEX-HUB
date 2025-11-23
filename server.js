const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for large backups
app.use(express.json({ limit: '50mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
    // Filter out internal/static noise if needed, but useful for debug
    if (req.path.startsWith('/api')) {
        console.log(`[${req.method}] ${req.path}`);
    }
    next();
});

// Directory Structure
const CONFIG_DIR = path.join(__dirname, 'config');
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');

// Ensure directories exist
[CONFIG_DIR, BACKUPS_DIR].forEach(dir => {
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