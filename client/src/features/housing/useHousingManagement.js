import { useState } from 'react';
import { emptyAgency, emptyHome, emptySocialClass, text, promptStyles } from './housingLabels.js';

export function useHousingManagement({
    requestJson,
    headers,
    setHousingTiers,
    setAgencyAds,
    setSocialClasses,
    isEn,
    loadAll,
    setCharacters,
    agencyForm,
    setAgencyError,
    setAgencyForm,
    housingTiers,
}) {
    const [homeForm, setHomeForm] = useState(emptyHome);

    const [classForm, setClassForm] = useState(emptySocialClass);

    const [editingClassId, setEditingClassId] = useState('');

    const [editingHomeId, setEditingHomeId] = useState('');

    const [savingBindingId, setSavingBindingId] = useState('');

    const [savingAgency, setSavingAgency] = useState(false);

    const [publishingAgency, setPublishingAgency] = useState(false);

    const [agencyTemplateKey, setAgencyTemplateKey] = useState('street');

    const [showCustomHomeEditor, setShowCustomHomeEditor] = useState(false);

    const [homeNotice, setHomeNotice] = useState('');

    const saveHome = async (payload = homeForm) => {
        const data = await requestJson('/api/social-housing/housing', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });
        setHousingTiers(data.housing_tiers || []);
        setHomeForm(emptyHome);
        setEditingHomeId('');
        setShowCustomHomeEditor(false);
    };

    const deleteHome = async (id) => {
        const data = await requestJson(`/api/social-housing/housing/${id}`, { method: 'DELETE', headers });
        setHousingTiers(data.housing_tiers || []);
        setAgencyAds(data.agency_ads || []);
    };

    const saveSocialClass = async (payload = classForm) => {
        const commonLocations = Array.isArray(payload.common_locations)
            ? payload.common_locations
            : String(payload.common_locations || '')
                  .split(/[\n,，]/)
                  .map((item) => item.trim())
                  .filter(Boolean);
        const data = await requestJson('/api/social-housing/classes', {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...payload, common_locations: commonLocations }),
        });
        setSocialClasses(data.classes || []);
        setClassForm(emptySocialClass);
        setEditingClassId('');
    };

    const deleteSocialClass = async (id) => {
        const ok = window.confirm(
            isEn
                ? 'Deleting this class clears bound character class links and may affect recommendations and agency explanations. Continue?'
                : '删除这个阶层会清空已绑定角色的阶层，并影响推荐解释和中介推荐理由。确定删除吗？',
        );
        if (!ok) return;
        const data = await requestJson(`/api/social-housing/classes/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers,
        });
        setSocialClasses(data.classes || []);
        if (String(editingClassId) === String(id)) {
            setClassForm(emptySocialClass);
            setEditingClassId('');
        }
    };

    const beginEditSocialClass = (item) => {
        setEditingClassId(String(item.id || ''));
        setClassForm({
            ...emptySocialClass,
            ...item,
            common_locations: Array.isArray(item.common_locations)
                ? item.common_locations.join(', ')
                : item.common_locations || '',
        });
    };

    const deleteAgencyAd = async (id) => {
        await requestJson(`/api/social-housing/agency/ads/${id}`, { method: 'DELETE', headers });
        await loadAll();
    };

    const refreshCharacterWallet = async (id) => {
        if (!id) return null;
        const data = await requestJson(`/api/wallet/${encodeURIComponent(id)}`, { headers });
        const wallet = Number(data.wallet ?? 0);
        setCharacters((current) =>
            current.map((item) => (String(item.id) === String(id) ? { ...item, wallet } : item)),
        );
        return wallet;
    };

    const updateBinding = async (id, binding) => {
        setSavingBindingId(id);
        try {
            const data = await requestJson(`/api/social-housing/characters/${id}/binding`, {
                method: 'POST',
                headers,
                body: JSON.stringify(binding),
            });
            setCharacters(data.characters || []);
        } finally {
            setSavingBindingId('');
        }
    };

    const payRent = async (id) => {
        setSavingBindingId(id);
        try {
            await refreshCharacterWallet(id);
            const data = await requestJson(`/api/social-housing/characters/${id}/pay-rent`, {
                method: 'POST',
                headers,
            });
            setCharacters(data.characters || []);
        } finally {
            setSavingBindingId('');
        }
    };

    const saveAgency = async (payload = agencyForm) => {
        setSavingAgency(true);
        setAgencyError('');
        try {
            const data = await requestJson('/api/social-housing/agency', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            setAgencyForm({ ...emptyAgency, ...(data.agency || {}) });
        } catch (e) {
            setAgencyError(e.message || 'agency failed');
            throw e;
        } finally {
            setSavingAgency(false);
        }
    };

    const publishAgency = async () => {
        setPublishingAgency(true);
        setAgencyError('');
        try {
            await requestJson('/api/social-housing/agency/publish-ad', { method: 'POST', headers });
            await loadAll();
        } catch (e) {
            setAgencyError(e.message || 'ad failed');
            throw e;
        } finally {
            setPublishingAgency(false);
        }
    };

    const updateAgencyField = (key, value) => setAgencyForm((prev) => ({ ...prev, [key]: value }));

    const saveAgencyField = async (key, value) => {
        const next = { ...agencyForm, [key]: value };
        setAgencyForm(next);
        await saveAgency(next);
    };

    const applyHomePreset = async (preset) => {
        const existing = housingTiers.find((item) => String(item.id) === String(preset.values.id));
        if (existing) {
            beginEditHome(existing);
            setHomeNotice(text.homeOpened);
            return;
        }
        await saveHome({ ...emptyHome, ...preset.values });
        setHomeNotice(text.homeApplied);
    };

    const beginEditHome = (item) => {
        setEditingHomeId(String(item.id));
        setHomeForm({ ...emptyHome, ...item });
        setShowCustomHomeEditor(true);
    };

    const applyAgencyTemplate = (key) => {
        setAgencyTemplateKey(key);
        const preset = promptStyles.find((item) => item.key === key);
        if (preset) setAgencyForm((prev) => ({ ...prev, persona_prompt: preset.prompt }));
    };

    return {
        refreshCharacterWallet,
        agencyTemplateKey,
        setAgencyTemplateKey,
        publishingAgency,
        applyAgencyTemplate,
        publishAgency,
        setEditingHomeId,
        setHomeForm,
        setShowCustomHomeEditor,
        homeNotice,
        beginEditHome,
        deleteHome,
        applyHomePreset,
        savingBindingId,
        updateBinding,
        payRent,
        classForm,
        setClassForm,
        saveSocialClass,
        editingClassId,
        setEditingClassId,
        beginEditSocialClass,
        deleteSocialClass,
        saveAgencyField,
        updateAgencyField,
        saveAgency,
        savingAgency,
        deleteAgencyAd,
        showCustomHomeEditor,
        editingHomeId,
        homeForm,
        saveHome,
    };
}
