import { useState, useMemo, useCallback, useEffect } from 'react';
import { emptyAgency, text } from './housingLabels.js';

export function useHousingData() {
    const [loading, setLoading] = useState(true);

    const [socialClasses, setSocialClasses] = useState([]);

    const [housingTiers, setHousingTiers] = useState([]);

    const [characters, setCharacters] = useState([]);

    const [districts, setDistricts] = useState([]);

    const [agencyModelOptions, setAgencyModelOptions] = useState([]);

    const [agencyAds, setAgencyAds] = useState([]);

    const [rentalChains, setRentalChains] = useState([]);

    const [rentalChainEvents, setRentalChainEvents] = useState({});

    const [, setPublicAgencyAnnouncements] = useState([]);

    const [agencyForm, setAgencyForm] = useState(emptyAgency);

    const [agencyError, setAgencyError] = useState('');

    const headers = useMemo(() => {
        const token = localStorage.getItem('cp_token') || '';
        return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' };
    }, []);

    const requestJson = useCallback(async (url, options = {}) => {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false)
            throw new Error(data.error || `${text.requestFailed}${response.status}`);
        return data;
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const data = await requestJson('/api/social-housing/bootstrap', { headers });
            setSocialClasses(data.classes || []);
            setHousingTiers(data.housing_tiers || []);
            setCharacters(data.characters || []);
            setDistricts(data.districts || []);
            setAgencyModelOptions(data.agency_model_options || []);
            setAgencyAds(data.agency_ads || []);
            setRentalChains(data.rental_chains || []);
            setRentalChainEvents(data.rental_chain_events || {});
            setPublicAgencyAnnouncements(data.public_agency_announcements || []);
            setAgencyForm({ ...emptyAgency, ...(data.agency || {}) });
            setAgencyError(data.agency?.last_error || '');
        } finally {
            setLoading(false);
        }
    }, [headers, requestJson]);

    useEffect(() => {
        loadAll().catch((e) => {
            console.error(e);
            alert(e.message || text.loadFailed);
        });
    }, [loadAll]);

    return {
        housingTiers,
        districts,
        agencyModelOptions,
        characters,
        socialClasses,
        requestJson,
        headers,
        setHousingTiers,
        setAgencyAds,
        setSocialClasses,
        loadAll,
        setCharacters,
        setRentalChains,
        setRentalChainEvents,
        agencyForm,
        setAgencyError,
        setAgencyForm,
        agencyAds,
        rentalChains,
        rentalChainEvents,
        loading,
        agencyError,
    };
}
