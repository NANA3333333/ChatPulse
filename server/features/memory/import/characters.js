// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function findCharacterByName(db, name = '') {
    const target = String(name || '').trim().toLowerCase();
    if (!target || typeof db.getCharacters !== 'function') return null;
    const characters = db.getCharacters() || [];
    const exact = characters.find(character => String(character.name || '').trim().toLowerCase() === target);
    if (exact) return exact;
    const targetKey = dependencies.getExternalNameCompareKey(name);
    if (!targetKey) return null;
    const candidates = characters
        .map(character => ({ character, key: dependencies.getExternalNameCompareKey(character.name || '') }))
        .filter(item => item.key);
    const containmentMatches = candidates.filter(item => {
        const minLength = /[\u4e00-\u9fff]/.test(targetKey + item.key) ? 2 : 4;
        return targetKey.length >= minLength && item.key.length >= minLength && (item.key.includes(targetKey) || targetKey.includes(item.key));
    });
    if (containmentMatches.length === 1) return containmentMatches[0].character;
    const targetTokens = dependencies.getExternalNameTokens(name);
    if (targetTokens.length > 0) {
        const tokenMatches = candidates.filter(item => {
            const tokens = new Set(dependencies.getExternalNameTokens(item.character.name || ''));
            return targetTokens.some(token => tokens.has(token));
        });
        if (tokenMatches.length === 1) return tokenMatches[0].character;
    }
    return null;
}

function makeCharacterIdFromName(db, name = '') {
    const base = String(name || 'imported-character')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 36) || 'imported-character';
    let candidate = base;
    let suffix = 1;
    while (db.getCharacter?.(candidate)) {
        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
    return candidate;
}

function ensureImportedCharacter(db, name, profile = {}, settings = {}) {
    const existing = findCharacterByName(db, name);
    if (existing) return { character: existing, created: false };
    const id = makeCharacterIdFromName(db, name);
    db.updateCharacter(id, {
        id,
        name,
        avatar: dependencies.buildDefaultAvatarUrl(name),
        persona: dependencies.firstImportString(profile?.persona, `${name} 是从外部聊天记录导入的角色，后续可以在角色设置里补全人格。`),
        affinity: 50,
        wallet: 200,
        memory_api_endpoint: settings.api_endpoint || '',
        memory_api_key: settings.api_key || '',
        memory_model_name: settings.model_name || ''
    });
    return { character: db.getCharacter(id), created: true };
}

    return { findCharacterByName, makeCharacterIdFromName, ensureImportedCharacter };
}

module.exports = { createModule };
