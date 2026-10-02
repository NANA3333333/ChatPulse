import { useEffect, useRef } from 'react';

export function useSceneFitZoom(canvasWrapRef, stageHeight, preferredZoom, setZoom) {
    const automaticZoomRef = useRef(null);

    useEffect(() => {
        const canvas = canvasWrapRef.current;
        if (!canvas || !stageHeight) return undefined;

        const fitScene = () => {
            const fittedZoom = Math.min(
                preferredZoom,
                Math.max(0.28, Math.floor(((canvas.clientHeight - 8) / stageHeight) * 100) / 100),
            );
            if (!Number.isFinite(fittedZoom)) return;
            setZoom((current) => {
                if (automaticZoomRef.current !== null && Math.abs(current - automaticZoomRef.current) > 0.001) {
                    return current;
                }
                automaticZoomRef.current = fittedZoom;
                return fittedZoom;
            });
        };

        fitScene();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(fitScene);
        observer.observe(canvas);
        return () => observer.disconnect();
    }, [canvasWrapRef, stageHeight, preferredZoom, setZoom]);
}
