const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

try {
    require(path.join(root, 'server', 'node_modules', 'dotenv')).config({
        path: path.join(root, 'server', '.env')
    });
} catch (_) { }

const Database = require(path.join(root, 'server', 'node_modules', 'better-sqlite3'));
const { pipeline } = require(path.join(root, 'server', 'node_modules', '@xenova', 'transformers'));
const qdrant = require(path.join(root, 'server', 'qdrant'));

const LOCAL_EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || 'Xenova/bge-m3';
const LOCAL_EMBEDDING_DIM = Number(process.env.LOCAL_EMBEDDING_DIM || 1024);
const LOCAL_EMBEDDING_INDEX_TAG = process.env.LOCAL_EMBEDDING_INDEX_TAG || 'bge_m3_1024';
const INDEX_VERSION = 'new-library-consolidation-summary-v1';
const INDEX_GRANULARITY = 'new_library_card_v1';

function parseArgs(argv) {
    const args = {
        user: '',
        character: '',
        dryRun: false,
        keepCollection: false,
        limit: 0
    };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--user' && argv[i + 1]) args.user = String(argv[++i]).trim();
        else if (token === '--character' && argv[i + 1]) args.character = String(argv[++i]).trim();
        else if (token === '--limit' && argv[i + 1]) args.limit = Math.max(0, Number(argv[++i]) || 0);
        else if (token === '--dry-run') args.dryRun = true;
        else if (token === '--keep-collection') args.keepCollection = true;
    }
    return args;
}

function discoverUserIds() {
    const dataDir = path.join(root, 'data');
    if (!fs.existsSync(dataDir)) return [];
    return fs.readdirSync(dataDir)
        .map(name => {
            const match = name.match(/^chatpulse_user_(.+)\.db$/);
            return match ? match[1] : '';
        })
        .filter(id => id && !id.includes('.'));
}

function normalizeGroupKey(row) {
    return [
        String(row.character_id || ''),
        String(row.consolidation_key || '').trim(),
        String(row.consolidation_summary || '').trim().toLowerCase()
    ].join('::');
}

function parseRelationshipSummary(value) {
    if (!value) return '';
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!Array.isArray(parsed)) return '';
        return parsed.map(item => {
            if (typeof item === 'string') return item;
            return item.summary || item.type || item.name || '';
        }).filter(Boolean).slice(0, 8).join(', ');
    } catch (_) {
        return String(value || '').slice(0, 500);
    }
}

function buildCardEmbeddingText(card) {
    return [
        'LibrarySource: new_consolidated_memory_card',
        card.memory_type ? `Type: ${card.memory_type}` : '',
        card.memory_tier ? `Tier: ${card.memory_tier}` : '',
        card.memory_focus ? `Focus: ${card.memory_focus}` : '',
        card.consolidation_summary ? `Summary: ${card.consolidation_summary}` : '',
        card.location ? `Location: ${card.location}` : '',
        card.source_time_text ? `SourceTime: ${card.source_time_text}` : '',
        card.people ? `People: ${card.people}` : '',
        card.items ? `Items: ${card.items}` : '',
        card.relationship_summary ? `Relationships: ${card.relationship_summary}` : '',
        card.emotion ? `Emotion: ${card.emotion}` : ''
    ].filter(Boolean).join('. ');
}

function getVectorIndexVersionFile(userId, characterId) {
    return path.join(root, 'data', 'vectors', LOCAL_EMBEDDING_INDEX_TAG, String(userId), String(characterId), 'memory_source_version.json');
}

function writeVectorIndexSourceVersion(userId, characterId, payload = {}) {
    const filePath = getVectorIndexVersionFile(userId, characterId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({
        version: INDEX_VERSION,
        built_at: Date.now(),
        ...payload
    }, null, 2));
}

function getCharacterIndexStats(db, characterId) {
    const row = db.prepare(`
        SELECT
            COUNT(*) AS source_count,
            SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' AND COALESCE(is_archived, 0) = 0 THEN 1 ELSE 0 END) AS new_library_count
        FROM memories
        WHERE character_id = ?
    `).get(characterId) || {};
    return {
        source_count: Number(row.source_count || 0),
        new_library_count: Number(row.new_library_count || 0)
    };
}

function pickRepresentative(existing, row) {
    if (!existing) return row;
    const existingRank = Number(existing.importance || 0) * 10000000000000 + Number(existing.updated_at || existing.created_at || 0);
    const rowRank = Number(row.importance || 0) * 10000000000000 + Number(row.updated_at || row.created_at || 0);
    return rowRank > existingRank ? row : existing;
}

function loadNewLibraryCards(db, characterId = '') {
    const params = [];
    const where = [
        'COALESCE(is_archived, 0) = 0',
        "TRIM(COALESCE(consolidation_summary, '')) <> ''"
    ];
    if (characterId) {
        where.push('character_id = ?');
        params.push(characterId);
    }
    const rows = db.prepare(`
        SELECT *
        FROM memories
        WHERE ${where.join(' AND ')}
        ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
    `).all(...params);

    const groups = new Map();
    for (const row of rows) {
        const key = normalizeGroupKey(row);
        const existing = groups.get(key);
        const representative = pickRepresentative(existing?.representative, row);
        groups.set(key, {
            key,
            representative,
            row_count: (existing?.row_count || 0) + 1,
            source_ids: [...(existing?.source_ids || []), row.id]
        });
    }

    return Array.from(groups.values()).map(group => {
        const row = group.representative;
        return {
            id: row.id,
            point_id: row.id,
            source_ids: group.source_ids,
            row_count: group.row_count,
            character_id: String(row.character_id || ''),
            group_id: row.group_id || '',
            memory_type: row.memory_type || 'event',
            memory_tier: row.memory_tier || 'ambient',
            memory_focus: row.memory_focus || 'general',
            importance: Number(row.importance || 5),
            created_at: Number(row.created_at || Date.now()),
            updated_at: Number(row.updated_at || row.created_at || Date.now()),
            source_started_at: Number(row.source_started_at || 0),
            source_ended_at: Number(row.source_ended_at || 0),
            source_time_text: row.source_time_text || row.time || '',
            location: row.location || '',
            people: row.people || '',
            items: row.items || '',
            relationship_summary: parseRelationshipSummary(row.relationship_json || row.relationships),
            emotion: row.emotion || '',
            consolidation_key: row.consolidation_key || '',
            consolidation_summary: row.consolidation_summary || '',
            summary: row.consolidation_summary || row.summary || row.event || '',
            content: row.content || row.event || ''
        };
    }).sort((a, b) => {
        if (a.character_id !== b.character_id) return a.character_id.localeCompare(b.character_id);
        return b.updated_at - a.updated_at || b.created_at - a.created_at || Number(b.id) - Number(a.id);
    });
}

async function embedText(extractor, text) {
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function rebuildUser(userId, args, extractor) {
    const dbPath = path.join(root, 'data', `chatpulse_user_${userId}.db`);
    const db = new Database(dbPath, { readonly: true });
    const cards = loadNewLibraryCards(db, args.character);
    const selectedCards = args.limit > 0 ? cards.slice(0, args.limit) : cards;
    const collectionName = qdrant.getCollectionName(userId);
    console.log(`[NewLibraryQdrant] ${userId}: ${cards.length} new-library card(s), ${selectedCards.length} selected.`);

    if (args.dryRun) {
        db.close();
        return { cards: cards.length, indexed: 0 };
    }

    if (!args.keepCollection) {
        console.log(`[NewLibraryQdrant] ${userId}: deleting collection ${collectionName}.`);
        await qdrant.deleteUserCollection(userId);
    } else if (args.character) {
        console.log(`[NewLibraryQdrant] ${userId}: deleting existing points for character ${args.character}.`);
        await qdrant.deleteCharacterPoints(userId, args.character);
    }
    await qdrant.ensureCollection(userId, LOCAL_EMBEDDING_DIM);

    let indexed = 0;
    const startedAt = Date.now();
    for (const card of selectedCards) {
        const vector = await embedText(extractor, buildCardEmbeddingText(card));
        await qdrant.upsertMemoryPoint(userId, {
            id: String(card.point_id),
            vector,
            payload: {
                memory_id: card.id,
                character_id: card.character_id,
                group_id: card.group_id,
                memory_type: card.memory_type,
                memory_tier: card.memory_tier,
                memory_focus: card.memory_focus,
                importance: card.importance,
                created_at: card.created_at,
                updated_at: card.updated_at,
                is_archived: 0,
                retrieval_weight: 1,
                source_started_at: card.source_started_at,
                source_ended_at: card.source_ended_at,
                source_time_text: card.source_time_text,
                consolidation_key: card.consolidation_key,
                summary: card.summary,
                content: card.content,
                location: card.location,
                source_message_count: card.row_count,
                source_memory_ids: card.source_ids.join(','),
                memory_library_source: 'new',
                memory_index_version: INDEX_VERSION,
                memory_index_granularity: INDEX_GRANULARITY
            }
        });
        indexed += 1;
        if (indexed % 25 === 0 || indexed === selectedCards.length) {
            const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            console.log(`[NewLibraryQdrant] ${userId}: indexed ${indexed}/${selectedCards.length} (${elapsedSec}s).`);
        }
    }

    if (args.limit <= 0) {
        const cardsByCharacter = new Map();
        for (const card of cards) {
            if (!cardsByCharacter.has(card.character_id)) cardsByCharacter.set(card.character_id, []);
            cardsByCharacter.get(card.character_id).push(card);
        }
        for (const [characterId, characterCards] of cardsByCharacter.entries()) {
            const stats = getCharacterIndexStats(db, characterId);
            writeVectorIndexSourceVersion(userId, characterId, {
                indexed_count: characterCards.length,
                source_count: stats.source_count,
                new_library_count: stats.new_library_count,
                new_library_card_count: characterCards.length,
                memory_index_granularity: INDEX_GRANULARITY
            });
        }
    }

    db.close();
    return { cards: cards.length, indexed };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!await qdrant.healthcheck()) {
        throw new Error('Qdrant is not reachable.');
    }
    const users = args.user ? [args.user] : discoverUserIds();
    if (users.length === 0) {
        console.log('[NewLibraryQdrant] No user databases found.');
        return;
    }

    console.log(`[NewLibraryQdrant] model=${LOCAL_EMBEDDING_MODEL}, dimension=${LOCAL_EMBEDDING_DIM}, dryRun=${args.dryRun ? 'yes' : 'no'}`);
    const extractor = args.dryRun ? null : await pipeline('feature-extraction', LOCAL_EMBEDDING_MODEL);
    let totalCards = 0;
    let totalIndexed = 0;
    for (const userId of users) {
        const result = await rebuildUser(userId, args, extractor);
        totalCards += result.cards;
        totalIndexed += result.indexed;
    }
    console.log(`[NewLibraryQdrant] done. cards=${totalCards}, indexed=${totalIndexed}.`);
}

main().catch(error => {
    console.error('[NewLibraryQdrant] fatal:', error);
    process.exitCode = 1;
});
