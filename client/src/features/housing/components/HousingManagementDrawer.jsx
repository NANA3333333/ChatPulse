import { X, ChevronRight, Plus, WandSparkles, Edit3, Trash2, Sparkles, Save, CheckCircle2 } from 'lucide-react';
import { ActionButton, Field, Pill } from './HousingPrimitives.jsx';
import { emptyHome, text, homePresets, emptySocialClass } from '../housingLabels.js';
import { HomeSummaryCard } from './HomeSummaryCard.jsx';
import { CharacterHousingCard } from './CharacterHousingCard.jsx';
import { shell } from '../housingPresentation.js';
import { toNum, getChainEventsForDisplay } from '../housingFormatting.js';
import { RentalChainCard } from './RentalChainCard.jsx';

export function HousingManagementDrawer({
    isEn,
    setManagementOpen,
    managementTabs,
    managementTab,
    setManagementTab,
    setEditingHomeId,
    setHomeForm,
    setShowCustomHomeEditor,
    setShowRoomAssemblyModal,
    homeNotice,
    sortedHousingTiers,
    beginEditHome,
    deleteHome,
    applyHomePreset,
    homePresetLabel,
    housedCharacters,
    housingById,
    savingBindingId,
    updateBinding,
    payRent,
    classForm,
    setClassForm,
    saveSocialClass,
    editingClassId,
    setEditingClassId,
    sortedSocialClasses,
    beginEditSocialClass,
    deleteSocialClass,
    agencyForm,
    setAgencyForm,
    saveAgencyField,
    resolvedDistrictOptions,
    districtDisplayName,
    resolvedAgencyModelOptions,
    updateAgencyField,
    saveAgency,
    savingAgency,
    visibleAgencyAds,
    deleteAgencyAd,
    rentalChains,
    rentalChainEvents,
}) {
    return (
        <aside className="housing-management-drawer">
            <div className="housing-drawer-head">
                <div>
                    <span className="housing-play-kicker">MANAGEMENT</span>
                    <h3>{isEn ? 'Housing Management' : '住房管理'}</h3>
                </div>
                <button
                    type="button"
                    className="btn btn-ghost housing-icon-only"
                    onClick={() => setManagementOpen(false)}
                >
                    <X size={16} />
                </button>
            </div>
            <div className="housing-management-layout">
                <div className="housing-management-list">
                    {managementTabs.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                type="button"
                                key={item.key}
                                className={managementTab === item.key ? 'is-active' : ''}
                                onClick={() => setManagementTab(item.key)}
                            >
                                <span>
                                    <Icon size={16} />
                                </span>
                                <div>
                                    <strong>{item.label}</strong>
                                    <small>{item.desc}</small>
                                </div>
                                <ChevronRight size={15} />
                            </button>
                        );
                    })}
                </div>
                <div className="housing-management-detail">
                    {managementTab === 'homes' ? (
                        <>
                            <div className="housing-management-actions">
                                <ActionButton
                                    icon={Plus}
                                    tone="primary"
                                    onClick={() => {
                                        setEditingHomeId('');
                                        setHomeForm(emptyHome);
                                        setShowCustomHomeEditor(true);
                                    }}
                                >
                                    {text.custom}
                                </ActionButton>
                                <ActionButton
                                    icon={WandSparkles}
                                    tone="neutral"
                                    onClick={() => setShowRoomAssemblyModal(true)}
                                >
                                    {text.openRoomAssembly}
                                </ActionButton>
                            </div>
                            {homeNotice ? <div className="housing-inline-notice">{homeNotice}</div> : null}
                            <div className="housing-management-card-list">
                                {sortedHousingTiers.map((home) => (
                                    <HomeSummaryCard
                                        key={home.id}
                                        home={home}
                                        title={
                                            Number(home.is_enabled ?? 1) === 1 ? text.enabledState : text.disabledState
                                        }
                                        actions={
                                            <>
                                                <ActionButton
                                                    icon={Edit3}
                                                    tone="neutral"
                                                    onClick={() => beginEditHome(home)}
                                                >
                                                    {text.edit}
                                                </ActionButton>
                                                <ActionButton
                                                    icon={Trash2}
                                                    tone="danger"
                                                    onClick={() => deleteHome(home.id).catch((e) => alert(e.message))}
                                                >
                                                    {text.remove}
                                                </ActionButton>
                                            </>
                                        }
                                    />
                                ))}
                                {sortedHousingTiers.length === 0 ? (
                                    <div className="housing-empty-card">{text.emptyHomes}</div>
                                ) : null}
                            </div>
                            <div className="housing-template-strip">
                                {homePresets.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => applyHomePreset(preset).catch((e) => alert(e.message))}
                                    >
                                        <Sparkles size={14} />
                                        <span>{homePresetLabel(preset, 'subtitle')}</span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : null}
                    {managementTab === 'residents' ? (
                        <div className="housing-character-list">
                            {housedCharacters.map((character) => {
                                const binding = character.binding || {};
                                const selectedHousing =
                                    housingById.get(String(binding.housing_id || '')) || binding.housing;
                                const status = String(
                                    binding.housing_status || (selectedHousing ? 'stable' : 'homeless'),
                                );
                                return (
                                    <CharacterHousingCard
                                        key={character.id}
                                        character={character}
                                        binding={binding}
                                        selectedHousing={selectedHousing}
                                        status={status}
                                        sortedHousingTiers={sortedHousingTiers}
                                        savingBindingId={savingBindingId}
                                        updateBinding={updateBinding}
                                        payRent={payRent}
                                    />
                                );
                            })}
                            {housedCharacters.length === 0 ? (
                                <div className="housing-empty-card">{text.noHousedCharacters}</div>
                            ) : null}
                        </div>
                    ) : null}
                    {managementTab === 'classes' ? (
                        <div className="housing-class-workbench">
                            <div className="housing-class-form" style={shell.card}>
                                <div className="housing-card-kicker">{text.classProfilesHint}</div>
                                <div className="housing-class-form-grid">
                                    <Field label={text.id}>
                                        <input
                                            style={shell.input}
                                            value={classForm.id}
                                            onChange={(e) => setClassForm((p) => ({ ...p, id: e.target.value }))}
                                            placeholder="optional-id"
                                        />
                                    </Field>
                                    <Field label={text.className}>
                                        <input
                                            style={shell.input}
                                            value={classForm.name}
                                            onChange={(e) => setClassForm((p) => ({ ...p, name: e.target.value }))}
                                        />
                                    </Field>
                                    <Field label={text.classEmoji}>
                                        <input
                                            style={shell.input}
                                            value={classForm.emoji}
                                            onChange={(e) => setClassForm((p) => ({ ...p, emoji: e.target.value }))}
                                        />
                                    </Field>
                                    <Field label={text.sortOrder}>
                                        <input
                                            style={shell.input}
                                            type="number"
                                            value={classForm.sort_order}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, sort_order: toNum(e.target.value) }))
                                            }
                                        />
                                    </Field>
                                    <Field label={text.workBias}>
                                        <input
                                            style={shell.input}
                                            type="number"
                                            min="-100"
                                            max="100"
                                            value={classForm.work_bias}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, work_bias: toNum(e.target.value) }))
                                            }
                                        />
                                    </Field>
                                    <Field label={text.consumptionBias}>
                                        <input
                                            style={shell.input}
                                            type="number"
                                            min="-100"
                                            max="100"
                                            value={classForm.consumption_bias}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, consumption_bias: toNum(e.target.value) }))
                                            }
                                        />
                                    </Field>
                                    <Field label={text.prestigeBias}>
                                        <input
                                            style={shell.input}
                                            type="number"
                                            min="-100"
                                            max="100"
                                            value={classForm.prestige_bias}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, prestige_bias: toNum(e.target.value) }))
                                            }
                                        />
                                    </Field>
                                    <Field label={text.socialBarrier}>
                                        <input
                                            style={shell.input}
                                            type="number"
                                            min="-100"
                                            max="100"
                                            value={classForm.social_barrier}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, social_barrier: toNum(e.target.value) }))
                                            }
                                        />
                                    </Field>
                                    <Field label={text.commonLocations} span>
                                        <input
                                            style={shell.input}
                                            value={classForm.common_locations}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, common_locations: e.target.value }))
                                            }
                                            placeholder={text.agencyPlaceholder}
                                        />
                                    </Field>
                                    <Field label={text.classDescription} span>
                                        <textarea
                                            style={{ ...shell.input, minHeight: 86, resize: 'vertical' }}
                                            value={classForm.description}
                                            onChange={(e) =>
                                                setClassForm((p) => ({ ...p, description: e.target.value }))
                                            }
                                        />
                                    </Field>
                                </div>
                                <div className="housing-card-actions">
                                    <ActionButton
                                        icon={Save}
                                        tone="primary"
                                        onClick={() => saveSocialClass().catch((e) => alert(e.message))}
                                    >
                                        {editingClassId ? text.saveEdit : text.addClass}
                                    </ActionButton>
                                    <ActionButton
                                        icon={X}
                                        tone="neutral"
                                        onClick={() => {
                                            setClassForm(emptySocialClass);
                                            setEditingClassId('');
                                        }}
                                    >
                                        {text.cancel}
                                    </ActionButton>
                                </div>
                            </div>
                            <div className="housing-class-list">
                                {sortedSocialClasses.map((item) => (
                                    <article
                                        className={`housing-class-card ${Number(item.is_enabled ?? 1) !== 1 ? 'is-disabled' : ''}`}
                                        key={item.id}
                                    >
                                        <div>
                                            <strong>
                                                {item.emoji || ''} {item.name || item.id}
                                            </strong>
                                            <span>{item.description || '-'}</span>
                                        </div>
                                        <div className="housing-class-bias-row">
                                            <Pill>
                                                {text.workBias} {item.work_bias || 0}
                                            </Pill>
                                            <Pill>
                                                {text.consumptionBias} {item.consumption_bias || 0}
                                            </Pill>
                                            <Pill>
                                                {text.prestigeBias} {item.prestige_bias || 0}
                                            </Pill>
                                            <Pill>
                                                {text.socialBarrier} {item.social_barrier || 0}
                                            </Pill>
                                        </div>
                                        {Array.isArray(item.common_locations) && item.common_locations.length > 0 ? (
                                            <div className="housing-class-locations">
                                                {item.common_locations.join(' / ')}
                                            </div>
                                        ) : null}
                                        <div className="housing-card-actions">
                                            <ActionButton
                                                icon={Edit3}
                                                tone="neutral"
                                                onClick={() => beginEditSocialClass(item)}
                                            >
                                                {text.edit}
                                            </ActionButton>
                                            <ActionButton
                                                icon={Trash2}
                                                tone="danger"
                                                onClick={() =>
                                                    deleteSocialClass(item.id).catch((e) => alert(e.message))
                                                }
                                            >
                                                {text.remove}
                                            </ActionButton>
                                        </div>
                                    </article>
                                ))}
                                {sortedSocialClasses.length === 0 ? (
                                    <div className="housing-empty-card">{text.emptyClasses}</div>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    {managementTab === 'agency' ? (
                        <div className="housing-agency-form-grid">
                            <Field label={text.officeName}>
                                <input
                                    style={shell.input}
                                    value={agencyForm.agency_name || ''}
                                    onChange={(e) => setAgencyForm((p) => ({ ...p, agency_name: e.target.value }))}
                                />
                            </Field>
                            <Field label={text.agentName}>
                                <input
                                    style={shell.input}
                                    value={agencyForm.agent_name || ''}
                                    onChange={(e) => setAgencyForm((p) => ({ ...p, agent_name: e.target.value }))}
                                />
                            </Field>
                            <Field label={text.officeDistrict}>
                                <select
                                    style={shell.input}
                                    value={agencyForm.office_district || 'street'}
                                    onChange={(e) =>
                                        saveAgencyField('office_district', e.target.value).catch((err) =>
                                            alert(err.message),
                                        )
                                    }
                                >
                                    {resolvedDistrictOptions.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {districtDisplayName(item)}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={`${text.autoModel} (${resolvedAgencyModelOptions.length})`}>
                                <select
                                    style={shell.input}
                                    value={agencyForm.model_char_id || 'auto'}
                                    onChange={(e) =>
                                        saveAgencyField('model_char_id', e.target.value).catch((err) =>
                                            alert(err.message),
                                        )
                                    }
                                >
                                    {[
                                        { id: 'auto', name: text.autoModel, model_name: '' },
                                        ...resolvedAgencyModelOptions,
                                    ].map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                            {item.model_name ? ` - ${item.model_name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={text.businessScope}>
                                <input
                                    style={shell.input}
                                    value={agencyForm.business_scope || ''}
                                    onChange={(e) => updateAgencyField('business_scope', e.target.value)}
                                />
                            </Field>
                            <Field label={text.intervalHours}>
                                <input
                                    style={shell.input}
                                    type="number"
                                    min="1"
                                    value={agencyForm.decision_interval_hours || 6}
                                    onChange={(e) =>
                                        setAgencyForm((p) => ({
                                            ...p,
                                            decision_interval_hours: toNum(e.target.value, 6),
                                        }))
                                    }
                                />
                            </Field>
                            <Field label={text.prompt} span>
                                <textarea
                                    style={{ ...shell.input, minHeight: 96, resize: 'vertical' }}
                                    value={agencyForm.persona_prompt || ''}
                                    onChange={(e) => updateAgencyField('persona_prompt', e.target.value)}
                                />
                            </Field>
                            <div className="housing-management-actions">
                                <ActionButton
                                    icon={Number(agencyForm.enabled || 0) === 1 ? X : CheckCircle2}
                                    tone={Number(agencyForm.enabled || 0) === 1 ? 'danger' : 'success'}
                                    onClick={() =>
                                        saveAgency({
                                            ...agencyForm,
                                            enabled: Number(agencyForm.enabled || 0) === 1 ? 0 : 1,
                                        }).catch((e) => alert(e.message))
                                    }
                                >
                                    {Number(agencyForm.enabled || 0) === 1 ? text.disable : text.enable}
                                </ActionButton>
                                <ActionButton
                                    icon={Save}
                                    tone="success"
                                    onClick={() => saveAgency().catch((e) => alert(e.message))}
                                >
                                    {savingAgency ? text.saving : text.save}
                                </ActionButton>
                            </div>
                        </div>
                    ) : null}
                    {managementTab === 'history' ? (
                        <div className="housing-management-card-list">
                            {visibleAgencyAds.map((ad) => (
                                <article key={`ad-${ad.id}`} className="housing-history-detail">
                                    <strong>{ad.title || text.noAds}</strong>
                                    <small>
                                        {ad.trigger_type === 'auto' ? text.auto : text.manual} ·{' '}
                                        {Number(ad.is_published ? 1 : 0) === 1 ? text.published : text.untriggered}
                                    </small>
                                    <p>{ad.content}</p>
                                    <ActionButton
                                        icon={Trash2}
                                        tone="danger"
                                        onClick={() => deleteAgencyAd(ad.id).catch((e) => alert(e.message))}
                                    >
                                        {text.removeAd}
                                    </ActionButton>
                                </article>
                            ))}
                            {rentalChains.map((chain) => (
                                <RentalChainCard
                                    key={`chain-${chain.id}`}
                                    chain={chain}
                                    events={getChainEventsForDisplay(rentalChainEvents, chain.id)}
                                />
                            ))}
                            {visibleAgencyAds.length === 0 && rentalChains.length === 0 ? (
                                <div className="housing-empty-card">{text.untriggered}</div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </aside>
    );
}
