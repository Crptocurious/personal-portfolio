require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    next();
});

// Configure CORS for both development and production
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    'https://abhishekanand.me',
    'https://www.abhishekanand.me',
    'https://personal-portfolio-crptocurious.vercel.app',
    'https://personal-portfolio-git-main-crptocurious.vercel.app',
    'https://personal-portfolio-api-crptocurious.vercel.app',
    'https://crptocurious.github.io'
];

console.log('Configured allowed origins:', allowedOrigins);

app.use(cors({
    origin: function(origin, callback) {
        console.log('Incoming request from origin:', origin);
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('No origin header, allowing request');
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            console.error('CORS error:', { origin, allowedOrigins });
            return callback(new Error(msg), false);
        }

        console.log('Origin allowed:', origin);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Function to decode URL key
function decodeUrlKey(urlKey) {
    try {
        // First try base64 decoding
        const base64 = urlKey.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
        const decoded = Buffer.from(padded, 'base64').toString();
        // Then decode the URI component
        return decodeURIComponent(decoded);
    } catch (error) {
        console.error('Error decoding URL key:', error);
        try {
            // Fallback to just URI decoding
            return decodeURIComponent(urlKey);
        } catch (error) {
            console.error('Error decoding URL key (fallback):', error);
            return null;
        }
    }
}

// Add debug endpoint
app.get('/debug/url/:urlKey', (req, res) => {
    const urlKey = req.params.urlKey;
    const decoded = decodeUrlKey(urlKey);
    res.json({
        original: urlKey,
        decoded: decoded,
        isValid: decoded !== null
    });
});

// Add a health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'API is running' });
});

// Get view count for a specific URL
app.get('/api/views/:urlKey', async (req, res) => {
    const urlKey = req.params.urlKey;
    const url = decodeUrlKey(urlKey);
    
    if (!url) {
        return res.status(400).json({ error: 'Invalid URL key' });
    }
    
    console.log('Getting view count for URL:', url);
    
    try {
        const { data, error } = await supabase
            .from('page_views')
            .select('view_count')
            .eq('url', url)
            .single();

        if (error) {
            console.error('Supabase error fetching view count:', error);
            throw error;
        }
        
        console.log('View count data:', data);
        res.json({ views: data ? data.view_count : 0 });
    } catch (error) {
        console.error('Error fetching view count:', error);
        res.status(500).json({ error: 'Failed to fetch view count', details: error.message });
    }
});

// Increment view count for a specific URL
app.post('/api/views/:urlKey', async (req, res) => {
    const urlKey = req.params.urlKey;
    const url = decodeUrlKey(urlKey);
    
    if (!url) {
        return res.status(400).json({ error: 'Invalid URL key' });
    }
    
    console.log('Incrementing view count for URL:', url);
    
    try {
        // First try to update existing record
        const { data: existingData, error: selectError } = await supabase
            .from('page_views')
            .select('view_count')
            .eq('url', url)
            .single();

        console.log('Existing data:', existingData, 'Select error:', selectError);

        let result;
        if (existingData) {
            // Update existing record
            console.log('Updating existing record');
            const { data, error } = await supabase
                .from('page_views')
                .update({ view_count: existingData.view_count + 1 })
                .eq('url', url)
                .select()
                .single();

            if (error) {
                console.error('Error updating record:', error);
                throw error;
            }
            result = data;
        } else {
            // Insert new record
            console.log('Inserting new record');
            const { data, error } = await supabase
                .from('page_views')
                .insert([{ url, view_count: 1 }])
                .select()
                .single();

            if (error) {
                console.error('Error inserting record:', error);
                throw error;
            }
            result = data;
        }

        console.log('Operation result:', result);
        res.json({ views: result.view_count });
    } catch (error) {
        console.error('Error updating view count:', error);
        res.status(500).json({ error: 'Failed to update view count', details: error.message });
    }
});

const startServer = async (retries = 5) => {
    const PORT = process.env.PORT || 3000;
    
    try {
        await new Promise((resolve, reject) => {
            const server = app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
                resolve();
            });

            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.log(`Port ${PORT} is busy, trying ${PORT + 1}...`);
                    server.close();
                    process.env.PORT = PORT + 1;
                    if (retries > 0) {
                        startServer(retries - 1);
                    } else {
                        console.error('No available ports found after multiple retries');
                        process.exit(1);
                    }
                } else {
                    console.error('Server error:', error);
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();