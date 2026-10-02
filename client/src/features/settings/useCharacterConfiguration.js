import React, { useState, useCallback, useEffect } from 'react';
import { getDefaultGuidelines } from './profileDefaults.js';
import { normalizeAvatarFrameId } from '../../shared/media/avatarFrames.js';
import { requestJson } from '../../shared/http/requestJson.js';
import { LOCAL_OLLAMA_MODEL_PRESET, withLocalModelOption } from '../characters/localModelPreset.js';

export function useCharacterConfiguration({
    parentContacts,
    apiUrl,
    lang,
    onCharactersUpdate,
    setSaveError,
    characterMessageStatsById,
    setMemModels,
    setMemModelError,
    setMainModels,
    setMainModelError,
    setActiveSettingsScreen,
    setActiveCharacterTab,
}) {
    const [contacts, setContacts] = useState(() => (Array.isArray(parentContacts) ? parentContacts : []));
    const [selectedSettingsContactId, setSelectedSettingsContactId] = useState('');
    const [editingContact, setEditingContact] = useState(null);
    const [savingContact, setSavingContact] = useState(false);
    const contactSaveLock = React.useRef(false);

    useEffect(() => {
        if (Array.isArray(parentContacts)) {
            setContacts(parentContacts);
        }
    }, [parentContacts]);

    useEffect(() => {
        if (!contacts.length) {
            setSelectedSettingsContactId('');
            return;
        }
        if (!contacts.some((c) => c.id === selectedSettingsContactId)) {
            setSelectedSettingsContactId(contacts[0].id);
        }
    }, [contacts, selectedSettingsContactId]);

    useEffect(() => {
        const headers = { Authorization: 'Bearer ' + (localStorage.getItem('cp_token') || '') };
        const fetchCharacters = () => {
            fetch(`${apiUrl}/characters`, { headers })
                .then((res) => res.json())
                .then((data) => setContacts(data))
                .catch(console.error);
        };

        fetchCharacters();

        window.addEventListener('refresh_contacts', fetchCharacters);
        return () => window.removeEventListener('refresh_contacts', fetchCharacters);
    }, [apiUrl, lang]);

    const handleDeleteContact = async (id) => {
        if (
            !window.confirm(
                lang === 'en'
                    ? 'Are you sure you want to delete this contact and all their data?'
                    : '确定要删除这个联系人及其全部数据吗？',
            )
        )
            return;
        try {
            const res = await fetch(`${apiUrl}/characters/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setContacts((prev) => prev.filter((contact) => String(contact.id) !== String(id)));
                setEditingContact((prev) => (String(prev?.id || '') === String(id) ? null : prev));
                window.dispatchEvent(new CustomEvent('character_deleted', { detail: { characterId: id } }));
                if (onCharactersUpdate) onCharactersUpdate({ type: 'deleted', id });
            } else {
                alert(
                    (lang === 'en' ? 'Delete failed: ' : '删除失败：') +
                        (data.error || res.statusText || (lang === 'en' ? 'Unknown error' : '未知错误')),
                );
            }
        } catch (e) {
            console.error('Failed to delete character:', e);
            alert(
                (lang === 'en' ? 'Delete failed: ' : '删除失败：') +
                    (e.message || (lang === 'en' ? 'Network error' : '网络错误')),
            );
        }
    };

    const handleWipeData = async (id) => {
        if (
            !window.confirm(
                lang === 'en'
                    ? 'Are you sure you want to wipe all data (messages, memories, etc.) for this character?'
                    : '确定要清空该角色的所有数据（消息、记忆等）吗？',
            )
        )
            return;
        try {
            const res = await fetch(`${apiUrl}/data/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json();
            if (data.success) {
                setContacts((prev) =>
                    prev.map((c) =>
                        c.id === id
                            ? {
                                  ...c,
                                  lastMessage: '',
                                  time: '',
                                  unread: 0,
                                  affinity: c.initial_affinity ?? 50,
                                  pressure_level: 0,
                                  jealousy_level: 0,
                                  wallet: 200,
                              }
                            : c,
                    ),
                );
                if (editingContact?.id === id) {
                    setEditingContact((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  affinity: prev.initial_affinity ?? 50,
                                  pressure_level: 0,
                                  jealousy_level: 0,
                                  wallet: 200,
                              }
                            : prev,
                    );
                }
                window.dispatchEvent(new CustomEvent('character_data_wiped', { detail: { characterId: id } }));
                window.dispatchEvent(new Event('refresh_contacts'));
                alert(lang === 'en' ? 'Data wiped successfully.' : '数据已清空。');
                if (onCharactersUpdate) onCharactersUpdate();
            }
        } catch (e) {
            console.error('Failed to wipe data:', e);
        }
    };

    const handleExportCharacterData = async (id) => {
        if (!id) return;
        try {
            const res = await fetch(`${apiUrl}/data/${encodeURIComponent(id)}/export`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            const disposition = res.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
            const filename = filenameMatch ? filenameMatch[1] : `${id}_character_export.json`;
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.href = objectUrl;
            downloadAnchorNode.download = filename;
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            alert((lang === 'en' ? 'Character export failed: ' : '角色导出失败：') + (e.message || e));
        }
    };

    const handleImportCharacterData = async (id, event, mode = 'replace') => {
        const input = event.target;
        const file = input.files?.[0];
        if (!id || !file) return;
        const ok = window.confirm(
            mode === 'merge'
                ? lang === 'en'
                    ? 'Merge this archive into the selected character?'
                    : '确定把这个存档合并到当前角色吗？'
                : lang === 'en'
                  ? 'Replace this character data with the archive? Existing messages and memories may be overwritten.'
                  : '确定用这个存档替换当前角色数据吗？现有消息和记忆可能会被覆盖。',
        );
        if (!ok) {
            input.value = '';
            return;
        }
        try {
            const formData = new FormData();
            formData.append('archive', file);
            const res = await fetch(
                `${apiUrl}/data/${encodeURIComponent(id)}/import?mode=${encodeURIComponent(mode)}`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
                    body: formData,
                },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            window.dispatchEvent(new Event('refresh_contacts'));
            alert(lang === 'en' ? 'Character archive imported.' : '角色存档已导入。');
            if (onCharactersUpdate) onCharactersUpdate({ type: 'imported', id });
        } catch (e) {
            alert((lang === 'en' ? 'Character import failed: ' : '角色导入失败：') + (e.message || e));
        } finally {
            input.value = '';
        }
    };

    const handleResetPhysicalState = async (id) => {
        if (!id) return;
        if (
            !window.confirm(
                lang === 'en'
                    ? 'Reset energy, sleep, stress, and pressure without touching memories or wallet?'
                    : '确定重置体力、睡眠、压力等身体状态吗？不会影响记忆和钱包。',
            )
        )
            return;
        try {
            const res = await fetch(`${apiUrl}/characters/${encodeURIComponent(id)}/reset-physical-state`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cp_token') || ''}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
            const character = data.character || null;
            if (character) {
                setContacts((prev) =>
                    prev.map((item) => (String(item.id) === String(id) ? { ...item, ...character } : item)),
                );
                setEditingContact((prev) =>
                    prev && String(prev.id) === String(id) ? { ...prev, ...character } : prev,
                );
            }
            window.dispatchEvent(new Event('refresh_contacts'));
            alert(lang === 'en' ? 'Physical state reset.' : '身体状态已重置。');
        } catch (e) {
            alert((lang === 'en' ? 'Reset failed: ' : '重置失败：') + (e.message || e));
        }
    };

    const handleSaveContact = async () => {
        if (!editingContact || contactSaveLock.current) return false;
        contactSaveLock.current = true;
        setSavingContact(true);
        setSaveError('');
        const submitted = editingContact;
        try {
            const data = await requestJson(apiUrl + '/characters', { method: 'POST', body: JSON.stringify(submitted) });
            const savedCharacter = data.character;
            if (!savedCharacter?.id)
                throw new Error(lang === 'en' ? 'Invalid character response' : '服务器未返回角色信息');
            setContacts((prev) =>
                prev.some((item) => String(item.id) === String(savedCharacter.id))
                    ? prev.map((item) =>
                          String(item.id) === String(savedCharacter.id) ? { ...item, ...savedCharacter } : item,
                      )
                    : [...prev, savedCharacter],
            );
            setEditingContact((current) => (current === submitted ? null : current));
            window.dispatchEvent(new Event('refresh_contacts'));
            if (onCharactersUpdate)
                onCharactersUpdate({ type: 'updated', id: savedCharacter.id, character: savedCharacter });
            return true;
        } catch (e) {
            setSaveError((lang === 'en' ? 'Character save failed: ' : '角色设置保存失败：') + e.message);
            return false;
        } finally {
            contactSaveLock.current = false;
            setSavingContact(false);
        }
    };

    const selectedSettingsContact = React.useMemo(() => {
        const base = contacts.find((c) => c.id === selectedSettingsContactId) || contacts[0] || null;
        return base
            ? {
                  ...base,
                  ...(characterMessageStatsById[base.id] || {}),
              }
            : null;
    }, [contacts, selectedSettingsContactId, characterMessageStatsById]);

    const openCharacterEditor = (character) => {
        if (!character) return;
        setEditingContact({
            ...character,
            avatar_frame: normalizeAvatarFrameId(character.avatar_frame),
            system_prompt: character.system_prompt || getDefaultGuidelines(lang),
            tts_provider: character.tts_provider || 'tencent',
            tts_trigger_mode: character.tts_trigger_mode || 'tagged',
        });
    };

    const ensureCharacterDraft = useCallback(
        (patch = {}) => {
            setEditingContact((prev) => {
                const base = prev ||
                    selectedSettingsContact || {
                        id: `character_${Date.now()}`,
                        name: lang === 'en' ? 'New Character' : '新角色',
                        avatar: '',
                        avatar_frame: 'none',
                        persona: '',
                        world_info: '',
                        system_prompt: getDefaultGuidelines(lang),
                        tts_provider: 'tencent',
                        tts_trigger_mode: 'tagged',
                        sys_proactive: 1,
                        sys_timer: 1,
                        sys_pressure: 1,
                        sys_jealousy: 1,
                        sys_survival: 1,
                        sys_city_social: 1,
                        llm_debug_capture: 1,
                        context_msg_limit: 60,
                        private_summary_threshold: 30,
                        interval_min: 10,
                        interval_max: 120,
                        max_tokens: 800,
                        wallet: 200,
                    };
                return {
                    ...base,
                    avatar_frame: normalizeAvatarFrameId(base.avatar_frame),
                    system_prompt: base.system_prompt || getDefaultGuidelines(lang),
                    tts_provider: base.tts_provider || 'tencent',
                    tts_trigger_mode: base.tts_trigger_mode || 'tagged',
                    ...patch,
                };
            });
        },
        [lang, selectedSettingsContact],
    );

    const updateCharacterDraft = useCallback(
        (patch) => {
            ensureCharacterDraft(patch);
        },
        [ensureCharacterDraft],
    );

    const applyLocalModelPreset = useCallback(
        (scope = 'main') => {
            if (scope === 'memory') {
                updateCharacterDraft({
                    memory_api_endpoint: LOCAL_OLLAMA_MODEL_PRESET.api_endpoint,
                    memory_api_key: LOCAL_OLLAMA_MODEL_PRESET.api_key,
                    memory_api_key_clear: false,
                    memory_model_name: LOCAL_OLLAMA_MODEL_PRESET.model_name,
                });
                setMemModels((prev) => withLocalModelOption(prev));
                setMemModelError('');
                return;
            }
            updateCharacterDraft({
                api_endpoint: LOCAL_OLLAMA_MODEL_PRESET.api_endpoint,
                api_key: LOCAL_OLLAMA_MODEL_PRESET.api_key,
                api_key_clear: false,
                model_name: LOCAL_OLLAMA_MODEL_PRESET.model_name,
            });
            setMainModels((prev) => withLocalModelOption(prev));
            setMainModelError('');
        },
        [setMainModelError, setMainModels, setMemModelError, setMemModels, updateCharacterDraft],
    );

    const handleMainModelSelect = useCallback(
        (modelName) => {
            if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
                applyLocalModelPreset('main');
                return;
            }
            updateCharacterDraft({ model_name: modelName });
        },
        [applyLocalModelPreset, updateCharacterDraft],
    );

    const handleMemoryModelSelect = useCallback(
        (modelName) => {
            if (modelName === LOCAL_OLLAMA_MODEL_PRESET.model_name) {
                applyLocalModelPreset('memory');
                return;
            }
            updateCharacterDraft({ memory_model_name: modelName });
        },
        [applyLocalModelPreset, updateCharacterDraft],
    );

    const selectControlCharacter = useCallback(
        (character) => {
            if (!character) return;
            if (editingContact && String(editingContact.id || '') !== String(character.id || '')) {
                const ok = window.confirm(
                    lang === 'en'
                        ? 'Discard the current unsaved character draft and switch?'
                        : '放弃当前未保存的角色草稿并切换吗？',
                );
                if (!ok) return;
                setEditingContact(null);
            }
            setSelectedSettingsContactId(character.id);
            setActiveSettingsScreen('characters');
        },
        [editingContact, lang, setActiveSettingsScreen],
    );

    const createCharacterDraft = () => {
        const id = `char_${Date.now()}`;
        setSelectedSettingsContactId(id);
        setActiveSettingsScreen('characters');
        setActiveCharacterTab('persona');
        setEditingContact({
            id,
            name: lang === 'en' ? 'New Character' : '新角色',
            avatar: '',
            avatar_frame: 'none',
            persona: '',
            world_info: '',
            system_prompt: getDefaultGuidelines(lang),
            api_endpoint: '',
            api_key: '',
            model_name: '',
            memory_api_endpoint: '',
            memory_api_key: '',
            memory_model_name: '',
            tts_provider: 'tencent',
            tts_trigger_mode: 'tagged',
            tts_enabled: 0,
            sys_proactive: 1,
            sys_timer: 1,
            sys_pressure: 1,
            sys_jealousy: 1,
            sys_survival: 1,
            sys_city_social: 1,
            llm_debug_capture: 1,
            context_msg_limit: 60,
            private_summary_threshold: 30,
            interval_min: 10,
            interval_max: 120,
            max_tokens: 800,
            wallet: 200,
            affinity: 50,
            energy: 100,
            calories: 2000,
            stress: 20,
            pressure_level: 0,
        });
    };

    const compareDraftValue = (record, field) => {
        if (field === 'system_prompt') return String(record?.system_prompt || getDefaultGuidelines(lang));
        if (
            [
                'sys_proactive',
                'sys_timer',
                'sys_pressure',
                'sys_jealousy',
                'sys_survival',
                'sys_city_social',
                'llm_debug_capture',
                'tts_enabled',
                'tts_autoplay',
            ].includes(field)
        ) {
            return Number(record?.[field] ?? 0);
        }
        if (
            [
                'max_tokens',
                'context_msg_limit',
                'private_summary_threshold',
                'interval_min',
                'interval_max',
                'wallet',
                'affinity',
                'energy',
                'calories',
                'stress',
                'pressure_level',
                'sleep_debt',
                'sleep_pressure',
                'mood',
                'social_need',
                'health',
                'satiety',
                'stomach_load',
            ].includes(field)
        ) {
            return Number(record?.[field] ?? 0);
        }
        return String(record?.[field] ?? '');
    };

    const draftCompareFields = [
        'id',
        'name',
        'avatar',
        'avatar_frame',
        'persona',
        'world_info',
        'system_prompt',
        'api_endpoint',
        'model_name',
        'memory_api_endpoint',
        'memory_model_name',
        'max_tokens',
        'context_msg_limit',
        'private_summary_threshold',
        'interval_min',
        'interval_max',
        'sys_proactive',
        'sys_timer',
        'sys_pressure',
        'sys_jealousy',
        'sys_survival',
        'sys_city_social',
        'llm_debug_capture',
        'wallet',
        'affinity',
        'energy',
        'calories',
        'stress',
        'pressure_level',
        'sleep_debt',
        'sleep_pressure',
        'mood',
        'social_need',
        'health',
        'satiety',
        'stomach_load',
        'tts_provider',
        'tts_voice',
        'tts_model',
        'tts_endpoint',
        'tts_trigger_mode',
        'tts_enabled',
        'tts_autoplay',
    ];

    const selectedOriginalForDraft =
        selectedSettingsContact && editingContact && String(selectedSettingsContact.id) === String(editingContact.id)
            ? selectedSettingsContact
            : null;

    const characterDraftChanged = Boolean(
        editingContact &&
            (!selectedOriginalForDraft ||
                draftCompareFields.some(
                    (field) =>
                        compareDraftValue(editingContact, field) !== compareDraftValue(selectedOriginalForDraft, field),
                ) ||
                Boolean(
                    editingContact.api_key ||
                        editingContact.api_key_clear ||
                        editingContact.memory_api_key ||
                        editingContact.memory_api_key_clear ||
                        editingContact.tts_api_key ||
                        editingContact.tts_api_key_clear,
                )),
    );

    const controlHasContextLimitChange = Boolean(
        editingContact &&
            selectedOriginalForDraft &&
            Number(editingContact.context_msg_limit ?? 60) !== Number(selectedOriginalForDraft.context_msg_limit ?? 60),
    );

    const controlHasModelChange = Boolean(
        editingContact &&
            selectedOriginalForDraft &&
            (compareDraftValue(editingContact, 'api_endpoint') !==
                compareDraftValue(selectedOriginalForDraft, 'api_endpoint') ||
                compareDraftValue(editingContact, 'model_name') !==
                    compareDraftValue(selectedOriginalForDraft, 'model_name') ||
                compareDraftValue(editingContact, 'memory_api_endpoint') !==
                    compareDraftValue(selectedOriginalForDraft, 'memory_api_endpoint') ||
                compareDraftValue(editingContact, 'memory_model_name') !==
                    compareDraftValue(selectedOriginalForDraft, 'memory_model_name') ||
                Boolean(
                    editingContact.api_key ||
                        editingContact.api_key_clear ||
                        editingContact.memory_api_key ||
                        editingContact.memory_api_key_clear,
                )),
    );

    const controlHasTimerChange = Boolean(
        editingContact &&
            selectedOriginalForDraft &&
            (compareDraftValue(editingContact, 'interval_min') !==
                compareDraftValue(selectedOriginalForDraft, 'interval_min') ||
                compareDraftValue(editingContact, 'interval_max') !==
                    compareDraftValue(selectedOriginalForDraft, 'interval_max') ||
                compareDraftValue(editingContact, 'sys_proactive') !==
                    compareDraftValue(selectedOriginalForDraft, 'sys_proactive')),
    );

    const controlHasVoiceChange = Boolean(
        editingContact &&
            selectedOriginalForDraft &&
            ([
                'tts_provider',
                'tts_voice',
                'tts_model',
                'tts_endpoint',
                'tts_trigger_mode',
                'tts_enabled',
                'tts_autoplay',
            ].some(
                (field) =>
                    compareDraftValue(editingContact, field) !== compareDraftValue(selectedOriginalForDraft, field),
            ) ||
                Boolean(editingContact.tts_api_key || editingContact.tts_api_key_clear)),
    );

    const controlChangeCount = [
        characterDraftChanged,
        controlHasModelChange,
        controlHasTimerChange,
        controlHasContextLimitChange,
        controlHasVoiceChange,
    ].filter(Boolean).length;

    return {
        selectedSettingsContactId,
        contacts,
        selectedSettingsContact,
        setSelectedSettingsContactId,
        openCharacterEditor,
        editingContact,
        characterDraftChanged,
        controlChangeCount,
        handleSaveContact,
        savingContact,
        createCharacterDraft,
        selectControlCharacter,
        updateCharacterDraft,
        selectedOriginalForDraft,
        applyLocalModelPreset,
        handleMainModelSelect,
        handleMemoryModelSelect,
        handleExportCharacterData,
        handleImportCharacterData,
        handleResetPhysicalState,
        handleWipeData,
        handleDeleteContact,
        controlHasContextLimitChange,
        controlHasModelChange,
        controlHasVoiceChange,
    };
}
