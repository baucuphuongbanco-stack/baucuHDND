
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wimauldqyotovflfowjw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9Mn89B57Bd8-CGY59sluIQ_SWhWmelE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function probeRpc() {
    console.log('Probing create_system_user RPC...');

    // Try with minimal parameters that match the signature
    const { data, error } = await supabase.rpc('create_system_user', {
        p_email: 'probe@test.com',
        p_password: 'password123',
        p_username: 'probe_user',
        p_full_name: 'Probe User',
        p_role: 'khach'
    });

    if (error) {
        console.error('RPC Probe Result:', error.message);
        console.error('Error Code:', error.code);
        console.error('Full Error:', JSON.stringify(error, null, 2));

        if (error.message.includes('not found') || error.code === 'PGS01' || error.message.includes('404')) {
            console.log('\nCONFIRMED: Function create_system_user is NOT visible to PostgREST.');
        }
    } else {
        console.log('SUCCESS: RPC create_system_user is reachable!');
        console.log('Result:', data);
    }
}

probeRpc();
