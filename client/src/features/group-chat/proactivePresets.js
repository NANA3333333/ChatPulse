export const groupProactivePresets = {
    1: [45, 90],
    2: [30, 60],
    3: [20, 40],
    4: [15, 30],
    5: [10, 20],
    6: [8, 15],
    7: [6, 12],
    8: [4, 8],
    9: [2, 5],
    10: [1, 3],
};

export function getGroupProactivePreset(level) {
    return groupProactivePresets[Math.max(1, Math.min(10, Number(level) || 1))] || groupProactivePresets[1];
}

export function getGroupProactiveLevelFromInterval(enabled, min, max) {
    if (!enabled) return 0;
    const avg = ((Number(min) || 10) + (Number(max) || 60)) / 2;
    let bestLevel = 1;
    let bestDistance = Infinity;
    Object.entries(groupProactivePresets).forEach(([level, range]) => {
        const presetAvg = (range[0] + range[1]) / 2;
        const distance = Math.abs(avg - presetAvg);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestLevel = Number(level);
        }
    });
    return bestLevel;
}
