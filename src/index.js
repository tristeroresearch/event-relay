import { createClient } from '@supabase/supabase-js';
import { Server } from 'socket.io';
import http from 'http';

async function dispatchEvent(eventName, eventData, io) {
    console.log(`Server received event: ${eventName}`, eventData);
    io.emit(eventName, eventData);
}

function onInsert(tableName) {
    return { event: 'INSERT', schema: 'public', table: tableName };
}

function onUpdate(tableName) {
    return { event: 'UPDATE', schema: 'public', table: tableName };
}

async function main() {
    const { SUPABASE_DATA_URL, SUPABASE_DATA_KEY } = process.env;

    if (!SUPABASE_DATA_URL) {
        throw new Error('Missing SUPABASE_DATA_URL environment variable');
    }

    if (!SUPABASE_DATA_KEY) {
        throw new Error('Missing SUPABASE_DATA_KEY environment variable');
    }

    const supabaseData = createClient(SUPABASE_DATA_URL, SUPABASE_DATA_KEY);
    
    const { SUPABASE_APP_URL, SUPABASE_APP_KEY } = process.env;

    if (!SUPABASE_APP_URL) {
        throw new Error('Missing SUPABASE_APP_URL environment variable');
    }

    if (!SUPABASE_APP_KEY) {
        throw new Error('Missing SUPABASE_APP_KEY environment variable');
    }

    const supabaseApp = createClient(SUPABASE_APP_URL, SUPABASE_APP_KEY);

    const server = http.createServer();
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
    });

    supabaseData
        .channel('realtime')
        .on('postgres_changes', onInsert('order_placed'), payload => dispatchEvent('order_placed', payload.new, io))
        .on('postgres_changes', onInsert('match_created'), payload => dispatchEvent('match_created', payload.new, io))
        .on('postgres_changes', onInsert('match_executed'), payload => dispatchEvent('match_executed', payload.new, io))
        .on('postgres_changes', onInsert('swap_filled'), payload => dispatchEvent('swap_filled', payload.new, io))
        .subscribe();

    supabaseApp
        .channel('realtime')
        .on('postgres_changes', onInsert('cctp_transfers'), payload => dispatchEvent('cctp_transfers', payload.new, io))
        .on('postgres_changes', onUpdate('cctp_transfers'), payload => dispatchEvent('cctp_transfers', payload.new, io))
        .subscribe();

    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
        console.log(`Socket.io server listening on port ${PORT}`);
    });
}

main();