import { emptyHome, text } from '../housingLabels.js';
import { createPortal } from 'react-dom';
import { ActionButton, Field } from './HousingPrimitives.jsx';
import { X, Save } from 'lucide-react';
import { shell } from '../housingPresentation.js';
import { toNum } from '../housingFormatting.js';

export function HomeEditorDialog({
    setShowCustomHomeEditor,
    setEditingHomeId,
    setHomeForm,
    editingHomeId,
    homeForm,
    saveHome,
}) {
    return createPortal(
        <div
            className="housing-modal-backdrop"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10020,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}
            onClick={() => {
                setShowCustomHomeEditor(false);
                setEditingHomeId('');
                setHomeForm(emptyHome);
            }}
        >
            <div
                className="housing-modal-card housing-home-editor-modal"
                style={{ width: 'min(860px, 100%)', maxHeight: '85vh', overflowY: 'auto', padding: 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        marginBottom: 14,
                    }}
                >
                    <div>
                        <div className="housing-modal-title" style={{ fontSize: 20, fontWeight: 800 }}>
                            {editingHomeId ? text.modalEditHome : text.modalCustomHome}
                        </div>
                        <div className="housing-modal-subtitle" style={{ fontSize: 13, marginTop: 4 }}>
                            {text.customHomeHint}
                        </div>
                    </div>
                    <ActionButton
                        icon={X}
                        tone="neutral"
                        onClick={() => {
                            setShowCustomHomeEditor(false);
                            setEditingHomeId('');
                            setHomeForm(emptyHome);
                        }}
                    >
                        {text.cancel}
                    </ActionButton>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                    <Field label={text.id}>
                        <input
                            style={shell.input}
                            value={homeForm.id}
                            onChange={(e) => setHomeForm((p) => ({ ...p, id: e.target.value }))}
                        />
                    </Field>
                    <Field label={text.homeName}>
                        <input
                            style={shell.input}
                            value={homeForm.name}
                            onChange={(e) => setHomeForm((p) => ({ ...p, name: e.target.value }))}
                        />
                    </Field>
                    <Field label={text.emoji}>
                        <input
                            style={shell.input}
                            value={homeForm.emoji}
                            onChange={(e) => setHomeForm((p) => ({ ...p, emoji: e.target.value }))}
                        />
                    </Field>
                    <Field label={text.weeklyRent}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.weekly_rent}
                            onChange={(e) => setHomeForm((p) => ({ ...p, weekly_rent: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.deposit}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.deposit}
                            onChange={(e) => setHomeForm((p) => ({ ...p, deposit: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.buyout}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.sale_price}
                            onChange={(e) => setHomeForm((p) => ({ ...p, sale_price: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.comfort}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.comfort}
                            onChange={(e) => setHomeForm((p) => ({ ...p, comfort: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.prestige}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.prestige}
                            onChange={(e) => setHomeForm((p) => ({ ...p, prestige: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.privacy}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.privacy}
                            onChange={(e) => setHomeForm((p) => ({ ...p, privacy: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.sortOrder}>
                        <input
                            style={shell.input}
                            type="number"
                            value={homeForm.sort_order}
                            onChange={(e) => setHomeForm((p) => ({ ...p, sort_order: toNum(e.target.value) }))}
                        />
                    </Field>
                    <Field label={text.desc} span>
                        <textarea
                            style={{ ...shell.input, minHeight: 110, resize: 'vertical' }}
                            value={homeForm.description}
                            onChange={(e) => setHomeForm((p) => ({ ...p, description: e.target.value }))}
                        />
                    </Field>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <ActionButton icon={Save} tone="primary" onClick={() => saveHome().catch((e) => alert(e.message))}>
                        {editingHomeId ? text.saveEdit : text.addHome}
                    </ActionButton>
                    <ActionButton
                        icon={X}
                        tone="neutral"
                        onClick={() => {
                            setShowCustomHomeEditor(false);
                            setEditingHomeId('');
                            setHomeForm(emptyHome);
                        }}
                    >
                        {text.cancel}
                    </ActionButton>
                </div>
            </div>
        </div>,
        document.body,
    );
}
