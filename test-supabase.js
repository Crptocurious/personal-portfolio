require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function testConnection() {
    try {
        // Test basic connection
        console.log('Testing Supabase connection...');
        const { data: test, error: testError } = await supabase
            .from('page_views')
            .select('*')
            .limit(1);

        if (testError) {
            console.error('Error connecting to page_views table:', testError);
            return;
        }

        console.log('Successfully connected to Supabase!');

        // Test table structure
        console.log('\nTesting page_views table...');
        const { data, error } = await supabase
            .from('page_views')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Error querying page_views:', error);
            return;
        }

        console.log('Current records in page_views table:', data);

        // Test inserting a test record
        console.log('\nTesting insert operation...');
        const testUrl = 'test-url-' + Date.now();
        const { data: insertData, error: insertError } = await supabase
            .from('page_views')
            .insert([{ url: testUrl, view_count: 1 }])
            .select();

        if (insertError) {
            console.error('Error inserting test record:', insertError);
            return;
        }

        console.log('Successfully inserted test record:', insertData);

        // Clean up test record
        await supabase
            .from('page_views')
            .delete()
            .eq('url', testUrl);

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

testConnection(); 