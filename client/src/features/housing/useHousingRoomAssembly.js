import { useState, useMemo, useEffect } from 'react';
import { emptyHome, homePresets } from './housingLabels.js';
import {
    readAgencyRoomAssemblySnapshot,
    getRoomAssemblyCurrentSizeProfile,
    isRoomAssemblySnapshotPreviewCurrent,
    getRoomAssemblySizeProfileKindCount,
} from './assembly/roomAssemblyStorage.js';
import { addRoomAssemblySnapshotPreview } from './assembly/roomAssemblyPreview.js';
import {
    pickRoomAssemblyPalette,
    getRoomAssemblyBudget,
    saveAgencyRoomAssemblyWithPreview,
} from './assembly/roomAssembly.js';
import {
    roomAssemblyGridSize,
    roomEditorStageSize,
    roomAssemblyBedTopBaselineY,
    roomAssemblyBedTopBaselineMinGridY,
} from './assembly/roomAssemblyCatalog.js';
import { getRoomAssemblyFurnitureContext } from './assembly/roomAssemblyGeometry.js';
import { formatMoney } from './housingFormatting.js';

export function useHousingRoomAssembly({ housingTiers, isEn, requestJson, headers }) {
    const [showRoomAssemblyModal, setShowRoomAssemblyModal] = useState(false);

    const [roomAssemblyHomeId, setRoomAssemblyHomeId] = useState('');

    const [roomAssemblyNotice, setRoomAssemblyNotice] = useState('');

    const [roomAssemblySaving, setRoomAssemblySaving] = useState(false);

    const [roomAssemblySnapshot, setRoomAssemblySnapshot] = useState(() => readAgencyRoomAssemblySnapshot());

    const roomAssemblyHomes = useMemo(() => {
        if (housingTiers.length > 0) return housingTiers;
        return homePresets.map((preset) => ({ ...emptyHome, ...preset.values }));
    }, [housingTiers]);

    const selectedRoomAssemblyHome = useMemo(() => {
        if (!roomAssemblyHomes.length) return null;
        return roomAssemblyHomes.find((item) => String(item.id) === String(roomAssemblyHomeId)) || roomAssemblyHomes[0];
    }, [roomAssemblyHomeId, roomAssemblyHomes]);

    const currentRoomAssemblySizeProfile = getRoomAssemblyCurrentSizeProfile();

    useEffect(() => {
        if (!roomAssemblyHomeId && roomAssemblyHomes[0]?.id) {
            setRoomAssemblyHomeId(String(roomAssemblyHomes[0].id));
        }
    }, [roomAssemblyHomeId, roomAssemblyHomes]);

    useEffect(() => {
        if (roomAssemblySnapshot) return;
        const recovered = readAgencyRoomAssemblySnapshot();
        if (recovered) setRoomAssemblySnapshot(recovered);
    }, [roomAssemblySnapshot]);

    useEffect(() => {
        if (!roomAssemblySnapshot || isRoomAssemblySnapshotPreviewCurrent(roomAssemblySnapshot)) return undefined;
        let cancelled = false;
        addRoomAssemblySnapshotPreview(roomAssemblySnapshot).then((nextSnapshot) => {
            if (!cancelled && nextSnapshot?.previewImage?.dataUrl) {
                setRoomAssemblySnapshot(nextSnapshot);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [roomAssemblySnapshot]);

    const runRoomAssembly = async () => {
        if (!selectedRoomAssemblyHome) {
            setRoomAssemblyNotice(
                isEn
                    ? 'No available listing. Add or save a sellable home first.'
                    : '没有可用房源，先新增或加入一套可推销房子。',
            );
            return;
        }
        const palette = pickRoomAssemblyPalette(selectedRoomAssemblyHome);
        const budget = getRoomAssemblyBudget(selectedRoomAssemblyHome);
        const sizeProfile = getRoomAssemblyCurrentSizeProfile();
        const calibratedKindCount = getRoomAssemblySizeProfileKindCount(sizeProfile);
        setRoomAssemblySaving(true);
        setRoomAssemblyNotice(
            isEn
                ? `Agency AI is generating purchases and placement from the room grid, furniture prices, listing budget, and fixed room proportions...${calibratedKindCount ? ` Loaded ${calibratedKindCount} size guides.` : ''}`
                : `中介 AI 正在根据房间网格、家具价格、房源预算和固定房间比例生成采购摆放...${calibratedKindCount ? ` 已读取 ${calibratedKindCount} 类比例标尺。` : ''}`,
        );
        try {
            const data = await requestJson('/api/social-housing/agency/room-assembly', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    home: selectedRoomAssemblyHome,
                    palette,
                    budget,
                    room: {
                        size: roomAssemblyGridSize,
                        stage_px: roomEditorStageSize,
                        constraints: {
                            bed_top_baseline_y_px: roomAssemblyBedTopBaselineY,
                            bed_min_grid_y: roomAssemblyBedTopBaselineMinGridY,
                        },
                    },
                    furniture: getRoomAssemblyFurnitureContext(sizeProfile),
                }),
            });
            const snapshot = await saveAgencyRoomAssemblyWithPreview(
                selectedRoomAssemblyHome,
                data.assembly || null,
                sizeProfile,
            );
            setRoomAssemblySnapshot(snapshot);
            const snapshotSizeKindCount = getRoomAssemblySizeProfileKindCount(snapshot.sizeProfile);
            const screenshotNote = snapshot.previewImage?.dataUrl
                ? isEn
                    ? ' Preview captured.'
                    : ' 已自动截图。'
                : '';
            setRoomAssemblyNotice(
                isEn
                    ? `AI generated and saved to the actual room. ${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || 'showroom'} / budget ${formatMoney(snapshot.budget)} / spent ${formatMoney(snapshot.spent)} / ${snapshot.items.length} assets / ${snapshotSizeKindCount} size guides.${screenshotNote}${snapshot.ai?.notes ? ` Notes: ${snapshot.ai.notes}` : ''}`
                    : `AI 已生成并保存到实际房间。${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || '样板间'} / 预算 ${formatMoney(snapshot.budget)} / 花费 ${formatMoney(snapshot.spent)} / ${snapshot.items.length} 个素材 / ${snapshotSizeKindCount} 类比例标尺。${screenshotNote}${snapshot.ai?.notes ? ` 备注：${snapshot.ai.notes}` : ''}`,
            );
        } catch (e) {
            const snapshot = await saveAgencyRoomAssemblyWithPreview(selectedRoomAssemblyHome, null, sizeProfile);
            setRoomAssemblySnapshot(snapshot);
            const snapshotSizeKindCount = getRoomAssemblySizeProfileKindCount(snapshot.sizeProfile);
            const screenshotNote = snapshot.previewImage?.dataUrl
                ? isEn
                    ? ' Preview captured.'
                    : ' 已自动截图。'
                : '';
            setRoomAssemblyNotice(
                isEn
                    ? `AI generation failed, so a rule-based template was saved first: ${e.message || 'Unknown error'}. ${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || 'showroom'} / budget ${formatMoney(snapshot.budget)} / spent ${formatMoney(snapshot.spent)} / ${snapshot.items.length} assets / ${snapshotSizeKindCount} size guides.${screenshotNote}`
                    : `AI 生成失败，已先用规则模板保存：${e.message || '未知错误'}。${snapshot.home.emoji || ''}${snapshot.home.name || snapshot.home.id || '样板间'} / 预算 ${formatMoney(snapshot.budget)} / 花费 ${formatMoney(snapshot.spent)} / ${snapshot.items.length} 个素材 / ${snapshotSizeKindCount} 类比例标尺。${screenshotNote}`,
            );
        } finally {
            setRoomAssemblySaving(false);
        }
    };

    return {
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
    };
}
