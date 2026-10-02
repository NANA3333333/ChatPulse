import { shell } from '../housingPresentation.js';
import { getHousingStatusTone, formatMoney, toNum, formatTime } from '../housingFormatting.js';
import { WalletCards, KeyRound, Home, BadgeDollarSign, Clock3, AlertTriangle } from 'lucide-react';
import { text } from '../housingLabels.js';
import { Pill, ActionButton, Field, HomeMetricBars } from './HousingPrimitives.jsx';

export function CharacterHousingCard({
    character,
    binding,
    selectedHousing,
    status,
    sortedHousingTiers,
    savingBindingId,
    updateBinding,
    payRent,
}) {
    const tone = getHousingStatusTone(status, !!selectedHousing);
    return (
        <div className="housing-character-card">
            <div className="housing-character-head">
                <div className="housing-character-main">
                    <div className="housing-character-avatar">{String(character.name || '?').slice(0, 1)}</div>
                    <div>
                        <div className="housing-character-name">{character.name}</div>
                        <div className="housing-character-meta">
                            <span>
                                <WalletCards size={13} />
                                {formatMoney(character.wallet)}
                            </span>
                            <span>{character.location || text.unknown}</span>
                            <span>{character.city_status || text.idle}</span>
                        </div>
                    </div>
                </div>
                <div className="housing-character-actions">
                    <Pill bg={tone.bg} color={tone.color} icon={tone.icon}>
                        {tone.label}
                    </Pill>
                    <ActionButton
                        icon={KeyRound}
                        tone="warning"
                        title={text.payRent}
                        disabled={savingBindingId === character.id}
                        onClick={() => payRent(character.id).catch((err) => alert(err.message))}
                    >
                        {savingBindingId === character.id ? text.saving : text.payRent}
                    </ActionButton>
                </div>
            </div>
            <div className="housing-binding-grid">
                <Field label={text.homeName}>
                    <select
                        style={shell.input}
                        value={binding.housing_id || ''}
                        onChange={(e) =>
                            updateBinding(character.id, { ...binding, housing_id: e.target.value }).catch((err) =>
                                alert(err.message),
                            )
                        }
                    >
                        <option value="">{text.unboundHousing}</option>
                        {sortedHousingTiers.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.emoji || ''} {item.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={text.status}>
                    <select
                        style={shell.input}
                        value={binding.housing_status || 'stable'}
                        onChange={(e) =>
                            updateBinding(character.id, { ...binding, housing_status: e.target.value }).catch((err) =>
                                alert(err.message),
                            )
                        }
                    >
                        <option value="stable">{text.stable}</option>
                        <option value="temporary">{text.temporary}</option>
                        <option value="unstable">{text.unstable}</option>
                        <option value="overdue">{text.overdue}</option>
                    </select>
                </Field>
                <Field label={text.weeklyRent}>
                    <input
                        style={shell.input}
                        type="number"
                        value={binding.rent_weekly ?? 0}
                        onChange={(e) =>
                            updateBinding(character.id, { ...binding, rent_weekly: toNum(e.target.value) }).catch(
                                (err) => alert(err.message),
                            )
                        }
                    />
                </Field>
                <Field label={text.rentDue}>
                    <input
                        style={shell.input}
                        type="number"
                        value={binding.rent_due_day ?? 7}
                        onChange={(e) =>
                            updateBinding(character.id, { ...binding, rent_due_day: toNum(e.target.value, 7) }).catch(
                                (err) => alert(err.message),
                            )
                        }
                    />
                </Field>
                <Field label={text.note} span>
                    <input
                        style={shell.input}
                        value={binding.note || ''}
                        onChange={(e) =>
                            updateBinding(character.id, { ...binding, note: e.target.value }).catch((err) =>
                                alert(err.message),
                            )
                        }
                    />
                </Field>
            </div>
            <div className="housing-character-facts">
                <Pill icon={Home}>
                    {text.currentHome} {selectedHousing?.name || text.unboundHousing}
                </Pill>
                <Pill icon={BadgeDollarSign}>
                    {text.deposit} {formatMoney(selectedHousing?.deposit || 0)}
                </Pill>
                <Pill icon={Clock3}>
                    {text.nextRentDue} {formatTime(binding.rent_due_at)}
                </Pill>
                <Pill icon={AlertTriangle}>
                    {text.missedRent} {binding.missed_rent_count || 0}
                </Pill>
            </div>
            {selectedHousing ? <HomeMetricBars home={selectedHousing} /> : null}
        </div>
    );
}
