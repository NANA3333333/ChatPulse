// Existing table definitions. Column defaults and schema order are compatibility contracts.
module.exports = {
    group_red_packets: `CREATE TABLE IF NOT EXISTS group_red_packets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'lucky',
            total_amount REAL NOT NULL,
            per_amount REAL,
            count INTEGER NOT NULL,
            remaining_count INTEGER NOT NULL,
            amounts TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at INTEGER NOT NULL
        );

        `,
    group_red_packet_claims: `CREATE TABLE IF NOT EXISTS group_red_packet_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            packet_id INTEGER NOT NULL,
            claimer_id TEXT NOT NULL,
            amount REAL NOT NULL,
            claimed_at INTEGER NOT NULL,
            UNIQUE(packet_id, claimer_id)
        );

        `,
    private_transfers: `CREATE TABLE IF NOT EXISTS private_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            char_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            recipient_id TEXT NOT NULL,
            amount REAL NOT NULL,
            note TEXT DEFAULT '',
            claimed INTEGER DEFAULT 0,
            claimed_at INTEGER,
            message_id INTEGER,
            created_at INTEGER NOT NULL
        );
    `
};
