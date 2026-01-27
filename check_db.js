
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wimauldqyotovflfowjw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Mn89B57Bd8-CGY59sluIQ_SWhWmelE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPolicies() {
    console.log('Fetching policies for table "candidates"...');

    // We use query to check pg_policies
    const { data, error } = await supabase
        .from('candidates')
        .select('id')
        .limit(1);

    console.log('Testing simple select on candidates...');
    if (error) console.log('Select error (expected if RLS is on and no session):', error.message);
    else console.log('Select success (surprising if no session)');

    // To truly list policies without psql, we can try to run a query that might reveal them
    // or use a custom RPC if it exists. Since we don't have one, let's try to "force" another schema error 
    // to see if we can get more info, OR just provide the user with a cleaner script.

    // Actually, let's try to query pg_policies via a generic select if allowed (unlikely)
    const { data: pols, error: polErr } = await supabase
        .from('pg_policies')
        .select('*');

    if (polErr) {
        console.log('Cannot query pg_policies directly via REST API (Standard behavior).');
    }

    console.log('\n--- RECOMMENDATION ---');
    console.log('The error "already exists" usually means the DROP statement failed or was skipped.');
    console.log('I will provide a script that uses a DO block to drop policies more safely.');
}

checkPolicies();
