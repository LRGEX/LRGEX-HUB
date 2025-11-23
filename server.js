const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limit for large backups
app.use(express.json({ limit: '50mb' }));

// Directory Structure:
// /app/config/          -> Stores config.json (Active State)
// /app/config/backups/  -> Stores backup-*.json files
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

// --- API Routes ---

// GET /api/config - Load persistent configuration
app.get('/api/config', (req, res) => {
    if (fs.existsSync(CONFIG_FILE)) {
        fs.readFile(CONFIG_FILE, 'utf8', (err, data) => {
            if (err) {
                console.error("Error reading config file:", err);
                return res.status(500).json({ error: 'Failed to read config' });
            }
            
            // Handle empty file case
            if (!data || data.trim() === "") {
                return res.json({});
            }

            try {
                const json = JSON.parse(data);
                res.json(json);
            } catch (e) {
                console.error("Config file corrupted:", e);
                // Return empty object so app loads defaults instead of crashing
                res.json({}); 
            }
        });
    } else {
        res.json({}); // No config exists yet, return empty object
    }
});

// POST /api/config - Save persistent configuration
app.post('/api/config', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    fs.writeFile(CONFIG_FILE, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error("Error writing config file:", err);
            return res.status(500).json({ error: 'Failed to save config' });
        }
        res.json({ success: true });
    });
});

// GET /api/backups - List all backup files
app.get('/api/backups', (req, res) => {
    fs.readdir(BACKUPS_DIR, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Unable to scan directory' });
        }
        
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const stats = fs.statSync(path.join(BACKUPS_DIR, file));
                return {
                    name: file,
                    created: stats.birthtime
                };
            })
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()); // Newest first

        res.json(backupFiles);
    });
});

// POST /api/backups - Save a new backup
app.post('/api/backups', (req, res) => {
    const data = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to write file' });
        }
        console.log(`Backup saved: ${filename}`);
        res.json({ success: true, filename });
    });
});

// GET /api/backups/:filename - Restore/Read a specific backup
app.get('/api/backups/:filename', (req, res) => {
    const filename = req.params.filename;
    // Basic directory traversal protection
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ error: 'File not found' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: 'Invalid JSON in backup file' });
        }
    });
});

// Serve static files (excluding index.html to prevent raw serving)
app.use(express.static(__dirname, { index: false }));

// Handle SPA routing and Env Injection
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Error loading app');
        }

        // Inject environment variables at runtime
        // This allows Docker env vars to be passed to the client browser
        const envScript = `
        <script>
            window.env = {
                API_KEY: "${process.env.API_KEY || ''}"
            };
        </script>
        `;

        const finalHtml = htmlData.replace('<!-- ENV_INJECTION_PLACEHOLDER -->', envScript);
        res.send(finalHtml);
    });
});

app.listen(PORT, () => {
    console.log(`LRGEX HUB Server running on port ${PORT}`);
    console.log(`Config Directory: ${CONFIG_DIR}`);
    console.log(`Backups Directory: ${BACKUPS_DIR}`);
});