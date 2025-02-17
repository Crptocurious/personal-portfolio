require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Configure CORS for both development and production
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://abhishekanand.me',  // Add your production domain
    'https://www.abhishekanand.me',  // Add www subdomain if needed
    'https://personal-portfolio-crptocurious.vercel.app',  // Updated Vercel URL
    'https://personal-portfolio-git-main-crptocurious.vercel.app',
    'https://personal-portfolio-api-nine.vercel.app'
];

console.log('Allowed origins:', allowedOrigins);

app.use(cors({
    origin: function(origin, callback) {
        console.log('Request origin:', origin);
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            console.error('CORS error:', { origin, allowedOrigins });
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Verify Supabase connection on startup
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('page_views').select('count(*)', { count: 'exact' });
        if (error) throw error;
        console.log('Successfully connected to Supabase');
    } catch (error) {
        console.error('Error connecting to Supabase:', error);
    }
}

testSupabaseConnection();

// Get view count for a specific URL
app.get('/api/views/:url', async (req, res) => {
    const url = decodeURIComponent(req.params.url);
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
app.post('/api/views/:url', async (req, res) => {
    const url = decodeURIComponent(req.params.url);
    console.log('Incrementing view count for URL:', url);
    
    try {
        // First try to update existing record
        const { data: existingData, error: selectError } = await supabase
            .from('page_views')
            .select('view_count')
            .eq('url', url)
            .single();

        console.log('Existing data:', existingData, 'Select error:', selectError);

        if (selectError && selectError.code !== 'PGRST116') {
            console.error('Error checking existing record:', selectError);
            throw selectError;
        }

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