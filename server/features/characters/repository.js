// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getCharacters() {
        return dependencies.db.prepare("SELECT * FROM characters WHERE id NOT LIKE 'external-shared-%'").all();
    }

function getCharacter(id) {
        return dependencies.db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
    }

function generateDiaryPassword() {
        return String(Math.floor(1000 + Math.random() * 9000));
    }

function hasCharacterPatchField(data, field) {
        return Object.prototype.hasOwnProperty.call(data, field);
    }

function normalizeCharacterInteger(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const integer = Math.trunc(parsed);
        return Math.max(min, Math.min(max, integer));
    }

function normalizeCharacterNumber(value, fallback, min, max, digits = 2) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const clamped = Math.max(min, Math.min(max, parsed));
        return +clamped.toFixed(digits);
    }

function normalizeCharacterFlag(value, fallback = 1) {
        const text = String(value ?? '').trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(text)) return 1;
        if (['0', 'false', 'no', 'off'].includes(text)) return 0;
        return fallback ? 1 : 0;
    }

function normalizeCharacterPatch(data, existing = null) {
        const normalizedData = { ...data };
        const intFields = {
            max_tokens: [2000, 100, 20000],
            sweep_limit: [30, 10, 100],
            impression_q_limit: [3, 0, 10],
            context_msg_limit: [60, 0, 200],
            private_summary_threshold: [30, 5, 100],
            city_action_frequency: [1, 1, 30]
        };
        for (const [field, [fallback, min, max]] of Object.entries(intFields)) {
            if (hasCharacterPatchField(normalizedData, field)) {
                normalizedData[field] = normalizeCharacterInteger(
                    normalizedData[field],
                    normalizeCharacterInteger(existing?.[field], fallback, min, max),
                    min,
                    max
                );
            }
        }

        const boundedPercentFields = {
            affinity: 50,
            initial_affinity: 50,
            jealousy_level: 0,
            stat_int: 50,
            stat_sta: 50,
            stat_cha: 50,
            energy: 100,
            sleep_pressure: 20,
            mood: 50,
            stress: 20,
            social_need: 50,
            health: 100,
            satiety: 45,
            stomach_load: 0,
            work_distraction: 0,
            sleep_disruption: 0
        };
        for (const [field, fallback] of Object.entries(boundedPercentFields)) {
            if (hasCharacterPatchField(normalizedData, field)) {
                normalizedData[field] = normalizeCharacterInteger(normalizedData[field], normalizeCharacterInteger(existing?.[field], fallback, 0, 100), 0, 100);
            }
        }

        if (hasCharacterPatchField(normalizedData, 'pressure_level')) {
            normalizedData.pressure_level = normalizeCharacterInteger(
                normalizedData.pressure_level,
                normalizeCharacterInteger(existing?.pressure_level, 0, 0, 4),
                0,
                4
            );
        }
        if (hasCharacterPatchField(normalizedData, 'sleep_debt')) {
            normalizedData.sleep_debt = normalizeCharacterInteger(normalizedData.sleep_debt, normalizeCharacterInteger(existing?.sleep_debt, 0, 0, 1000), 0, 1000);
        }
        if (hasCharacterPatchField(normalizedData, 'wallet')) {
            normalizedData.wallet = normalizeCharacterNumber(normalizedData.wallet, normalizeCharacterNumber(existing?.wallet, 200, 0, 1000000000), 0, 1000000000);
        }
        if (hasCharacterPatchField(normalizedData, 'calories')) {
            normalizedData.calories = normalizeCharacterInteger(normalizedData.calories, normalizeCharacterInteger(existing?.calories, 2000, 0, 4000), 0, 4000);
        }

        const flagFields = {
            tts_enabled: 0,
            tts_autoplay: 0,
            sys_proactive: 1,
            sys_timer: 1,
            sys_pressure: 1,
            sys_jealousy: 1,
            is_diary_unlocked: 0,
            is_blocked: 0,
            llm_debug_capture: 1,
            sys_survival: 1,
            sys_city_notify: 0,
            sys_city_social: 1,
            is_scheduled: 1
        };
        for (const [field, fallback] of Object.entries(flagFields)) {
            if (hasCharacterPatchField(normalizedData, field)) {
                normalizedData[field] = normalizeCharacterFlag(normalizedData[field], existing?.[field] ?? fallback);
            }
        }

        const hasMinInterval = hasCharacterPatchField(normalizedData, 'interval_min');
        const hasMaxInterval = hasCharacterPatchField(normalizedData, 'interval_max');
        if (hasMinInterval) {
            normalizedData.interval_min = normalizeCharacterNumber(
                normalizedData.interval_min,
                normalizeCharacterNumber(existing?.interval_min, 10, 0.1, 120, 1),
                0.1,
                120,
                1
            );
        }
        if (hasMaxInterval) {
            normalizedData.interval_max = normalizeCharacterNumber(
                normalizedData.interval_max,
                normalizeCharacterNumber(existing?.interval_max, 120, 0.1, 120, 1),
                0.1,
                120,
                1
            );
        }
        if (hasMinInterval || hasMaxInterval) {
            const nextMin = hasMinInterval
                ? normalizedData.interval_min
                : normalizeCharacterNumber(existing?.interval_min, 10, 0.1, 120, 1);
            const nextMax = hasMaxInterval
                ? normalizedData.interval_max
                : normalizeCharacterNumber(existing?.interval_max, 120, 0.1, 120, 1);
            if (nextMax < nextMin) {
                normalizedData.interval_max = nextMin;
            }
        }

        return normalizedData;
    }

function updateCharacter(id, data) {
        const existing = getCharacter(id);
        const normalizedData = normalizeCharacterPatch(data, existing);
        if (!existing && !String(normalizedData.name || '').trim()) {
            const error = new Error('Character name is required.');
            error.status = 400;
            throw error;
        }
        // Filter out 'id' from data keys — it's always passed as a separate parameter
        const fields = Object.keys(normalizedData).filter(k => dependencies.characterColumns.includes(k) && k !== 'id');
        if (fields.length === 0) return;

        const values = fields.map(f => normalizedData[f]);

        // Insert if not exists, else update
        if (!existing) {
            const avatarIndex = fields.indexOf('avatar');
            if (avatarIndex === -1) {
                fields.push('avatar');
                values.push(dependencies.buildDefaultAvatarUrl(normalizedData.name || id));
            } else if (!String(values[avatarIndex] || '').trim()) {
                values[avatarIndex] = dependencies.buildDefaultAvatarUrl(normalizedData.name || id);
            }

            // Auto-assign a diary password for new characters
            if (!normalizedData.diary_password) {
                const pw = generateDiaryPassword();
                fields.push('diary_password');
                values.push(pw);
            }

            // Snapshot initial affinity on creation
            if (!fields.includes('initial_affinity')) {
                const startAffinity = fields.includes('affinity') ? normalizedData.affinity : 50;
                fields.push('initial_affinity');
                values.push(startAffinity);
            }

            // Initialize hidden state
            if (!fields.includes('hidden_state')) {
                fields.push('hidden_state');
                values.push('');
            }
            // Ensure emoji has a default
            if (!fields.includes('emoji')) {
                fields.push('emoji');
                values.push('👤');
            }
            // Recent LLM Input / Output panel depends on this capture flag.
            if (!fields.includes('llm_debug_capture')) {
                fields.push('llm_debug_capture');
                values.push(1);
            }
            if (!fields.includes('created_at')) {
                fields.push('created_at');
                values.push(Date.now());
            }

            const placeholders = fields.map(() => '?').join(', ');
            dependencies.db.prepare(`INSERT INTO characters (id, ${fields.join(', ')}) VALUES (?, ${placeholders})`)
                .run(id, ...values);
        } else {
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            dependencies.db.prepare(`UPDATE characters SET ${setClause} WHERE id = ?`)
                .run(...values, id);
        }
    }

function ensureAllDiaryPasswords() {
        const chars = dependencies.db.prepare("SELECT id FROM characters WHERE diary_password IS NULL OR diary_password = ''").all();
        for (const c of chars) {
            dependencies.db.prepare('UPDATE characters SET diary_password = ? WHERE id = ?').run(generateDiaryPassword(), c.id);
        }
        if (chars.length > 0) console.log(`[DB] Auto-assigned diary passwords to ${chars.length} character(s).`);
    }

function ensureAllCharacterAvatars() {
        const chars = dependencies.db.prepare(`
            SELECT id, name
            FROM characters
            WHERE avatar IS NULL
               OR TRIM(avatar) = ''
               OR avatar LIKE '%/notionists/svg%'
        `).all();
        const stmt = dependencies.db.prepare('UPDATE characters SET avatar = ? WHERE id = ?');
        for (const c of chars) {
            stmt.run(dependencies.buildDefaultAvatarUrl(c.name || c.id), c.id);
        }
        if (chars.length > 0) console.log(`[DB] Backfilled geometric avatars for ${chars.length} character(s).`);
    }

function getCharacterHiddenState(id) {
        const row = dependencies.db.prepare('SELECT hidden_state FROM characters WHERE id = ?').get(id);
        return row ? row.hidden_state : '';
    }

function updateCharacterHiddenState(id, hidden_state) {
        dependencies.db.prepare('UPDATE characters SET hidden_state = ? WHERE id = ?').run(hidden_state || '', id);
    }

    return { getCharacters, getCharacter, generateDiaryPassword, hasCharacterPatchField, normalizeCharacterInteger, normalizeCharacterNumber, normalizeCharacterFlag, normalizeCharacterPatch, updateCharacter, ensureAllDiaryPasswords, ensureAllCharacterAvatars, getCharacterHiddenState, updateCharacterHiddenState };
}

module.exports = { createModule };
