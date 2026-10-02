import { useCallback, useLayoutEffect, useRef } from 'react';

// Long-lived listeners and animation loops keep one callback identity while
// reading the latest committed props and state. Call it after render only.
export function useEventCallback(callback) {
    const callbackRef = useRef(callback);
    useLayoutEffect(() => {
        callbackRef.current = callback;
    }, [callback]);
    return useCallback((...args) => callbackRef.current(...args), []);
}
