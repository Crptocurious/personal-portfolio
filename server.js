require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Get view count for a specific URL
app.get('/api/views/:url', async (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        const { data, error } = await supabase
            .from('page_views')
            .select('view_count')
            .eq('url', url)
            .single();

        if (error) throw error;
        res.json({ views: data ? data.view_count : 0 });
    } catch (error) {
        console.error('Error fetching view count:', error);
        res.status(500).json({ error: 'Failed to fetch view count' });
    }
});

// Increment view count for a specific URL
app.post('/api/views/:url', async (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        
        // First try to update existing record
        const { data: existingData, error: selectError } = await supabase
            .from('page_views')
            .select('view_count')
            .eq('url', url)
            .single();

        if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "not found" error
            throw selectError;
        }

        if (existingData) {
            // Update existing record
            const { data, error } = await supabase
                .from('page_views')
                .update({ view_count: existingData.view_count + 1 })
                .eq('url', url)
                .select()
                .single();

            if (error) throw error;
            res.json({ views: data.view_count });
        } else {
            // Insert new record
            const { data, error } = await supabase
                .from('page_views')
                .insert([{ url, view_count: 1 }])
                .select()
                .single();

            if (error) throw error;
            res.json({ views: data.view_count });
        }
    } catch (error) {
        console.error('Error updating view count:', error);
        res.status(500).json({ error: 'Failed to update view count' });
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