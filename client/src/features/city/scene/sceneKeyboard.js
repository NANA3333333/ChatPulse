// A mounted background scene must never consume another window's input.
export function subscribeSceneKeyboard({ canvas, enabled, keys, onKeyDown, onKeyUp }) {
    const clear = () => keys.clear();
    clear();
    if (!enabled || !canvas) return clear;
    const ownsFocus = () => canvas.contains(document.activeElement);
    const keydown = (event) => {
        if (!ownsFocus() || document.hidden) return;
        onKeyDown(event);
    };
    const keyup = (event) => {
        if (ownsFocus()) onKeyUp(event);
        else clear();
    };
    const focusChanged = () => {
        if (!ownsFocus()) clear();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear);
    document.addEventListener('focusin', focusChanged);
    document.addEventListener('visibilitychange', clear);
    return () => {
        clear();
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
        window.removeEventListener('blur', clear);
        document.removeEventListener('focusin', focusChanged);
        document.removeEventListener('visibilitychange', clear);
    };
}
