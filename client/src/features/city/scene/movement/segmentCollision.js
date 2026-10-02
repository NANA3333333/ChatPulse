// Open rectangles: touching an edge is allowed; crossing their interior is not.
export function segmentCrossesBox(start, end, box) {
    let enter = 0;
    let leave = 1;
    for (const [axis, size] of [
        ['x', 'w'],
        ['y', 'h'],
    ]) {
        const delta = end[axis] - start[axis];
        const min = box[axis],
            max = min + box[size];
        if (Math.abs(delta) < 1e-9) {
            if (start[axis] <= min || start[axis] >= max) return false;
            continue;
        }
        const a = (min - start[axis]) / delta,
            b = (max - start[axis]) / delta;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
        if (enter >= leave) return false;
    }
    return enter < leave;
}
