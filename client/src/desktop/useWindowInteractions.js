import { useCallback, useEffect, useMemo } from 'react';

export function useWindowInteractions(dependencies) {
const { DESKTOP_TAB_DETACH_OFFSET, DESKTOP_TAB_DRAG_THRESHOLD, DESKTOP_TASKBAR_HEIGHT, activeBrowserWindow, activeBrowserWindowId, activeContactId, activeContactRef, activeGroupId, activeGroupRef, activeTab, applyBrowserWindowSocialState, browserWindowGeometrySwitchTimerRef, browserWindowGeometrySyncTimersRef, browserWindowInteractionMode, browserWindowInteractionRef, browserWindowMaximized, browserWindowMergeTargetId, browserWindowPointerListenerCleanupRef, browserWindowSeqRef, browserWindows, browserWindowsRef, clampBrowserWindowGeometry, clearRetiredThemeOverrides, contacts, getBrowserSnapshotFields, getBrowserTabLabel, getBrowserTabMark, getResponsiveBrowserChromeHeight, groupUnreadCounts, groups, lang, openDesktop, resizeBrowserWindowGeometry, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserTabDragPreview, setBrowserWindowGeometrySwitchingWindowId, setBrowserWindowInteractionMode, setBrowserWindowMaximized, setBrowserWindowMergeTargetId, setBrowserWindows, snapshotActiveBrowserWindow, suppressBrowserWindowClickRef } = dependencies;
const beginBrowserWindowGeometrySwitch = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) return;
    setBrowserWindowGeometrySwitchingWindowId(windowId);
    if (typeof window === 'undefined') return;
    if (browserWindowGeometrySwitchTimerRef.current) {
      window.clearTimeout(browserWindowGeometrySwitchTimerRef.current);
    }
    browserWindowGeometrySwitchTimerRef.current = window.setTimeout(() => {
      setBrowserWindowGeometrySwitchingWindowId((current) => (
        current === windowId ? null : current
      ));
      browserWindowGeometrySwitchTimerRef.current = null;
    }, 180);
  }, [activeBrowserWindowId, browserWindowGeometrySwitchTimerRef, setBrowserWindowGeometrySwitchingWindowId]);

const minimizeBrowserWindow = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) return;
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow) return;
    beginBrowserWindowGeometrySwitch(windowId);
    const isActiveWindow = windowId === activeBrowserWindowId && activeTab !== 'desktop';
    const nextWindow = isActiveWindow
      ? [...browserWindows].reverse().find(windowItem => windowItem.id !== windowId && !windowItem.minimized)
      : null;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === windowId
        ? {
            ...windowItem,
            activeTab: isActiveWindow ? activeTab : windowItem.activeTab,
            minimized: true,
            maximized: isActiveWindow ? browserWindowMaximized : windowItem.maximized,
          }
        : windowItem
    )));
    if (isActiveWindow) {
      if (nextWindow) {
        const nextTab = nextWindow.activeTab === 'desktop'
          ? (nextWindow.tabs?.[0] || 'chats')
          : nextWindow.activeTab;
        setActiveBrowserWindowId(nextWindow.id);
        setBrowserWindowMaximized(Boolean(nextWindow.maximized));
        setActiveTab(nextTab);
        if (nextTab === 'chats') {
          applyBrowserWindowSocialState(nextWindow);
        } else {
          setActiveContactId(null);
          setActiveContactSnapshot(null);
          activeContactRef.current = null;
          setActiveGroupId(null);
          activeGroupRef.current = null;
          setActiveDrawer(null);
        }
        return;
      }
      setActiveBrowserWindowId(null);
      setBrowserWindowMaximized(false);
      setActiveTab('desktop');
    }
  }, [activeBrowserWindowId, activeContactRef, activeGroupRef, activeTab, applyBrowserWindowSocialState, beginBrowserWindowGeometrySwitch, browserWindowMaximized, browserWindows, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows]);

const restoreBrowserWindow = useCallback((windowId) => {
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId)
      || browserWindows.find(windowItem => windowItem.minimized)
      || browserWindows[0];
    if (!targetWindow) return;

    beginBrowserWindowGeometrySwitch(targetWindow.id);
    if (activeBrowserWindowId && activeBrowserWindowId !== targetWindow.id && activeTab !== 'desktop') {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === targetWindow.id
        ? { ...windowItem, minimized: false, snapshotHtml: null }
        : windowItem
    )));
    setActiveBrowserWindowId(targetWindow.id);
    setBrowserWindowMaximized(Boolean(targetWindow.maximized));
    const nextTab = targetWindow.activeTab === 'desktop' ? 'chats' : targetWindow.activeTab;
    setActiveTab(nextTab);
    if (nextTab === 'chats') {
      applyBrowserWindowSocialState(targetWindow);
    }
  }, [activeBrowserWindowId, activeTab, applyBrowserWindowSocialState, beginBrowserWindowGeometrySwitch, browserWindows, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows, snapshotActiveBrowserWindow]);

const toggleBrowserWindowFromTaskbar = useCallback((windowId) => {
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow) return;
    if (targetWindow.minimized || activeBrowserWindowId !== windowId || activeTab === 'desktop') {
      restoreBrowserWindow(windowId);
      return;
    }
    minimizeBrowserWindow();
  }, [activeBrowserWindowId, activeTab, browserWindows, minimizeBrowserWindow, restoreBrowserWindow]);

const activateBrowserTab = useCallback((tab, tabIndex = null) => {
    if (!activeBrowserWindowId) return;
    snapshotActiveBrowserWindow(activeBrowserWindowId);
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === activeBrowserWindowId
        ? {
            ...windowItem,
            activeTab: tab,
            activeTabIndex: Number.isInteger(tabIndex) ? tabIndex : Math.max(0, (windowItem.tabs || []).indexOf(tab)),
            minimized: false,
            snapshotHtml: null,
          }
        : windowItem
    )));
    setActiveTab(tab);
  }, [activeBrowserWindowId, setActiveTab, setBrowserWindows, snapshotActiveBrowserWindow]);

const focusBrowserWindowTab = useCallback((windowId, tab, tabIndex = null) => {
    if (!windowId || !tab) return;
    const targetWindow = browserWindows.find(windowItem => windowItem.id === windowId);
    if (!targetWindow || !targetWindow.tabs?.includes(tab)) return;
    const resolvedTabIndex = Number.isInteger(tabIndex)
      ? tabIndex
      : Math.max(0, targetWindow.tabs.indexOf(tab));

    if (windowId === activeBrowserWindowId && activeTab !== 'desktop') {
      activateBrowserTab(tab, resolvedTabIndex);
      if (tab === 'chats') {
        applyBrowserWindowSocialState(targetWindow);
      }
      return;
    }

    if (activeBrowserWindowId && activeTab !== 'desktop') {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }

    beginBrowserWindowGeometrySwitch(windowId);
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      windowItem.id === windowId
        ? { ...windowItem, activeTab: tab, activeTabIndex: resolvedTabIndex, minimized: false, snapshotHtml: null }
        : windowItem
    )));
    setActiveBrowserWindowId(windowId);
    setBrowserWindowMaximized(Boolean(targetWindow.maximized));
    setActiveTab(tab);
    if (tab === 'chats') {
      applyBrowserWindowSocialState(targetWindow);
    }
  }, [activateBrowserTab, activeBrowserWindowId, activeTab, applyBrowserWindowSocialState, beginBrowserWindowGeometrySwitch, browserWindows, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows, snapshotActiveBrowserWindow]);

const toggleBrowserWindowMaximized = useCallback(() => {
    beginBrowserWindowGeometrySwitch(activeBrowserWindowId);
    setBrowserWindowMaximized((current) => {
      const next = !current;
      if (activeBrowserWindowId) {
        setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
          windowItem.id === activeBrowserWindowId
            ? { ...windowItem, maximized: next }
            : windowItem
        )));
      }
      return next;
    });
  }, [activeBrowserWindowId, beginBrowserWindowGeometrySwitch, setBrowserWindowMaximized, setBrowserWindows]);

const activeBrowserWindowStyle = useMemo(() => {
    if (!activeBrowserWindow || activeTab === 'desktop') return undefined;
    const latestActiveBrowserWindow = browserWindowsRef.current?.find(windowItem => windowItem.id === activeBrowserWindow.id)
      || activeBrowserWindow;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const geometry = browserWindowMaximized
      ? {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestActiveBrowserWindow);
    const contentHeight = Math.max(320, geometry.height - chromeHeight);
    const foregroundBaseWidth = Math.max(320, geometry.width);
    const foregroundBaseHeight = Math.max(320, contentHeight);

    return {
      '--browser-window-x': `${geometry.x}px`,
      '--browser-window-y': `${geometry.y}px`,
      '--browser-window-width': `${geometry.width}px`,
      '--browser-window-height': `${geometry.height}px`,
      '--browser-window-content-height': `${contentHeight}px`,
      '--private-foreground-base-width': `${foregroundBaseWidth}px`,
      '--private-foreground-base-height': `${foregroundBaseHeight}px`,
      '--private-foreground-scale': '1',
      '--private-chat-stage-width': `${foregroundBaseWidth}px`,
      '--private-chat-stage-height': `${foregroundBaseHeight}px`,
      '--private-chat-stage-scale': '1',
      '--private-chat-stage-x': '0px',
      '--private-chat-stage-y': '0px',
    };
  }, [DESKTOP_TASKBAR_HEIGHT, activeBrowserWindow, activeTab, browserWindowMaximized, browserWindowsRef, clampBrowserWindowGeometry, getResponsiveBrowserChromeHeight]);

const activeBrowserWindowLayoutClasses = useMemo(() => {
    if (!activeBrowserWindow || activeTab === 'desktop') return '';
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const latestActiveBrowserWindow = browserWindowsRef.current?.find(windowItem => windowItem.id === activeBrowserWindow.id)
      || activeBrowserWindow;
    const geometry = browserWindowMaximized
      ? {
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestActiveBrowserWindow);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const classes = [];

    if (geometry.width <= 760) classes.push('is-window-tight');
    if (geometry.width > 760 && geometry.width <= 1020) classes.push('is-window-mid');
    if (geometry.width >= 1180) classes.push('is-window-wide');
    if (contentHeight <= 430) classes.push('is-window-low');
    if (contentHeight >= 620) classes.push('is-window-tall');

    return classes.join(' ');
  }, [DESKTOP_TASKBAR_HEIGHT, activeBrowserWindow, activeTab, browserWindowMaximized, browserWindowsRef, clampBrowserWindowGeometry, getResponsiveBrowserChromeHeight]);

const getBrowserWindowStackStyle = useCallback((windowItem, index = 0) => {
    const latestWindowItem = browserWindowsRef.current?.find(currentWindow => currentWindow.id === windowItem?.id)
      || windowItem;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const isMaximized = Boolean(latestWindowItem?.maximized);
    const geometry = isMaximized
      ? {
        x: 0,
        y: 0,
        width: viewportWidth,
        height: Math.max(320, viewportHeight - taskbarHeight),
      }
      : clampBrowserWindowGeometry(latestWindowItem);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const snapshotWidth = Math.max(1, Number(windowItem.snapshotWidth) || geometry.width);
    const snapshotHeight = Math.max(1, Number(windowItem.snapshotHeight) || geometry.height);
    return {
      '--browser-window-x': `${geometry.x}px`,
      '--browser-window-y': `${geometry.y}px`,
      '--browser-window-width': `${geometry.width}px`,
      '--browser-window-height': `${geometry.height}px`,
      '--browser-window-content-height': `${contentHeight}px`,
      '--shadow-window-x': `${geometry.x}px`,
      '--shadow-window-y': `${geometry.y}px`,
      '--shadow-window-width': `${geometry.width}px`,
      '--shadow-window-height': `${geometry.height}px`,
      '--shadow-window-content-height': `${contentHeight}px`,
      '--shadow-snapshot-width': `${snapshotWidth}px`,
      '--shadow-snapshot-height': `${snapshotHeight}px`,
      '--private-foreground-base-width': `${Math.max(320, geometry.width)}px`,
      '--private-foreground-base-height': `${Math.max(320, contentHeight)}px`,
      '--private-foreground-scale': '1',
      '--private-chat-stage-width': `${Math.max(320, geometry.width)}px`,
      '--private-chat-stage-height': `${Math.max(320, contentHeight)}px`,
      '--private-chat-stage-scale': '1',
      '--private-chat-stage-x': '0px',
      '--private-chat-stage-y': '0px',
      '--shadow-window-z': 42 + index,
    };
  }, [DESKTOP_TASKBAR_HEIGHT, browserWindowsRef, clampBrowserWindowGeometry, getResponsiveBrowserChromeHeight]);

const applyBrowserWindowPreviewGeometry = useCallback((windowId, geometry) => {
    if (typeof document === 'undefined' || !windowId || !geometry) return;
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const target = windowId === activeBrowserWindowId
      ? document.querySelector('.app-container:not(.tab-desktop)')
      : document.querySelector(`[data-browser-window-id="${windowId}"]`);
    if (!target) return;
    const propertyPrefix = windowId === activeBrowserWindowId ? '--browser-window' : '--shadow-window';
    target.style.setProperty(`${propertyPrefix}-x`, `${geometry.x}px`);
    target.style.setProperty(`${propertyPrefix}-y`, `${geometry.y}px`);
    target.style.setProperty(`${propertyPrefix}-width`, `${geometry.width}px`);
    target.style.setProperty(`${propertyPrefix}-height`, `${geometry.height}px`);
    target.style.setProperty(`${propertyPrefix}-content-height`, `${contentHeight}px`);
    if (windowId !== activeBrowserWindowId) {
      target.style.setProperty('--browser-window-x', `${geometry.x}px`);
      target.style.setProperty('--browser-window-y', `${geometry.y}px`);
      target.style.setProperty('--browser-window-width', `${geometry.width}px`);
      target.style.setProperty('--browser-window-height', `${geometry.height}px`);
      target.style.setProperty('--browser-window-content-height', `${contentHeight}px`);
    }
  }, [activeBrowserWindowId, getResponsiveBrowserChromeHeight]);

const getBrowserWindowDomNode = useCallback((windowId = activeBrowserWindowId) => {
    if (typeof document === 'undefined' || !windowId) return null;
    if (windowId === activeBrowserWindowId) {
      return document.querySelector('.app-container:not(.tab-desktop):not(.desktop-browser-live-window)');
    }
    return document.querySelector(`[data-browser-window-id="${windowId}"]`);
  }, [activeBrowserWindowId]);

const setBrowserWindowDomInteraction = useCallback((windowId, mode, enabled) => {
    const target = getBrowserWindowDomNode(windowId);
    if (!target) return;
    const classes = ['is-window-dragging', 'is-window-resizing', 'is-window-tab-dragging'];
    classes.forEach((className) => target.classList.remove(className));
    target.classList.toggle('is-interacting', Boolean(enabled));
    if (!enabled) return;
    if (mode === 'resize') {
      target.classList.add('is-window-resizing');
    } else if (mode === 'tab') {
      target.classList.add('is-window-tab-dragging');
    } else {
      target.classList.add('is-window-dragging');
    }
  }, [getBrowserWindowDomNode]);

const commitBrowserWindowGeometry = useCallback((windowId, geometry, options = {}) => {
    if (!windowId || !geometry) return;
    const finalGeometry = clampBrowserWindowGeometry(geometry);
    browserWindowsRef.current = (browserWindowsRef.current || []).map((windowItem) => (
      windowItem.id === windowId
        ? { ...windowItem, ...finalGeometry, maximized: false }
        : windowItem
    ));

    const existingTimer = browserWindowGeometrySyncTimersRef.current.get(windowId);
    if (existingTimer) {
      if (existingTimer.type === 'idle' && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(existingTimer.id);
      } else if (typeof window !== 'undefined') {
        window.clearTimeout(existingTimer.id);
      }
    }

    const syncState = () => {
      browserWindowGeometrySyncTimersRef.current.delete(windowId);
      setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
        windowItem.id === windowId
          ? { ...windowItem, ...finalGeometry, maximized: false }
          : windowItem
      )));
    };

    if (options.defer === false || typeof window === 'undefined') {
      syncState();
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(syncState, { timeout: 900 });
      browserWindowGeometrySyncTimersRef.current.set(windowId, { type: 'idle', id });
      return;
    }

    const id = window.setTimeout(syncState, 220);
    browserWindowGeometrySyncTimersRef.current.set(windowId, { type: 'timeout', id });
  }, [browserWindowGeometrySyncTimersRef, browserWindowsRef, clampBrowserWindowGeometry, setBrowserWindows]);

const moveBrowserTabToWindow = useCallback((sourceWindowId, tabId, targetWindowId, sourceTabIndex = null) => {
    if (!sourceWindowId || !targetWindowId || !tabId || sourceWindowId === targetWindowId) return false;

    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const targetWindow = browserWindows.find(windowItem => windowItem.id === targetWindowId);
    if (!sourceWindow || !targetWindow || !sourceWindow.tabs?.includes(tabId)) return false;

    const nextMaximized = targetWindow.id === activeBrowserWindowId
      ? browserWindowMaximized
      : Boolean(targetWindow.maximized);
    const nextActiveTab = tabId;

    setBrowserWindows((currentWindows) => {
      const currentSource = currentWindows.find(windowItem => windowItem.id === sourceWindowId);
      const currentTarget = currentWindows.find(windowItem => windowItem.id === targetWindowId);
      if (!currentSource || !currentTarget || !currentSource.tabs?.includes(tabId)) return currentWindows;

      const currentSourceTabs = currentSource.tabs || [];
      const resolvedSourceIndex = Number.isInteger(sourceTabIndex)
        && currentSourceTabs[sourceTabIndex] === tabId
        ? sourceTabIndex
        : currentSourceTabs.indexOf(tabId);
      if (resolvedSourceIndex < 0) return currentWindows;

      const remainingSourceTabs = currentSourceTabs.filter((_, index) => index !== resolvedSourceIndex);
      const sourceTabSnapshots = currentSource.tabSnapshots || {};
      const targetTabSnapshots = currentTarget.tabSnapshots || {};
      const targetTabs = [...(currentTarget.tabs || []), tabId];
      const currentSourceActiveIndex = Number.isInteger(currentSource.activeTabIndex)
        ? currentSource.activeTabIndex
        : currentSourceTabs.indexOf(currentSource.activeTab);
      const nextSourceActiveIndex = remainingSourceTabs.length
        ? (
            currentSourceActiveIndex === resolvedSourceIndex
              ? Math.min(resolvedSourceIndex, remainingSourceTabs.length - 1)
              : Math.max(0, currentSourceActiveIndex - (currentSourceActiveIndex > resolvedSourceIndex ? 1 : 0))
          )
        : -1;
      const nextSourceActiveTab = remainingSourceTabs[nextSourceActiveIndex];
      const nextSourceSnapshot = getBrowserSnapshotFields(sourceTabSnapshots[nextSourceActiveTab]);
      const movedTabSnapshot = sourceTabSnapshots[tabId];
      const nextTargetActiveIndex = targetTabs.length - 1;

      return currentWindows.reduce((nextWindows, windowItem) => {
        if (windowItem.id === sourceWindowId) {
          if (remainingSourceTabs.length > 0) {
            nextWindows.push({
              ...windowItem,
              tabs: remainingSourceTabs,
              activeTab: nextSourceActiveTab,
              activeTabIndex: nextSourceActiveIndex,
              ...nextSourceSnapshot,
            });
          }
          return nextWindows;
        }

        if (windowItem.id === targetWindowId) {
          nextWindows.push({
            ...windowItem,
            tabs: targetTabs,
            activeTab: nextActiveTab,
            activeTabIndex: nextTargetActiveIndex,
            minimized: false,
            maximized: nextMaximized,
            snapshotHtml: null,
            social: tabId === 'chats'
              ? { ...(currentSource.social || currentTarget.social || {}) }
              : currentTarget.social,
            tabSnapshots: {
              ...targetTabSnapshots,
              ...(movedTabSnapshot ? { [tabId]: movedTabSnapshot } : {}),
            },
          });
          return nextWindows;
        }

        nextWindows.push(windowItem);
        return nextWindows;
      }, []);
    });

    setActiveBrowserWindowId(targetWindowId);
    setBrowserWindowMaximized(nextMaximized);
    setActiveTab(nextActiveTab);
    return true;
  }, [activeBrowserWindowId, browserWindowMaximized, browserWindows, getBrowserSnapshotFields, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows]);

const detachBrowserTabToWindow = useCallback((sourceWindowId, tabId, pointerX, pointerY, sourceTabIndex = null) => {
    if (!sourceWindowId || !tabId) return false;

    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const sourceTabs = sourceWindow?.tabs || [];
    if (!sourceWindow || sourceTabs.length <= 1 || !sourceTabs.includes(tabId)) return false;
    const resolvedSourceIndex = Number.isInteger(sourceTabIndex) && sourceTabs[sourceTabIndex] === tabId
      ? sourceTabIndex
      : sourceTabs.indexOf(tabId);
    if (resolvedSourceIndex < 0) return false;

    const sourceGeometry = clampBrowserWindowGeometry(sourceWindow);
    const newWindowId = `browser-window-${browserWindowSeqRef.current++}`;
    const nextGeometry = clampBrowserWindowGeometry({
      ...sourceGeometry,
      x: Math.round((Number(pointerX) || sourceGeometry.x) - Math.min(sourceGeometry.width * 0.42, 360)),
      y: Math.round((Number(pointerY) || sourceGeometry.y) - 18),
    });
    const remainingSourceTabs = sourceTabs.filter((_, index) => index !== resolvedSourceIndex);
    const currentSourceActiveIndex = Number.isInteger(sourceWindow.activeTabIndex)
      ? sourceWindow.activeTabIndex
      : sourceTabs.indexOf(sourceWindow.activeTab);
    const nextSourceActiveIndex = remainingSourceTabs.length
      ? (
          currentSourceActiveIndex === resolvedSourceIndex
            ? Math.min(resolvedSourceIndex, remainingSourceTabs.length - 1)
            : Math.max(0, currentSourceActiveIndex - (currentSourceActiveIndex > resolvedSourceIndex ? 1 : 0))
        )
      : -1;
    const nextSourceActiveTab = remainingSourceTabs[nextSourceActiveIndex];
    const sourceTabSnapshots = sourceWindow.tabSnapshots || {};
    const nextSourceSnapshot = getBrowserSnapshotFields(sourceTabSnapshots[nextSourceActiveTab]);
    const detachedTabSnapshot = sourceTabSnapshots[tabId];

    setBrowserWindows((currentWindows) => {
      const nextWindows = [];
      currentWindows.forEach((windowItem) => {
        if (windowItem.id === sourceWindowId) {
          nextWindows.push({
            ...windowItem,
            tabs: remainingSourceTabs,
            activeTab: nextSourceActiveTab,
            activeTabIndex: nextSourceActiveIndex,
            social: remainingSourceTabs.includes('chats') ? windowItem.social : undefined,
            ...nextSourceSnapshot,
          });
          nextWindows.push({
            id: newWindowId,
            tabs: [tabId],
            activeTab: tabId,
            activeTabIndex: 0,
            minimized: false,
            maximized: false,
            snapshotHtml: null,
            social: tabId === 'chats' ? { ...(sourceWindow.social || {}) } : undefined,
            tabSnapshots: detachedTabSnapshot ? { [tabId]: detachedTabSnapshot } : {},
            ...nextGeometry,
          });
          return;
        }
        nextWindows.push(windowItem);
      });
      return nextWindows;
    });

    setActiveBrowserWindowId(newWindowId);
    setBrowserWindowMaximized(false);
    setActiveTab(tabId);
    return true;
  }, [browserWindowSeqRef, browserWindows, clampBrowserWindowGeometry, getBrowserSnapshotFields, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows]);

const updateBrowserWindowGeometry = useCallback((windowId, updater) => {
    if (!windowId) return;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => {
      if (windowItem.id !== windowId) return windowItem;
      const currentGeometry = clampBrowserWindowGeometry(windowItem);
      const nextGeometry = clampBrowserWindowGeometry(
        typeof updater === 'function' ? updater(currentGeometry) : updater
      );
      return { ...windowItem, ...nextGeometry, maximized: false };
    }));
    if (windowId === activeBrowserWindowId) setBrowserWindowMaximized(false);
  }, [activeBrowserWindowId, clampBrowserWindowGeometry, setBrowserWindowMaximized, setBrowserWindows]);

const getBrowserTabDropTargetId = useCallback((event, interaction = browserWindowInteractionRef.current) => {
    if (
      !interaction
      || interaction.type !== 'tab'
      || typeof window === 'undefined'
    ) {
      return null;
    }

    const chromeHeight = getResponsiveBrowserChromeHeight();
    const horizontalSlop = 12;
    const verticalSlop = 10;

    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const candidates = currentBrowserWindows
      .filter(windowItem => !windowItem.minimized && windowItem.id !== interaction.sourceWindowId)
      .map((windowItem, index) => {
        const targetGeometry = clampBrowserWindowGeometry(windowItem);
        const pointerInsideCardHead =
          event.clientX >= targetGeometry.x - horizontalSlop
          && event.clientX <= targetGeometry.x + targetGeometry.width + horizontalSlop
          && event.clientY >= targetGeometry.y - verticalSlop
          && event.clientY <= targetGeometry.y + chromeHeight + verticalSlop;

        if (!pointerInsideCardHead) return null;

        const chromeMidpointY = targetGeometry.y + chromeHeight / 2;
        const verticalScore = Math.max(0, chromeHeight - Math.abs(event.clientY - chromeMidpointY));

        return {
          id: windowItem.id,
          score:
            (windowItem.id === activeBrowserWindowId ? 100000 : 0)
            + verticalScore
            + index,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.id || null;
  }, [activeBrowserWindowId, browserWindowInteractionRef, browserWindows, browserWindowsRef, clampBrowserWindowGeometry, getResponsiveBrowserChromeHeight]);

const stopBrowserWindowInteraction = useCallback((event) => {
    const interaction = browserWindowInteractionRef.current;
    if (!interaction) return;
    browserWindowPointerListenerCleanupRef.current?.();
    browserWindowPointerListenerCleanupRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(interaction.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (interaction.type === 'tab') {
      const dropTargetId = browserWindowMergeTargetId || getBrowserTabDropTargetId(event, interaction);
      const sourceWindow = browserWindows.find(windowItem => windowItem.id === interaction.sourceWindowId);
      const sourceGeometry = sourceWindow ? clampBrowserWindowGeometry(sourceWindow) : null;
      const chromeHeight = getResponsiveBrowserChromeHeight();
      const outsideSourceCardHead = sourceGeometry
        ? (
            event.clientX < sourceGeometry.x - DESKTOP_TAB_DETACH_OFFSET
            || event.clientX > sourceGeometry.x + sourceGeometry.width + DESKTOP_TAB_DETACH_OFFSET
            || event.clientY < sourceGeometry.y - DESKTOP_TAB_DETACH_OFFSET
            || event.clientY > sourceGeometry.y + chromeHeight + DESKTOP_TAB_DETACH_OFFSET
          )
        : false;

      browserWindowInteractionRef.current = null;
      setBrowserWindowInteractionMode(null);
      setBrowserWindowMergeTargetId(null);
      setBrowserTabDragPreview(null);

      if (event.type !== 'pointercancel') {
        if (interaction.moved && dropTargetId && interaction.sourceWindowId !== dropTargetId) {
          event.preventDefault();
          moveBrowserTabToWindow(interaction.sourceWindowId, interaction.tabId, dropTargetId, interaction.tabIndex);
        } else if (interaction.moved && outsideSourceCardHead) {
          event.preventDefault();
          detachBrowserTabToWindow(interaction.sourceWindowId, interaction.tabId, event.clientX, event.clientY, interaction.tabIndex);
        } else if (!interaction.moved) {
          focusBrowserWindowTab(interaction.sourceWindowId, interaction.tabId, interaction.tabIndex);
        }
      }

      if (interaction.moved) {
        suppressBrowserWindowClickRef.current = interaction.sourceWindowId;
        window.setTimeout(() => {
          if (suppressBrowserWindowClickRef.current === interaction.sourceWindowId) {
            suppressBrowserWindowClickRef.current = null;
          }
        }, 180);
      }
      return;
    }

    const finalGeometry = interaction.currentGeometry
      ? clampBrowserWindowGeometry(interaction.currentGeometry)
      : null;
    browserWindowInteractionRef.current = null;
    setBrowserWindowDomInteraction(
      interaction.windowId,
      interaction.type === 'resize' ? 'resize' : 'drag',
      false
    );
    setBrowserWindowMergeTargetId(null);

    if (finalGeometry && interaction.moved) {
      commitBrowserWindowGeometry(interaction.windowId, finalGeometry);
      if (interaction.windowId === activeBrowserWindowId && browserWindowMaximized) {
        setBrowserWindowMaximized(false);
      }
    }

    if (interaction.moved) {
      suppressBrowserWindowClickRef.current = interaction.windowId;
      window.setTimeout(() => {
        if (suppressBrowserWindowClickRef.current === interaction.windowId) {
          suppressBrowserWindowClickRef.current = null;
        }
      }, 180);
    }
  }, [browserWindowInteractionRef, browserWindowPointerListenerCleanupRef, clampBrowserWindowGeometry, setBrowserWindowDomInteraction, setBrowserWindowMergeTargetId, browserWindowMergeTargetId, getBrowserTabDropTargetId, browserWindows, getResponsiveBrowserChromeHeight, DESKTOP_TAB_DETACH_OFFSET, setBrowserWindowInteractionMode, setBrowserTabDragPreview, moveBrowserTabToWindow, detachBrowserTabToWindow, focusBrowserWindowTab, suppressBrowserWindowClickRef, commitBrowserWindowGeometry, activeBrowserWindowId, browserWindowMaximized, setBrowserWindowMaximized]);

const handleBrowserWindowPointerMove = useCallback((event) => {
    const interaction = browserWindowInteractionRef.current;
    if (!interaction) return;
    event.preventDefault();
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    if (!interaction.moved && Math.hypot(deltaX, deltaY) > DESKTOP_TAB_DRAG_THRESHOLD) {
      interaction.moved = true;
    }

    if (interaction.type === 'tab') {
      interaction.currentX = event.clientX;
      interaction.currentY = event.clientY;
      if (interaction.moved) {
        setBrowserTabDragPreview({
          x: event.clientX,
          y: event.clientY,
          title: interaction.title,
          mark: interaction.mark,
          moved: true,
        });
      }
      const dropTargetId = getBrowserTabDropTargetId(event, interaction);
      setBrowserWindowMergeTargetId((current) => (
        current === dropTargetId ? current : dropTargetId
      ));
      return;
    }

    const nextGeometry = interaction.type === 'resize'
      ? resizeBrowserWindowGeometry(
        interaction.startGeometry,
        deltaX,
        deltaY,
        interaction.direction
      )
      : clampBrowserWindowGeometry({
        ...interaction.startGeometry,
        x: interaction.startGeometry.x + deltaX,
        y: interaction.startGeometry.y + deltaY,
      });
    interaction.currentGeometry = nextGeometry;
    applyBrowserWindowPreviewGeometry(interaction.windowId, nextGeometry);
  }, [DESKTOP_TAB_DRAG_THRESHOLD, applyBrowserWindowPreviewGeometry, browserWindowInteractionRef, clampBrowserWindowGeometry, getBrowserTabDropTargetId, resizeBrowserWindowGeometry, setBrowserTabDragPreview, setBrowserWindowMergeTargetId]);

const attachBrowserWindowPointerListeners = useCallback(() => {
    if (typeof window === 'undefined') return;
    browserWindowPointerListenerCleanupRef.current?.();
    const handleGlobalPointerMove = (event) => {
      handleBrowserWindowPointerMove(event);
    };
    const handleGlobalPointerEnd = (event) => {
      stopBrowserWindowInteraction(event);
    };
    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);
    browserWindowPointerListenerCleanupRef.current = () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
    };
  }, [browserWindowPointerListenerCleanupRef, handleBrowserWindowPointerMove, stopBrowserWindowInteraction]);

const startBrowserWindowDrag = useCallback((event, windowId = activeBrowserWindowId) => {
    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const targetWindow = currentBrowserWindows.find(windowItem => windowItem.id === windowId) || activeBrowserWindow;
    if (!targetWindow || event.button !== 0) return;
    if (targetWindow.maximized || (windowId === activeBrowserWindowId && browserWindowMaximized)) return;
    if (event.target.closest('button, a, input, textarea, select, .desktop-browser-tab, .desktop-browser-address, [data-window-no-drag="true"]')) return;
    event.preventDefault();
    const geometry = clampBrowserWindowGeometry(targetWindow);
    browserWindowInteractionRef.current = {
      type: 'move',
      windowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      moved: false,
    };
    setBrowserWindowDomInteraction(windowId, 'drag', true);
    setBrowserWindowMergeTargetId(null);
    attachBrowserWindowPointerListeners();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [activeBrowserWindow, activeBrowserWindowId, attachBrowserWindowPointerListeners, browserWindowInteractionRef, browserWindowMaximized, browserWindows, browserWindowsRef, clampBrowserWindowGeometry, setBrowserWindowDomInteraction, setBrowserWindowMergeTargetId]);

const startBrowserWindowResize = useCallback((event, direction = 'se', windowId = activeBrowserWindowId) => {
    const currentBrowserWindows = browserWindowsRef.current?.length ? browserWindowsRef.current : browserWindows;
    const targetWindow = currentBrowserWindows.find(windowItem => windowItem.id === windowId) || activeBrowserWindow;
    if (!targetWindow || event.button !== 0) return;
    if (targetWindow.maximized || (windowId === activeBrowserWindowId && browserWindowMaximized)) return;
    event.preventDefault();
    event.stopPropagation();
    const geometry = clampBrowserWindowGeometry(targetWindow);
    browserWindowInteractionRef.current = {
      type: 'resize',
      windowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      direction,
      moved: false,
    };
    setBrowserWindowDomInteraction(windowId, 'resize', true);
    setBrowserWindowMergeTargetId(null);
    attachBrowserWindowPointerListeners();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [activeBrowserWindow, activeBrowserWindowId, attachBrowserWindowPointerListeners, browserWindowInteractionRef, browserWindowMaximized, browserWindows, browserWindowsRef, clampBrowserWindowGeometry, setBrowserWindowDomInteraction, setBrowserWindowMergeTargetId]);

const getShadowWindowTabAtPoint = useCallback((event, windowItem) => {
    const tabs = windowItem?.tabs || [];
    if (!tabs.length) return null;

    const geometry = clampBrowserWindowGeometry(windowItem);
    const relativeX = event.clientX - geometry.x;
    const relativeY = event.clientY - geometry.y;
    const tabStripHeight = 42;
    if (relativeY < 0 || relativeY > tabStripHeight) return null;

    const leftPadding = 10;
    const rightReserved = 160;
    const addButtonWidth = 40;
    const usableWidth = Math.max(0, geometry.width - leftPadding - rightReserved - addButtonWidth);
    if (relativeX < leftPadding || relativeX > leftPadding + usableWidth) return null;

    const gap = 4;
    const tabWidth = Math.min(260, Math.max(128, (usableWidth - gap * Math.max(0, tabs.length - 1)) / tabs.length));
    const tabIndex = Math.floor((relativeX - leftPadding) / (tabWidth + gap));
    const tabStart = leftPadding + tabIndex * (tabWidth + gap);
    const insideTab = relativeX >= tabStart && relativeX <= tabStart + tabWidth;
    if (!insideTab) return null;
    return tabs[tabIndex] ? { tabId: tabs[tabIndex], tabIndex } : null;
  }, [clampBrowserWindowGeometry]);

const startBrowserTabDrag = useCallback((event, tabId, sourceWindowId = activeBrowserWindowId, tabIndex = null) => {
    const sourceWindow = browserWindows.find(windowItem => windowItem.id === sourceWindowId);
    const sourceTabs = sourceWindow?.tabs || [];
    const resolvedTabIndex = Number.isInteger(tabIndex) && sourceTabs[tabIndex] === tabId
      ? tabIndex
      : sourceTabs.indexOf(tabId);
    if (!sourceWindow || !tabId || event.button !== 0 || resolvedTabIndex < 0) return;
    if (sourceWindow.maximized || (sourceWindowId === activeBrowserWindowId && browserWindowMaximized)) return;

    event.preventDefault();
    event.stopPropagation();

    const geometry = clampBrowserWindowGeometry(sourceWindow);
    const title = getBrowserTabLabel(tabId);
    const mark = getBrowserTabMark(tabId);
    browserWindowInteractionRef.current = {
      type: 'tab',
      tabId,
      tabIndex: resolvedTabIndex,
      sourceWindowId,
      windowId: sourceWindowId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      startGeometry: geometry,
      currentGeometry: geometry,
      title,
      mark,
      moved: false,
    };
    setBrowserWindowInteractionMode('tab-dragging');
    setBrowserWindowMergeTargetId(null);
    setBrowserTabDragPreview({
      x: event.clientX,
      y: event.clientY,
      title,
      mark,
      moved: false,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [activeBrowserWindowId, browserWindowInteractionRef, browserWindowMaximized, browserWindows, clampBrowserWindowGeometry, getBrowserTabLabel, getBrowserTabMark, setBrowserTabDragPreview, setBrowserWindowInteractionMode, setBrowserWindowMergeTargetId]);

const handleBrowserShadowWindowPointerDown = useCallback((event, windowItem) => {
    const tabHit = getShadowWindowTabAtPoint(event, windowItem);
    if (tabHit) {
      startBrowserTabDrag(event, tabHit.tabId, windowItem.id, tabHit.tabIndex);
      return;
    }
    startBrowserWindowDrag(event, windowItem.id);
  }, [getShadowWindowTabAtPoint, startBrowserTabDrag, startBrowserWindowDrag]);

useEffect(() => {
    if (!browserWindowInteractionMode || typeof window === 'undefined') return undefined;

    const handleGlobalPointerMove = (event) => {
      handleBrowserWindowPointerMove(event);
    };
    const handleGlobalPointerEnd = (event) => {
      stopBrowserWindowInteraction(event);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: false });
    window.addEventListener('pointerup', handleGlobalPointerEnd);
    window.addEventListener('pointercancel', handleGlobalPointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerEnd);
      window.removeEventListener('pointercancel', handleGlobalPointerEnd);
    };
  }, [browserWindowInteractionMode, handleBrowserWindowPointerMove, stopBrowserWindowInteraction]);

const closeBrowserWindow = useCallback((windowId = activeBrowserWindowId) => {
    if (!windowId) {
      openDesktop();
      return;
    }
    const isActiveWindow = windowId === activeBrowserWindowId;
    const remainingWindows = browserWindows.filter(windowItem => windowItem.id !== windowId);
    const nextWindow = [...remainingWindows].reverse().find(windowItem => !windowItem.minimized) || null;

    setBrowserWindows(remainingWindows);
    if (!isActiveWindow) {
      return;
    }
    if (nextWindow) {
      const nextTab = nextWindow.activeTab || nextWindow.tabs?.[0] || 'desktop';
      setActiveBrowserWindowId(nextWindow.id);
      setBrowserWindowMaximized(Boolean(nextWindow.maximized));
      setActiveTab(nextTab);
      if (nextTab === 'chats') {
        applyBrowserWindowSocialState(nextWindow);
      } else {
        setActiveContactId(null);
        setActiveContactSnapshot(null);
        activeContactRef.current = null;
        setActiveGroupId(null);
        activeGroupRef.current = null;
        setActiveDrawer(null);
      }
      return;
    }

    setActiveBrowserWindowId(null);
    setBrowserWindowMaximized(false);
    setActiveTab('desktop');
  }, [activeBrowserWindowId, activeContactRef, activeGroupRef, applyBrowserWindowSocialState, browserWindows, openDesktop, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows]);

const browserTabs = useMemo(() => {
    const tabs = activeBrowserWindow?.tabs?.length
      ? activeBrowserWindow.tabs
      : (activeTab !== 'desktop' ? [activeTab] : []);
    const fallbackActiveIndex = Math.max(0, tabs.indexOf(activeTab));
    const activeTabIndex = Number.isInteger(activeBrowserWindow?.activeTabIndex)
      && activeBrowserWindow.activeTabIndex >= 0
      && activeBrowserWindow.activeTabIndex < tabs.length
      ? activeBrowserWindow.activeTabIndex
      : fallbackActiveIndex;
    return tabs.map((tab, index) => ({
      id: tab,
      index,
      key: `${tab}-${index}`,
      title: getBrowserTabLabel(tab),
      mark: getBrowserTabMark(tab),
      active: tab === activeTab && index === activeTabIndex,
    }));
  }, [activeBrowserWindow, activeTab, getBrowserTabLabel, getBrowserTabMark]);

const getBrowserWindowTabs = useCallback((windowItem) => {
    const tabs = windowItem?.tabs?.length ? windowItem.tabs : [windowItem?.activeTab].filter(Boolean);
    const fallbackActiveIndex = Math.max(0, tabs.indexOf(windowItem?.activeTab));
    const activeTabIndex = Number.isInteger(windowItem?.activeTabIndex)
      && windowItem.activeTabIndex >= 0
      && windowItem.activeTabIndex < tabs.length
      ? windowItem.activeTabIndex
      : fallbackActiveIndex;

    return tabs.map((tab, index) => ({
      id: tab,
      index,
      key: `${windowItem?.id || 'window'}-${tab}-${index}`,
      title: getBrowserTabLabel(tab),
      mark: getBrowserTabMark(tab),
      active: tab === windowItem?.activeTab && index === activeTabIndex,
    }));
  }, [getBrowserTabLabel, getBrowserTabMark]);

const getBrowserWindowAddress = useCallback((tab) => {
    const label = getBrowserTabLabel(tab);
    const appSlug = String(label || 'app')
      .trim()
      .replace(/\s+/g, '-');
    return `${window.location.host}/${appSlug}`;
  }, [getBrowserTabLabel]);

const getBrowserWindowLayoutClasses = useCallback((windowItem, maximized = false) => {
    if (!windowItem) return '';
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const taskbarHeight = DESKTOP_TASKBAR_HEIGHT;
    const latestWindowItem = browserWindowsRef.current?.find(currentWindow => currentWindow.id === windowItem.id)
      || windowItem;
    const geometry = maximized || latestWindowItem.maximized
      ? {
          width: viewportWidth,
          height: Math.max(320, viewportHeight - taskbarHeight),
        }
      : clampBrowserWindowGeometry(latestWindowItem);
    const chromeHeight = getResponsiveBrowserChromeHeight();
    const contentHeight = Math.max(260, geometry.height - chromeHeight);
    const classes = [];

    if (geometry.width <= 760) classes.push('is-window-tight');
    if (geometry.width > 760 && geometry.width <= 1020) classes.push('is-window-mid');
    if (geometry.width >= 1180) classes.push('is-window-wide');
    if (contentHeight <= 430) classes.push('is-window-low');
    if (contentHeight >= 620) classes.push('is-window-tall');

    return classes.join(' ');
  }, [DESKTOP_TASKBAR_HEIGHT, browserWindowsRef, clampBrowserWindowGeometry, getResponsiveBrowserChromeHeight]);

useEffect(() => {
    if (!activeBrowserWindowId || activeTab === 'desktop' || typeof window === 'undefined') return undefined;
    const timerId = window.setTimeout(() => {
      snapshotActiveBrowserWindow(activeBrowserWindowId);
    }, 140);
    return () => window.clearTimeout(timerId);
  }, [
    activeBrowserWindowId,
    activeContactId,
    activeGroupId,
    activeTab,
    browserWindowMaximized,
    contacts,
    groups,
    groupUnreadCounts,
    lang,
    snapshotActiveBrowserWindow,
  ]);

useEffect(() => {
    clearRetiredThemeOverrides();
  }, [clearRetiredThemeOverrides]);
    return { beginBrowserWindowGeometrySwitch, minimizeBrowserWindow, restoreBrowserWindow, toggleBrowserWindowFromTaskbar, activateBrowserTab, focusBrowserWindowTab, toggleBrowserWindowMaximized, activeBrowserWindowStyle, activeBrowserWindowLayoutClasses, getBrowserWindowStackStyle, applyBrowserWindowPreviewGeometry, getBrowserWindowDomNode, setBrowserWindowDomInteraction, commitBrowserWindowGeometry, moveBrowserTabToWindow, detachBrowserTabToWindow, updateBrowserWindowGeometry, getBrowserTabDropTargetId, stopBrowserWindowInteraction, handleBrowserWindowPointerMove, attachBrowserWindowPointerListeners, startBrowserWindowDrag, startBrowserWindowResize, getShadowWindowTabAtPoint, startBrowserTabDrag, handleBrowserShadowWindowPointerDown, closeBrowserWindow, browserTabs, getBrowserWindowTabs, getBrowserWindowAddress, getBrowserWindowLayoutClasses };
}
