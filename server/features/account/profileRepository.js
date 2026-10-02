// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getUserProfile() {
        let profile = dependencies.db.prepare('SELECT * FROM user_profile WHERE id = ?').get('default');
        if (!profile) {
            dependencies.db.prepare(`
                INSERT INTO user_profile
                    (id, name, avatar)
                VALUES (?, ?, ?)
            `).run(
                'default',
                'User',
                dependencies.buildDefaultAvatarUrl('User')
            );
            profile = dependencies.db.prepare('SELECT * FROM user_profile WHERE id = ?').get('default');
        }
        if (profile) {
            delete profile.theme;
            delete profile.theme_config;
            delete profile.custom_css;
            delete profile.group_skip_rate;
            delete profile.jealousy_chance;
            delete profile.group_proactive_enabled;
            delete profile.group_interval_min;
            delete profile.group_interval_max;

            const profileAvatar = String(profile.avatar || '').trim();
            if (!profileAvatar || profileAvatar.includes('/notionists/svg')) {
                profile.avatar = dependencies.buildDefaultAvatarUrl(profile.name || 'User');
                dependencies.db.prepare('UPDATE user_profile SET avatar = ? WHERE id = ?').run(profile.avatar, 'default');
            }
            if (!String(profile.response_style_constitution || '').trim()) {
                profile.response_style_constitution = [
                    '这是最高优先级的长期表达风格约束。',
                    '避免连续几轮使用相同句式骨架、相同情绪推进、相同emoji顺序。',
                    '不要把回复写成固定模板，不要总是同一种委屈、安抚、阴阳怪气节奏。',
                    '可以保留角色性格，但表达方式必须有变化感。',
                    '除非角色本来就极度依赖表情，否则emoji默认少用，并避免固定排列。'
                ].join('\n');
            }
        }
        return profile;
    }

function normalizeProfileInteger(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        const integer = Math.trunc(parsed);
        return Math.max(min, Math.min(max, integer));
    }

function normalizeProfileNumber(value, fallback, min, max) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.max(min, Math.min(max, parsed));
    }

function normalizeUserProfilePatch(data) {
        const normalizedData = { ...data };
        if (normalizedData.group_msg_limit !== undefined) {
            normalizedData.group_msg_limit = normalizeProfileInteger(normalizedData.group_msg_limit, 20, 1, 200);
        }
        if (normalizedData.wallet !== undefined) {
            normalizedData.wallet = +normalizeProfileNumber(normalizedData.wallet, 0, 0, 1000000000).toFixed(2);
        }
        if (normalizedData.private_msg_limit_for_group !== undefined) {
            normalizedData.private_msg_limit_for_group = normalizeProfileInteger(normalizedData.private_msg_limit_for_group, 3, 0, 50);
        }
        if (normalizedData.memory_maintenance_batch_size !== undefined) {
            normalizedData.memory_maintenance_batch_size = normalizeProfileInteger(normalizedData.memory_maintenance_batch_size, 30, 10, 100);
        }
        if (normalizedData.memory_maintenance_max_tokens !== undefined) {
            normalizedData.memory_maintenance_max_tokens = normalizeProfileInteger(normalizedData.memory_maintenance_max_tokens, 8000, 1000, 20000);
        }
        return normalizedData;
    }

function updateUserProfile(data) {
        const allowedFields = ['name', 'avatar', 'avatar_frame', 'banner', 'bio', 'group_msg_limit', 'wallet', 'private_msg_limit_for_group', 'serper_api_key', 'web_search_keys_json', 'web_search_provider', 'memory_maintenance_api_endpoint', 'memory_maintenance_api_key', 'memory_maintenance_model_name', 'memory_maintenance_batch_size', 'memory_maintenance_max_tokens'];
        const fields = Object.keys(data).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return;
        const normalizedData = normalizeUserProfilePatch(data);
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => normalizedData[f]);
        dependencies.db.prepare(`UPDATE user_profile SET ${setClause} WHERE id = ?`).run(...values, 'default');
    }

    return { getUserProfile, normalizeProfileInteger, normalizeProfileNumber, normalizeUserProfilePatch, updateUserProfile };
}

module.exports = { createModule };
