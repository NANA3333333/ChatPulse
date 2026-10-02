import { useRef, useState } from 'react';

export function useWindowState() {
const [browserWindowMaximized, setBrowserWindowMaximized] = useState(false);

const [browserWindows, setBrowserWindows] = useState([]);

const [activeBrowserWindowId, setActiveBrowserWindowId] = useState(null);

const [browserWindowInteractionMode, setBrowserWindowInteractionMode] = useState(null);

const [browserWindowMergeTargetId, setBrowserWindowMergeTargetId] = useState(null);

const [browserTabDragPreview, setBrowserTabDragPreview] = useState(null);

const [browserWindowRecallPulse, setBrowserWindowRecallPulse] = useState(null);

const [browserWindowGeometrySwitchingWindowId, setBrowserWindowGeometrySwitchingWindowId] = useState(null);

const browserWindowSeqRef = useRef(1);

const browserWindowInteractionRef = useRef(null);

const browserWindowsRef = useRef(browserWindows);

const browserWindowGeometrySyncTimersRef = useRef(new Map());

const browserWindowPointerListenerCleanupRef = useRef(null);

const browserWindowGeometrySwitchTimerRef = useRef(null);

const suppressBrowserWindowClickRef = useRef(null);
    return { browserWindowMaximized, setBrowserWindowMaximized, browserWindows, setBrowserWindows, activeBrowserWindowId, setActiveBrowserWindowId, browserWindowInteractionMode, setBrowserWindowInteractionMode, browserWindowMergeTargetId, setBrowserWindowMergeTargetId, browserTabDragPreview, setBrowserTabDragPreview, browserWindowRecallPulse, setBrowserWindowRecallPulse, browserWindowGeometrySwitchingWindowId, setBrowserWindowGeometrySwitchingWindowId, browserWindowSeqRef, browserWindowInteractionRef, browserWindowsRef, browserWindowGeometrySyncTimersRef, browserWindowPointerListenerCleanupRef, browserWindowGeometrySwitchTimerRef, suppressBrowserWindowClickRef };
}
