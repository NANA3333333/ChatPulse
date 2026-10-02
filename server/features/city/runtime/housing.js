// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function getRequiredRoomAnchorBranchTargets(inputPackage = {}) {
        const sceneType = String(inputPackage?.scene_context?.type || inputPackage?.world?.scene_type || '').trim();
        if (sceneType !== 'room') return [];
        const rawTargets = Array.isArray(inputPackage?.world?.required_anchor_branches)
            ? inputPackage.world.required_anchor_branches
            : [];
        return rawTargets.map((target, index) => {
            const id = dependencies.limitText(target?.place_id || target?.placeId || target?.id || '', 100);
            if (!id || !id.startsWith('room-anchor:')) return null;
            return {
                order: dependencies.clamp(Number(target?.order) || index + 1, 1, 999),
                id,
                label: dependencies.limitText(target?.label || target?.name || id, 80)
            };
        }).filter(Boolean);
    }

function findMissingRequiredRoomAnchorBranches(baseBranches = [], inputPackage = {}) {
        const requiredTargets = getRequiredRoomAnchorBranchTargets(inputPackage);
        if (!requiredTargets.length) return [];
        const coveredIds = new Set();
        baseBranches.forEach((branch) => {
            if (branch?.target_node_id !== 'place_affordance') return;
            dependencies.collectBehaviorStepPlaceIds(branch.steps).forEach((id) => coveredIds.add(id));
        });
        return requiredTargets.filter((target) => !coveredIds.has(target.id));
    }

function summarizeBehaviorRoomLayout(rawLayout = {}) {
        const layout = rawLayout && typeof rawLayout === 'object' ? rawLayout : {};
        const room = layout.room && typeof layout.room === 'object' ? layout.room : {};
        const unit = layout.unit && typeof layout.unit === 'object' ? layout.unit : {};
        const furniture = Array.isArray(layout.furniture) ? layout.furniture : [];
        return {
            kind: dependencies.limitText(layout.kind || 'pixel_room_ascii_layout_v1', 80),
            usage: '当前输入发生在房间内。该布局只帮助理解家具和空间，不改变输出格式；不要生成 PLACE 家具摆放行。',
            unit: {
                token: dependencies.limitText(unit.token || '[b]', 20),
                source: dependencies.limitText(unit.source || '', 120),
                cellPx: unit.cellPx || unit.cell_px || null
            },
            room: {
                size: room.size || null,
                legend: room.legend || null,
                ascii: dependencies.limitText(room.ascii || '', 6000)
            },
            current_ascii: dependencies.limitText(layout.current_ascii || layout.currentAscii || '', 6000),
            furniture: furniture.slice(0, 60).map((item) => ({
                id: dependencies.limitText(item?.id || '', 120),
                anchor_id: dependencies.limitText(item?.anchor_id || item?.anchorId || '', 120),
                kind: dependencies.limitText(item?.kind || '', 60),
                direction: dependencies.limitText(item?.direction || '', 30),
                token: dependencies.limitText(item?.token || '', 30),
                size: item?.size || null,
                rules: Array.isArray(item?.rules) ? item.rules.slice(0, 8).map((rule) => dependencies.limitText(rule, 60)).filter(Boolean) : [],
                direction_options: Array.isArray(item?.direction_options || item?.directionOptions)
                    ? (item.direction_options || item.directionOptions).slice(0, 8).map((option) => ({
                        direction: dependencies.limitText(option?.direction || '', 30),
                        size: option?.size || null
                    }))
                    : [],
                grid_box: item?.grid_box || item?.gridBox || null
            })).filter((item) => item.id)
        };
    }

    return { getRequiredRoomAnchorBranchTargets, findMissingRequiredRoomAnchorBranches, summarizeBehaviorRoomLayout };
}

module.exports = { createModule };
