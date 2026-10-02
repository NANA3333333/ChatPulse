// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getDiaries(characterId) {
        return dependencies.db.prepare('SELECT * FROM diaries WHERE character_id = ? ORDER BY timestamp DESC').all(characterId);
    }

function addDiary(characterId, content, emotion = null) {
        const authorId = String(characterId || '').trim();
        const safeContent = typeof content === 'string' ? content.trim() : '';
        if (!authorId || !dependencies.getCharacter(authorId)) {
            const error = new Error('Diary author not found');
            error.status = 404;
            throw error;
        }
        if (!safeContent) {
            const error = new Error('Diary content required');
            error.status = 400;
            throw error;
        }
        const info = dependencies.db.prepare(`
        INSERT INTO diaries (character_id, content, emotion, timestamp) 
        VALUES (?, ?, ?, ?)
    `).run(authorId, safeContent, emotion, Date.now());
        return info.lastInsertRowid;
    }

function deleteDiary(diaryId) {
        const id = dependencies.normalizePositiveRowId(diaryId, 'diary id');
        const info = dependencies.db.prepare('DELETE FROM diaries WHERE id = ?').run(id);
        return info.changes || 0;
    }

function unlockDiaries(characterId) {
        const authorId = String(characterId || '').trim();
        if (!authorId || !dependencies.getCharacter(authorId)) {
            const error = new Error('Diary author not found');
            error.status = 404;
            throw error;
        }
        dependencies.db.prepare('UPDATE characters SET is_diary_unlocked = 1 WHERE id = ?').run(authorId);
    }

function setDiaryPassword(characterId, password) {
        const authorId = String(characterId || '').trim();
        const safePassword = typeof password === 'string' ? password.trim() : '';
        if (!authorId || !dependencies.getCharacter(authorId)) {
            const error = new Error('Diary author not found');
            error.status = 404;
            throw error;
        }
        if (!safePassword) {
            const error = new Error('Diary password required');
            error.status = 400;
            throw error;
        }
        dependencies.db.prepare('UPDATE characters SET diary_password = ? WHERE id = ?').run(safePassword, authorId);
    }

function verifyAndUnlockDiary(characterId, inputPassword) {
        const authorId = String(characterId || '').trim();
        const password = typeof inputPassword === 'string' ? inputPassword.trim() : '';
        if (!password) return { success: false, reason: 'No password provided.' };
        if (!authorId) return { success: false, reason: 'Character not found.' };
        const char = dependencies.db.prepare('SELECT diary_password, is_diary_unlocked FROM characters WHERE id = ?').get(authorId);
        if (!char) return { success: false, reason: 'Character not found.' };
        if (char.is_diary_unlocked) return { success: true, alreadyUnlocked: true };
        if (!char.diary_password) return { success: false, reason: 'No password has been set yet. Keep building your bond.' };
        if (char.diary_password.trim().toLowerCase() === password.toLowerCase()) {
            dependencies.db.prepare('UPDATE characters SET is_diary_unlocked = 1 WHERE id = ?').run(authorId);
            return { success: true };
        }
        return { success: false, reason: 'Wrong password.' };
    }

    return { getDiaries, addDiary, deleteDiary, unlockDiaries, setDiaryPassword, verifyAndUnlockDiary };
}

module.exports = { createModule };
