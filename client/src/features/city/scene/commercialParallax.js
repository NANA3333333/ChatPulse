export const commercialParallaxFactors = { far: 0.4, middle: 0.75 };

export function advanceCommercialParallaxCamera(previous, scrollLeft, panelWidth, normalizedLoopScroll = false) {
    const physical = Number(scrollLeft) || 0;
    const width = Number(panelWidth) || 0;
    const localScroll = physical - width;
    if (!previous || previous.panelWidth !== width || width <= 0) {
        return {
            panelWidth: width,
            lastPhysical: physical,
            localScroll,
            originLocal: localScroll,
            worldDelta: 0,
        };
    }
    let delta = physical - previous.lastPhysical;
    // The three-panel preview recenters by exactly one panel at the loop seam.
    if (normalizedLoopScroll && delta > width / 2) delta -= width;
    else if (normalizedLoopScroll && delta < -width / 2) delta += width;
    return {
        ...previous,
        lastPhysical: physical,
        localScroll,
        worldDelta: previous.worldDelta + delta,
    };
}

export function getCommercialParallaxShift(camera, scrollFactor) {
    const width = camera?.panelWidth || 0;
    if (!width) return 0;
    const shift = (camera.localScroll - camera.originLocal) - scrollFactor * camera.worldDelta;
    // The visual planes repeat every panel width, so equivalent copies take over here.
    return ((shift + width / 2) % width + width) % width - width / 2;
}
