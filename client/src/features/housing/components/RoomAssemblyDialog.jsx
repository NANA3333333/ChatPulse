import { text } from '../housingLabels.js';
import { createPortal } from 'react-dom';
import { ActionButton, Field, Pill } from './HousingPrimitives.jsx';
import { X, WandSparkles } from 'lucide-react';
import { shell } from '../housingPresentation.js';
import { formatMoney } from '../housingFormatting.js';
import { getRoomAssemblyBudget } from '../assembly/roomAssembly.js';
import { roomAssemblyShopItems } from '../assembly/roomAssemblyCatalog.js';
import { getRoomAssemblySizeProfileKindCount } from '../assembly/roomAssemblyStorage.js';

export function RoomAssemblyDialog({
    setShowRoomAssemblyModal,
    selectedRoomAssemblyHome,
    setRoomAssemblyHomeId,
    roomAssemblyHomes,
    currentRoomAssemblySizeProfile,
    roomAssemblySaving,
    runRoomAssembly,
    roomAssemblyNotice,
    roomAssemblySnapshot,
    isEn,
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
            onClick={() => setShowRoomAssemblyModal(false)}
        >
            <div
                className="housing-modal-card housing-room-assembly-modal"
                style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto', padding: 20 }}
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
                            {text.roomAssembly}
                        </div>
                        <div className="housing-modal-subtitle" style={{ fontSize: 13, marginTop: 4 }}>
                            {text.roomAssemblyHint}
                        </div>
                    </div>
                    <ActionButton icon={X} tone="neutral" onClick={() => setShowRoomAssemblyModal(false)}>
                        {text.cancel}
                    </ActionButton>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                    <Field label={text.homeName}>
                        <select
                            style={shell.input}
                            value={selectedRoomAssemblyHome?.id || ''}
                            onChange={(e) => setRoomAssemblyHomeId(e.target.value)}
                        >
                            {roomAssemblyHomes.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.emoji || ''} {item.name || item.id} / {formatMoney(item.weekly_rent)}/
                                    {text.perWeek}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {selectedRoomAssemblyHome ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Pill>
                                {text.comfort} {selectedRoomAssemblyHome.comfort || 0}
                            </Pill>
                            <Pill>
                                {text.prestige} {selectedRoomAssemblyHome.prestige || 0}
                            </Pill>
                            <Pill>
                                {text.privacy} {selectedRoomAssemblyHome.privacy || 0}
                            </Pill>
                            <Pill bg="#fff0f6" color="#ff4f82">
                                {text.budget} {formatMoney(getRoomAssemblyBudget(selectedRoomAssemblyHome))}
                            </Pill>
                            <Pill bg="#f5f3ff" color="#6d28d9">
                                {text.furnitureShop} {roomAssemblyShopItems.length} {text.itemCount}
                            </Pill>
                            <Pill bg="#ecfdf5" color="#047857">
                                {text.scaleProfile}{' '}
                                {getRoomAssemblySizeProfileKindCount(currentRoomAssemblySizeProfile)} {text.classCount}
                            </Pill>
                        </div>
                    ) : null}
                    <div className="housing-modal-copy" style={{ fontSize: 13, lineHeight: 1.65 }}>
                        {text.roomAssemblyCopy}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <ActionButton
                            icon={WandSparkles}
                            tone="primary"
                            disabled={roomAssemblySaving}
                            onClick={runRoomAssembly}
                        >
                            {roomAssemblySaving ? text.aiGenerating : text.generateRoomAssembly}
                        </ActionButton>
                        <ActionButton icon={X} tone="neutral" onClick={() => setShowRoomAssemblyModal(false)}>
                            {text.cancel}
                        </ActionButton>
                    </div>
                    {roomAssemblyNotice ? (
                        <div
                            className="housing-inline-notice"
                            style={{ borderRadius: 8, padding: 12, fontSize: 14, lineHeight: 1.55 }}
                        >
                            {roomAssemblyNotice}
                        </div>
                    ) : null}
                    {roomAssemblySnapshot ? (
                        <div
                            style={{
                                border: '1px solid #e7edf5',
                                borderRadius: 16,
                                padding: 14,
                                background: '#f8fafc',
                            }}
                        >
                            <div style={{ fontWeight: 800, color: '#334155', marginBottom: 8 }}>{text.savedAssets}</div>
                            {roomAssemblySnapshot.previewImage?.dataUrl ? (
                                <img
                                    className="housing-room-modal-preview"
                                    src={roomAssemblySnapshot.previewImage.dataUrl}
                                    alt={isEn ? 'Saved showroom screenshot' : '已保存的样板房截图'}
                                    draggable="false"
                                />
                            ) : null}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                <Pill bg="#fff0f6" color="#ff4f82">
                                    {text.budget} {formatMoney(roomAssemblySnapshot.budget)}
                                </Pill>
                                <Pill bg="#ecfdf5" color="#047857">
                                    {text.spent} {formatMoney(roomAssemblySnapshot.spent)}
                                </Pill>
                                <Pill>
                                    {text.purchased} {roomAssemblySnapshot.purchases?.length || 0} {text.itemCount}
                                </Pill>
                                <Pill>
                                    {text.scaleProfile}{' '}
                                    {getRoomAssemblySizeProfileKindCount(roomAssemblySnapshot.sizeProfile)}{' '}
                                    {text.classCount}
                                </Pill>
                            </div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                {roomAssemblySnapshot.items.map((item) => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: 10,
                                            color: '#64748b',
                                            fontSize: 12,
                                        }}
                                    >
                                        <span>{item.assetId}</span>
                                        <span>
                                            {Math.round(item.x)},{Math.round(item.y)} / {Math.round(item.w)}x
                                            {Math.round(item.h)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}
