const { hasCjkText } = require("../maintenance/index.js");
// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function ensureExternalSharedImportCharacter(db, id, name) {
    if (!db || !id) return;
    if (typeof db.getCharacter === 'function' && db.getCharacter(id)) return;
    if (typeof db.updateCharacter === 'function') {
        db.updateCharacter(id, {
            id,
            name: name || '外部共享导入库',
            persona: '外部多人聊天导入的共享记忆库。它不作为聊天角色显示，只承载被多个角色标签绑定的导入记忆。',
            is_blocked: 1,
            status: 'shared_library',
            llm_debug_capture: 0,
            sweep_initialized: 1
        });
    }
}

async function saveExternalImportCandidatesDirect({ db, memory, settings, importId, sourceApp, importMode = '', normalized, dryRun = false }) {
    const sceneTag = dependencies.getExternalSceneTag(sourceApp);
    const useSharedLibrary = dependencies.shouldUseSharedExternalImportLibrary(sourceApp, importMode || normalized?.import_mode);
    const sharedLibraryId = dependencies.getExternalImportSharedLibraryId(sourceApp);
    const sharedLibraryName = `${dependencies.getExternalSourceAppLabel(sourceApp)} 共享导入库`;
    const roleProfiles = new Map((normalized.role_tags || []).map(tag => [
        dependencies.normalizeExternalCharacterName(tag.name).toLowerCase(),
        tag.profile || tag
    ]));
    const characterByName = new Map();
    const characters = [];
    const saved = [];
    const skipped = [];
    const errors = [];

    const ensureCharacter = (name) => {
        const normalizedName = dependencies.normalizeExternalCharacterName(name);
        if (!normalizedName) return null;
        const key = normalizedName.toLowerCase();
        if (characterByName.has(key)) return characterByName.get(key);
        if (dryRun) {
            const existing = dependencies.findCharacterByName(db, normalizedName);
            const character = existing || { id: dependencies.makeCharacterIdFromName(db, normalizedName), name: normalizedName };
            characterByName.set(key, character);
            characters.push({
                id: character.id,
                name: character.name,
                created: !existing,
                dry_run: true
            });
            return character;
        }
        const result = dependencies.ensureImportedCharacter(db, normalizedName, roleProfiles.get(key) || {}, settings);
        if (result.character) {
            characterByName.set(key, result.character);
            characters.push({
                id: result.character.id,
                name: result.character.name,
                created: result.created
            });
        }
        return result.character || null;
    };

    for (const tag of normalized.role_tags || []) {
        ensureCharacter(tag.name);
    }

    for (const candidate of normalized.candidates || []) {
        const names = Array.from(new Set((Array.isArray(candidate.character_names) ? candidate.character_names : [])
            .map(name => dependencies.normalizeExternalCharacterName(name))
            .filter(Boolean)));
        if (!names.length) {
            skipped.push({ candidate_id: candidate.id, reason: 'missing_character_names' });
            continue;
        }
        const boundCharacters = [];
        for (const name of names) {
            const character = ensureCharacter(name);
            if (character) {
                boundCharacters.push(character);
            } else {
                skipped.push({ candidate_id: candidate.id, name, reason: 'character_not_created' });
            }
        }
        if (!boundCharacters.length) continue;
        await dependencies.yieldToServerLoop();

        const storageCharacter = useSharedLibrary
            ? { id: sharedLibraryId, name: sharedLibraryName }
            : boundCharacters[0];
        if (useSharedLibrary && !dryRun) {
            ensureExternalSharedImportCharacter(db, storageCharacter.id, storageCharacter.name);
        }
        const dedupeKey = dependencies.buildExternalImportDirectDedupeKey({
            importId,
            sourceApp,
            characterId: storageCharacter.id,
            candidate
        });
        const sourceRefs = Array.from(new Set((Array.isArray(candidate.source_refs) ? candidate.source_refs : [])
            .map(ref => String(ref || '').trim())
            .filter(Boolean)));
        const sourceMessageIds = sourceRefs.length
            ? sourceRefs.map(ref => `external-import:${importId}:${ref}`)
            : [`external-import:${importId}:${candidate.id || dedupeKey}`];
        const summary = dependencies.firstImportString(candidate.summary, candidate.content).slice(0, 1200);
        const content = dependencies.firstImportString(candidate.content, candidate.summary).slice(0, 3000);
        if (!summary || !hasCjkText(summary)) {
            skipped.push({ candidate_id: candidate.id, names, reason: 'empty_or_non_chinese_summary' });
            continue;
        }
        const existing = db.getMemoryByDedupeKey?.(storageCharacter.id, dedupeKey);
        const boundCharacterRefs = boundCharacters.map(item => ({ id: item.id, name: item.name }));
        const boundCharacterNames = boundCharacters.map(item => item.name);
        if (dryRun) {
            saved.push({
                dry_run: true,
                candidate_id: candidate.id,
                character_id: storageCharacter.id,
                character_name: storageCharacter.name,
                shared_library: useSharedLibrary,
                bound_characters: boundCharacterRefs,
                character_names: boundCharacterNames,
                action: existing ? 'would_update' : 'would_create',
                summary
            });
            continue;
        }
        try {
            const memoryId = await memory.saveExtractedMemory(storageCharacter.id, {
                memory_type: 'event',
                summary,
                content: content || summary,
                event: summary,
                importance: Math.round(dependencies.clampImportNumber(candidate.importance, 5, 1, 10)),
                memory_tier: dependencies.MEMORY_MAINTENANCE_TIERS.has(candidate.memory_tier) ? candidate.memory_tier : 'ambient',
                memory_focus: dependencies.MEMORY_MAINTENANCE_FOCUS.has(candidate.memory_focus) ? candidate.memory_focus : 'general',
                maintenance_status: 'classified',
                classification_source: useSharedLibrary ? 'external-import-shared' : 'external-import-direct',
                classified_at: Date.now(),
                retention_score: 1,
                retention_action: 'keep',
                retention_reason: useSharedLibrary ? 'external_import_shared' : 'external_import_direct',
                retention_checked_at: Date.now(),
                consolidation_key: candidate.consolidation_key || dedupeKey,
                consolidation_summary: summary,
                dedupe_key: dedupeKey,
                source_context: 'external_app',
                scene_tag: sceneTag,
                source_app: sourceApp,
                people_json: boundCharacterNames,
                source_message_ids_json: sourceMessageIds,
                source_started_at: Number(candidate.source_started_at || 0),
                source_ended_at: Number(candidate.source_ended_at || candidate.source_started_at || 0),
                source_time_text: candidate.source_time_text || '',
                source_message_count: Number(candidate.source_message_count || sourceRefs.length || 0)
            }, null, { allowUnindexed: true, throwOnError: true, allowRoutineCity: true });
            if (useSharedLibrary && memoryId && typeof db.bindExternalMemoryToCharacters === 'function') {
                db.bindExternalMemoryToCharacters(importId, memoryId, boundCharacters);
                for (const boundCharacter of boundCharacters) {
                    if (typeof memory.refreshMemoryIndexEntries === 'function') {
                        try {
                            await memory.refreshMemoryIndexEntries(boundCharacter.id, [memoryId]);
                        } catch (e) {
                            console.warn(`[External Import] Shared memory index refresh failed for ${boundCharacter.id}:`, e.message);
                        }
                    }
                }
            }
            saved.push({
                candidate_id: candidate.id,
                character_id: storageCharacter.id,
                character_name: storageCharacter.name,
                shared_library: useSharedLibrary,
                bound_characters: boundCharacterRefs,
                character_names: boundCharacterNames,
                memory_id: memoryId,
                action: existing ? 'updated' : 'created',
                summary
            });
            await dependencies.yieldToServerLoop();
        } catch (e) {
            errors.push({
                candidate_id: candidate.id,
                character_id: storageCharacter.id,
                character_name: storageCharacter.name,
                shared_library: useSharedLibrary,
                bound_characters: boundCharacterRefs,
                error: e.message || 'save failed'
            });
        }
    }

    return {
        characters,
        saved,
        skipped,
        errors,
        saved_count: saved.length,
        error_count: errors.length
    };
}

function groupExternalImportSavedItems(saved = []) {
    const map = new Map();
    for (const item of Array.isArray(saved) ? saved : []) {
        const summary = String(item?.summary || '').trim();
        if (!summary) continue;
        const key = String(item?.candidate_id || summary).trim() || summary;
        const current = map.get(key) || {
            summary,
            candidate_id: item?.candidate_id || '',
            character_names: [],
            memory_ids: []
        };
        const names = Array.isArray(item?.character_names) && item.character_names.length
            ? item.character_names
            : (Array.isArray(item?.bound_characters) ? item.bound_characters.map(character => character?.name) : [item?.character_name]);
        for (const name of names) {
            const characterName = String(name || '').trim();
            if (characterName && !current.character_names.includes(characterName)) {
                current.character_names.push(characterName);
            }
        }
        if (item?.memory_id) current.memory_ids.push(item.memory_id);
        map.set(key, current);
    }
    return Array.from(map.values());
}

function countUniqueExternalImportSavedItems(saved = []) {
    return groupExternalImportSavedItems(saved).length;
}

function formatExternalImportSavedSamples(saved = [], limit = 5) {
    return groupExternalImportSavedItems(saved)
        .slice(0, Math.max(0, Number(limit || 0) || 0))
        .map(item => {
            const names = item.character_names.slice(0, 4).join(' / ');
            const suffix = names ? `（绑定：${names}${item.character_names.length > 4 ? ' 等' : ''}）` : '';
            return `${item.summary}${suffix}`;
        });
}

function countExternalImportSavedBindings(saved = []) {
    return (Array.isArray(saved) ? saved : []).reduce((sum, item) => {
        const names = Array.isArray(item?.character_names) && item.character_names.length
            ? item.character_names
            : (Array.isArray(item?.bound_characters) ? item.bound_characters : []);
        return sum + Math.max(1, names.length || 0);
    }, 0);
}

function getExternalImportSavedCharacterIds(saved = []) {
    const ids = new Set();
    for (const item of Array.isArray(saved) ? saved : []) {
        if (Array.isArray(item?.bound_characters)) {
            for (const character of item.bound_characters) {
                const id = String(character?.id || '').trim();
                if (id) ids.add(id);
            }
        }
        if (!item?.shared_library) {
            const id = String(item?.character_id || '').trim();
            if (id) ids.add(id);
        }
    }
    return Array.from(ids);
}

    return { ensureExternalSharedImportCharacter, saveExternalImportCandidatesDirect, groupExternalImportSavedItems, countUniqueExternalImportSavedItems, formatExternalImportSavedSamples, countExternalImportSavedBindings, getExternalImportSavedCharacterIds };
}

module.exports = { createModule };
