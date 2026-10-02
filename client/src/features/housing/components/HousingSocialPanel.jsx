import { useLanguage } from '../../../shared/i18n/LanguageContext.jsx';
import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    defaultDistrictOptions,
    defaultDistrictNameEn,
    promptStyleLabelsEn,
    homePresetEn,
    text,
} from '../housingLabels.js';
import {
    getChainEventsForDisplay,
    buildViewingDialogue,
    getChainNote,
    parseChainPayload,
} from '../housingFormatting.js';
import {
    Home,
    MessageSquareText,
    Eye,
    NotebookText,
    Brain,
    Scale,
    KeyRound,
    Building2,
    Users,
    BadgeCent,
    Store,
    ScrollText,
    HouseHeart,
    Sparkles,
    WandSparkles,
    Settings2,
} from 'lucide-react';
import { shell } from '../housingPresentation.js';
import { HousingStoryView } from './HousingStoryView.jsx';
import { HousingAgencyView } from './HousingAgencyView.jsx';
import { HousingManagementDrawer } from './HousingManagementDrawer.jsx';
import { RoomAssemblyDialog } from './RoomAssemblyDialog.jsx';
import { HomeEditorDialog } from './HomeEditorDialog.jsx';
import './HousingSocialPanel.css';
import { useHousingData } from '../useHousingData.js';
import { useHousingRoomAssembly } from '../useHousingRoomAssembly.js';
import { useHousingManagement } from '../useHousingManagement.js';

export default function HousingSocialPanel() {
    const { lang } = useLanguage();
    const isEn = lang === 'en';

    const [recommendCharacterId, setRecommendCharacterId] = useState('');
    const [recommendHousingId, setRecommendHousingId] = useState('');
    const [housingChainBusy, setHousingChainBusy] = useState(false);
    const [housingChainNotice, setHousingChainNotice] = useState('');
    const [activeHousingView, setActiveHousingView] = useState('story');
    const [managementOpen, setManagementOpen] = useState(false);
    const [managementTab, setManagementTab] = useState('homes');
    const [storyStepIndex, setStoryStepIndex] = useState(0);

    const {
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
    } = useHousingData({});

    const housingById = useMemo(() => new Map(housingTiers.map((item) => [String(item.id), item])), [housingTiers]);

    const resolvedDistrictOptions = useMemo(() => {
        if (Array.isArray(districts) && districts.length > 0) return districts;
        return defaultDistrictOptions;
    }, [districts]);
    const resolvedAgencyModelOptions = useMemo(() => {
        const normalized = Array.isArray(agencyModelOptions) ? agencyModelOptions.filter(Boolean) : [];
        if (normalized.length > 0) return normalized;
        return characters
            .filter((item) => item?.api_endpoint && item?.api_key && item?.model_name)
            .map((item) => ({
                id: String(item.id),
                name: String(item.name || item.id),
                model_name: String(item.model_name || ''),
                api_endpoint: String(item.api_endpoint || ''),
            }));
    }, [agencyModelOptions, characters]);

    const {
        roomAssemblySnapshot,
        selectedRoomAssemblyHome,
        setRoomAssemblyHomeId,
        roomAssemblyHomes,
        currentRoomAssemblySizeProfile,
        roomAssemblyNotice,
        roomAssemblySaving,
        runRoomAssembly,
        setShowRoomAssemblyModal,
        showRoomAssemblyModal,
    } = useHousingRoomAssembly({ housingTiers, isEn, requestJson, headers });

    const sortedHousingTiers = useMemo(
        () =>
            [...housingTiers].sort(
                (a, b) =>
                    Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
                    Number(a.weekly_rent || 0) - Number(b.weekly_rent || 0),
            ),
        [housingTiers],
    );
    const sortedSocialClasses = useMemo(
        () =>
            [...socialClasses].sort(
                (a, b) =>
                    Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
                    String(a.name || '').localeCompare(String(b.name || '')),
            ),
        [socialClasses],
    );
    const availableHousingTiers = useMemo(
        () => sortedHousingTiers.filter((item) => Number(item.is_enabled ?? 1) === 1),
        [sortedHousingTiers],
    );
    const housedCharacters = useMemo(() => characters.filter((item) => item.binding?.housing_id), [characters]);

    const recommendableCharacters = useMemo(() => characters.filter((item) => !item.binding?.housing_id), [characters]);
    const selectedRecommendationCharacter = useMemo(
        () =>
            recommendableCharacters.find((item) => String(item.id) === String(recommendCharacterId)) ||
            recommendableCharacters[0] ||
            null,
        [recommendableCharacters, recommendCharacterId],
    );
    const selectedRecommendationHome = useMemo(
        () =>
            availableHousingTiers.find((item) => String(item.id) === String(recommendHousingId)) ||
            availableHousingTiers[0] ||
            null,
        [availableHousingTiers, recommendHousingId],
    );

    const districtDisplayName = useCallback(
        (item) => (isEn ? defaultDistrictNameEn[item?.id] || item?.name || item?.id : item?.name || item?.id),
        [isEn],
    );
    const promptStyleLabel = useCallback(
        (item) => (isEn ? promptStyleLabelsEn[item?.key] || item?.label : item?.label),
        [isEn],
    );
    const homePresetLabel = useCallback(
        (preset, field) => (isEn ? homePresetEn[preset?.key]?.[field] || preset?.[field] : preset?.[field]),
        [isEn],
    );

    useEffect(() => {
        if (!recommendableCharacters.length) {
            if (recommendCharacterId) setRecommendCharacterId('');
            return;
        }
        const stillEligible = recommendableCharacters.some((item) => String(item.id) === String(recommendCharacterId));
        if (!recommendCharacterId || !stillEligible) {
            setRecommendCharacterId(String(recommendableCharacters[0].id));
        }
    }, [recommendableCharacters, recommendCharacterId]);
    useEffect(() => {
        if (!availableHousingTiers.length) {
            if (recommendHousingId) setRecommendHousingId('');
            return;
        }
        const stillAvailable = availableHousingTiers.some((item) => String(item.id) === String(recommendHousingId));
        if (!recommendHousingId || !stillAvailable) {
            setRecommendHousingId(String(availableHousingTiers[0].id));
        }
    }, [availableHousingTiers, recommendHousingId]);

    const recommendHomeToCharacter = async () => {
        if (!selectedRecommendationCharacter || !selectedRecommendationHome) return;
        setHousingChainBusy(true);
        setHousingChainNotice(text.chainRunning);
        try {
            await refreshCharacterWallet(selectedRecommendationCharacter.id);
            const data = await requestJson(
                `/api/social-housing/characters/${selectedRecommendationCharacter.id}/recommend-home`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ home_id: selectedRecommendationHome.id, run_full_chain: true }),
                },
            );
            setCharacters(data.characters || []);
            setRentalChains(data.rental_chains || []);
            setRentalChainEvents((prev) => ({
                ...prev,
                ...(data.rental_chain_events || {}),
                ...(data.chain?.id ? { [String(data.chain.id)]: data.chain_events || [] } : {}),
            }));
            const label =
                data.outcome === 'signed'
                    ? text.signed
                    : data.outcome === 'declined'
                      ? text.declined
                      : data.outcome === 'rejected_insufficient_funds'
                        ? text.rejectedInsufficientFunds
                        : data.outcome || text.completed;
            setHousingChainNotice(`${text.chainResult}: ${label}`);
        } catch (e) {
            await loadAll().catch(() => {});
            setHousingChainNotice(`${text.chainFailed}: ${e.message}`);
            throw e;
        } finally {
            setHousingChainBusy(false);
        }
    };

    const {
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
    } = useHousingManagement({
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
    });

    const visibleAgencyAds = useMemo(() => agencyAds || [], [agencyAds]);
    const housedCount = characters.filter((c) => c.binding?.housing_id).length;
    const homelessCount = characters.length - housedCount;

    const activeChain = rentalChains[0] || null;
    const activeChainEvents = useMemo(
        () => (activeChain ? getChainEventsForDisplay(rentalChainEvents, activeChain.id) : []),
        [activeChain, rentalChainEvents],
    );
    const activeViewingDialogue = useMemo(() => buildViewingDialogue(activeChainEvents), [activeChainEvents]);
    const activeConsideration = useMemo(() => getChainNote(activeChainEvents, 'consideration'), [activeChainEvents]);
    const activeDecision = useMemo(() => getChainNote(activeChainEvents, 'decision'), [activeChainEvents]);
    const latestAgencyAd = visibleAgencyAds[0] || null;
    const visualStageIndex = useMemo(() => {
        if (!activeChain) return 0;
        if (activeChain.status === 'completed') return 6;
        const stage = String(activeChain.stage || 'recommended');
        if (stage === 'viewing') return 2;
        if (stage === 'considering') return 4;
        if (stage === 'deciding') return 5;
        if (stage === 'ready_to_sign' || stage === 'signing' || stage === 'completed') return 6;
        return 0;
    }, [activeChain]);

    useEffect(() => {
        setStoryStepIndex(visualStageIndex);
    }, [activeChain?.id, visualStageIndex]);

    const chainEventText = (types = []) => {
        const event = activeChainEvents.find((item) => types.includes(item.event_type));
        if (!event) return '';
        const payload = parseChainPayload(event);
        return String(
            payload.log ||
                payload.message ||
                payload.summary ||
                payload.reason ||
                payload.content ||
                payload.invitation ||
                payload.agent_intro ||
                '',
        ).trim();
    };
    const pairLabel = `${selectedRecommendationCharacter?.name || text.noHomelessCharacters} → ${selectedRecommendationHome ? `${selectedRecommendationHome.emoji || ''}${selectedRecommendationHome.name || selectedRecommendationHome.id}` : text.noAvailableHomes}`;
    const activeChainLabel = activeChain
        ? `${activeChain.character_name || activeChain.character_id || text.character} → ${activeChain.home_emoji || ''}${activeChain.home_name || activeChain.home_id || text.selectedHome}`
        : pairLabel;
    const roomAssemblyPreviewImage = roomAssemblySnapshot?.previewImage?.dataUrl || '';
    const inviteText = chainEventText(['invitation', 'invite', 'agent_invite']);
    const viewingPreviewLine = activeViewingDialogue?.lines?.[0]?.content || '';
    const storySteps = [
        {
            icon: Home,
            label: isEn ? 'Recommend' : '推荐',
            sub: isEn ? 'Match listing' : '匹配房源',
            title: activeChain
                ? isEn
                    ? 'Recommendation created'
                    : '已生成推荐'
                : isEn
                  ? 'Waiting for recommendation'
                  : '等待推荐房源',
            body:
                chainEventText(['recommended', 'recommendation']) ||
                (activeChain
                    ? `${activeChainLabel}。`
                    : isEn
                      ? 'Pick a homeless role and an enabled listing, then start the complete rental story.'
                      : '选择无房角色和启用房源后，开始完整租房故事。'),
        },
        {
            icon: MessageSquareText,
            label: isEn ? 'Invite' : '邀约',
            sub: isEn ? 'Agent chat' : '中介私聊',
            title: isEn ? 'Viewing invitation' : '中介发出看房邀请',
            body:
                inviteText ||
                viewingPreviewLine ||
                (activeChain
                    ? isEn
                        ? 'The agent has moved the story toward a viewing conversation.'
                        : '中介已经把链路推进到看房沟通。'
                    : isEn
                      ? 'The invitation appears after the story starts.'
                      : '故事开始后会在这里展示邀约内容。'),
        },
        {
            icon: Eye,
            label: isEn ? 'Viewing' : '看房',
            sub: isEn ? 'Observe and talk' : '观察与对话',
            title: isEn ? 'Viewing conversation' : '角色正在看房',
            body:
                viewingPreviewLine ||
                activeViewingDialogue?.summary ||
                (isEn ? 'No viewing dialogue yet.' : '还没有看房对话。'),
        },
        {
            icon: NotebookText,
            label: isEn ? 'Summary' : '总结',
            sub: isEn ? 'Impressions' : '看房感受',
            title: isEn ? 'Viewing summary' : '整理看房感受',
            body:
                activeViewingDialogue?.summary ||
                (isEn ? 'The viewing summary will appear after a viewing round.' : '看房总结会在看房轮次后出现。'),
        },
        {
            icon: Brain,
            label: isEn ? 'Consider' : '考虑',
            sub: isEn ? 'Budget and taste' : '预算与偏好',
            title: isEn ? 'Character consideration' : '角色认真考虑中',
            body: activeConsideration || (isEn ? 'No consideration note yet.' : '还没有考虑记录。'),
        },
        {
            icon: Scale,
            label: isEn ? 'Decision' : '决定',
            sub: isEn ? 'Accept or decline' : '接受或拒绝',
            title: isEn ? 'Final decision' : '角色做出决定',
            body:
                activeDecision ||
                activeChain?.error_message ||
                (isEn ? 'Decision will appear when the chain reaches this stage.' : '链路进入决定阶段后会显示结果。'),
        },
        {
            icon: KeyRound,
            label: isEn ? 'Sign' : '签约',
            sub: isEn ? 'Write housing' : '写入住房',
            title:
                activeChain?.status === 'failed'
                    ? text.chainFailed
                    : isEn
                      ? 'Signing and housing write'
                      : '签约并写入住房',
            body:
                activeChain?.error_message ||
                (activeChain?.status === 'completed'
                    ? isEn
                        ? 'The housing binding has been written.'
                        : '住房绑定已经写入。'
                    : isEn
                      ? 'Signing waits for the completed chain result.'
                      : '签约状态会等待完整链路结果。'),
        },
    ];
    const activeStoryStep = storySteps[Math.min(Math.max(storyStepIndex, 0), storySteps.length - 1)] || storySteps[0];
    const rentStress = selectedRecommendationHome
        ? Math.min(
              100,
              Math.round(
                  (Number(selectedRecommendationHome.weekly_rent || 0) /
                      Math.max(Number(selectedRecommendationCharacter?.wallet || 0), 1)) *
                      180,
              ),
          )
        : 0;
    const comfortSignal = selectedRecommendationHome
        ? Math.min(100, Math.round((Number(selectedRecommendationHome.comfort || 0) / 60) * 100))
        : 0;
    const privacySignal = selectedRecommendationHome
        ? Math.min(100, Math.round((Number(selectedRecommendationHome.privacy || 0) / 60) * 100))
        : 0;
    const signalLabel = (value) =>
        value >= 72 ? (isEn ? 'High' : '高') : value >= 42 ? (isEn ? 'Medium' : '中等') : isEn ? 'Low' : '低';
    const managementTabs = [
        {
            key: 'homes',
            icon: Building2,
            label: text.catalog,
            desc: isEn ? 'Create, edit, enable, disable and delete listings.' : '新增、编辑、启停与删除房源。',
        },
        {
            key: 'residents',
            icon: Users,
            label: text.roleBinding,
            desc: isEn ? 'Housing bindings, rent cycles and rent collection.' : '绑定状态、交租周期和欠租处理。',
        },
        {
            key: 'classes',
            icon: BadgeCent,
            label: text.classProfiles,
            desc: isEn ? 'Budget, spending, prestige and location rules.' : '预算、消费、声望与常去地点规则。',
        },
        {
            key: 'agency',
            icon: Store,
            label: text.agencyAi,
            desc: isEn ? 'Model role, persona prompt and interval settings.' : '模型角色、人格提示和决策间隔。',
        },
        {
            key: 'history',
            icon: ScrollText,
            label: isEn ? 'History' : '历史记录',
            desc: isEn ? 'All rental chains and agency ads.' : '全部租房链路和中介广告。',
        },
    ];

    if (loading) return <div style={{ padding: 24, color: '#64748b' }}>{text.loading}</div>;

    return (
        <div id="housing-core-loop-redesign" style={shell.page} className="housing-panel">
            <section
                className="housing-play-shell"
                aria-label={isEn ? 'Housing system core loop' : '住房系统核心玩法布局'}
            >
                <header className="housing-play-header">
                    <div className="housing-play-brand">
                        <span className="housing-play-logo">
                            <HouseHeart size={18} />
                        </span>
                        <div>
                            <strong>{text.title}</strong>
                            <small>
                                {isEn
                                    ? 'Rental stories, agency ads, and room staging'
                                    : '租房故事、中介广告和样板间布置'}
                            </small>
                        </div>
                    </div>
                    <nav className="housing-play-tabs" aria-label={isEn ? 'Housing sections' : '住房系统主要功能'}>
                        <button
                            type="button"
                            className={activeHousingView === 'story' ? 'is-active' : ''}
                            aria-pressed={activeHousingView === 'story'}
                            onClick={() => setActiveHousingView('story')}
                        >
                            <Sparkles size={15} />
                            {isEn ? 'Rental Story' : '租房故事'}
                        </button>
                        <button
                            type="button"
                            className={activeHousingView === 'agency' ? 'is-active' : ''}
                            aria-pressed={activeHousingView === 'agency'}
                            onClick={() => setActiveHousingView('agency')}
                        >
                            <WandSparkles size={15} />
                            {isEn ? 'Agency AI Studio' : '中介 AI 创作室'}
                        </button>
                    </nav>
                    <div className="housing-play-utilities">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                                setManagementTab('homes');
                                setManagementOpen(true);
                            }}
                        >
                            <Building2 size={15} />
                            {isEn ? 'Manage Listings' : '房源管理'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost housing-icon-only"
                            onClick={() => {
                                setManagementTab('agency');
                                setManagementOpen(true);
                            }}
                            aria-label={isEn ? 'Agency settings' : '中介设置'}
                        >
                            <Settings2 size={15} />
                        </button>
                    </div>
                </header>

                <main className="housing-play-main">
                    {activeHousingView === 'story' ? (
                        <HousingStoryView
                            isEn={isEn}
                            homelessCount={homelessCount}
                            recommendableCharacters={recommendableCharacters}
                            recommendCharacterId={recommendCharacterId}
                            setRecommendCharacterId={setRecommendCharacterId}
                            housingChainBusy={housingChainBusy}
                            availableHousingTiers={availableHousingTiers}
                            recommendHousingId={recommendHousingId}
                            setRecommendHousingId={setRecommendHousingId}
                            selectedRecommendationCharacter={selectedRecommendationCharacter}
                            pairLabel={pairLabel}
                            selectedRecommendationHome={selectedRecommendationHome}
                            recommendHomeToCharacter={recommendHomeToCharacter}
                            housingChainNotice={housingChainNotice}
                            activeChain={activeChain}
                            storySteps={storySteps}
                            storyStepIndex={storyStepIndex}
                            visualStageIndex={visualStageIndex}
                            setStoryStepIndex={setStoryStepIndex}
                            activeStoryStep={activeStoryStep}
                            activeViewingDialogue={activeViewingDialogue}
                            activeChainLabel={activeChainLabel}
                            signalLabel={signalLabel}
                            rentStress={rentStress}
                            comfortSignal={comfortSignal}
                            privacySignal={privacySignal}
                            activeDecision={activeDecision}
                            activeConsideration={activeConsideration}
                            setActiveHousingView={setActiveHousingView}
                        />
                    ) : (
                        <HousingAgencyView
                            isEn={isEn}
                            setManagementTab={setManagementTab}
                            setManagementOpen={setManagementOpen}
                            recommendHousingId={recommendHousingId}
                            setRecommendHousingId={setRecommendHousingId}
                            availableHousingTiers={availableHousingTiers}
                            agencyTemplateKey={agencyTemplateKey}
                            setAgencyTemplateKey={setAgencyTemplateKey}
                            promptStyleLabel={promptStyleLabel}
                            publishingAgency={publishingAgency}
                            applyAgencyTemplate={applyAgencyTemplate}
                            publishAgency={publishAgency}
                            latestAgencyAd={latestAgencyAd}
                            agencyForm={agencyForm}
                            agencyError={agencyError}
                            selectedRoomAssemblyHome={selectedRoomAssemblyHome}
                            setRoomAssemblyHomeId={setRoomAssemblyHomeId}
                            roomAssemblyHomes={roomAssemblyHomes}
                            roomAssemblyPreviewImage={roomAssemblyPreviewImage}
                            roomAssemblySnapshot={roomAssemblySnapshot}
                            currentRoomAssemblySizeProfile={currentRoomAssemblySizeProfile}
                            roomAssemblyNotice={roomAssemblyNotice}
                            roomAssemblySaving={roomAssemblySaving}
                            runRoomAssembly={runRoomAssembly}
                            setShowRoomAssemblyModal={setShowRoomAssemblyModal}
                        />
                    )}
                </main>

                {managementOpen ? (
                    <HousingManagementDrawer
                        isEn={isEn}
                        setManagementOpen={setManagementOpen}
                        managementTabs={managementTabs}
                        managementTab={managementTab}
                        setManagementTab={setManagementTab}
                        setEditingHomeId={setEditingHomeId}
                        setHomeForm={setHomeForm}
                        setShowCustomHomeEditor={setShowCustomHomeEditor}
                        setShowRoomAssemblyModal={setShowRoomAssemblyModal}
                        homeNotice={homeNotice}
                        sortedHousingTiers={sortedHousingTiers}
                        beginEditHome={beginEditHome}
                        deleteHome={deleteHome}
                        applyHomePreset={applyHomePreset}
                        homePresetLabel={homePresetLabel}
                        housedCharacters={housedCharacters}
                        housingById={housingById}
                        savingBindingId={savingBindingId}
                        updateBinding={updateBinding}
                        payRent={payRent}
                        classForm={classForm}
                        setClassForm={setClassForm}
                        saveSocialClass={saveSocialClass}
                        editingClassId={editingClassId}
                        setEditingClassId={setEditingClassId}
                        sortedSocialClasses={sortedSocialClasses}
                        beginEditSocialClass={beginEditSocialClass}
                        deleteSocialClass={deleteSocialClass}
                        agencyForm={agencyForm}
                        setAgencyForm={setAgencyForm}
                        saveAgencyField={saveAgencyField}
                        resolvedDistrictOptions={resolvedDistrictOptions}
                        districtDisplayName={districtDisplayName}
                        resolvedAgencyModelOptions={resolvedAgencyModelOptions}
                        updateAgencyField={updateAgencyField}
                        saveAgency={saveAgency}
                        savingAgency={savingAgency}
                        visibleAgencyAds={visibleAgencyAds}
                        deleteAgencyAd={deleteAgencyAd}
                        rentalChains={rentalChains}
                        rentalChainEvents={rentalChainEvents}
                    />
                ) : null}

                <footer className="housing-play-footer">
                    <span>
                        <i />
                        {isEn ? 'Housing service online' : '住房服务正常'}
                    </span>
                    <span>
                        {homelessCount} {text.homeless} · {availableHousingTiers.length} {text.sellableHomes} ·{' '}
                        {rentalChains.length} {text.recentChains}
                    </span>
                </footer>
            </section>
            {showRoomAssemblyModal ? (
                <RoomAssemblyDialog
                    setShowRoomAssemblyModal={setShowRoomAssemblyModal}
                    selectedRoomAssemblyHome={selectedRoomAssemblyHome}
                    setRoomAssemblyHomeId={setRoomAssemblyHomeId}
                    roomAssemblyHomes={roomAssemblyHomes}
                    currentRoomAssemblySizeProfile={currentRoomAssemblySizeProfile}
                    roomAssemblySaving={roomAssemblySaving}
                    runRoomAssembly={runRoomAssembly}
                    roomAssemblyNotice={roomAssemblyNotice}
                    roomAssemblySnapshot={roomAssemblySnapshot}
                    isEn={isEn}
                />
            ) : null}
            {showCustomHomeEditor || editingHomeId ? (
                <HomeEditorDialog
                    setShowCustomHomeEditor={setShowCustomHomeEditor}
                    setEditingHomeId={setEditingHomeId}
                    setHomeForm={setHomeForm}
                    editingHomeId={editingHomeId}
                    homeForm={homeForm}
                    saveHome={saveHome}
                />
            ) : null}
        </div>
    );
}
