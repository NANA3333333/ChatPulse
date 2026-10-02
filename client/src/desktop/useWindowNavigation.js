import { useCallback, useEffect } from 'react';

export function useWindowNavigation(dependencies) {
const { DESKTOP_MULTI_WINDOW_APP_TABS, DESKTOP_WINDOW_CHROME_HEIGHT, activeBrowserWindowId, activeContactId, activeContactRef, activeDrawer, activeGroupId, activeGroupRef, activeTab, browserWindowMaximized, browserWindowRecallPulse, browserWindowSeqRef, browserWindowsRef, contacts, getDefaultBrowserWindowGeometry, groups, normalizeConversationJumpTarget, setActiveBrowserWindowId, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setActiveTab, setBrowserWindowMaximized, setBrowserWindowRecallPulse, setBrowserWindows, setConversationJumpTarget } = dependencies;
const normalizeBrowserWindowSocialState = useCallback((socialState = {}) => {
    const searchJumpTarget = normalizeConversationJumpTarget(socialState?.searchJumpTarget);
    const requestedGroupId = socialState?.activeGroupId;
    const selectedGroup = requestedGroupId
      ? groups.find(group => String(group.id) === String(requestedGroupId))
      : null;
    if (selectedGroup) {
      return {
        activeContactId: null,
        activeGroupId: selectedGroup.id,
        activeDrawer: socialState?.activeDrawer || null,
        searchJumpTarget: searchJumpTarget?.scope === 'group' && searchJumpTarget.groupId === selectedGroup.id ? searchJumpTarget : null,
      };
    }

    const requestedContactId = socialState?.activeContactId;
    const selectedContact = requestedContactId
      ? contacts.find(contact => String(contact.id) === String(requestedContactId))
      : null;
    const fallbackContact = selectedContact || contacts[0] || null;
    return {
      activeContactId: fallbackContact?.id || null,
      activeGroupId: null,
      activeDrawer: socialState?.activeDrawer || null,
      searchJumpTarget: searchJumpTarget?.scope === 'private' && searchJumpTarget.characterId === fallbackContact?.id ? searchJumpTarget : null,
    };
  }, [contacts, groups, normalizeConversationJumpTarget]);

const applyBrowserWindowSocialState = useCallback((windowItem) => {
    const socialState = normalizeBrowserWindowSocialState(windowItem?.social || {});
    const selectedContact = socialState.activeContactId
      ? contacts.find(contact => String(contact.id) === String(socialState.activeContactId))
      : null;

    setActiveGroupId(socialState.activeGroupId);
    activeGroupRef.current = socialState.activeGroupId;
    setActiveContactId(socialState.activeContactId);
    setActiveContactSnapshot(selectedContact || null);
    activeContactRef.current = socialState.activeContactId;
    setActiveDrawer(socialState.activeDrawer || null);
    setConversationJumpTarget(socialState.searchJumpTarget || null);
  }, [activeContactRef, activeGroupRef, contacts, normalizeBrowserWindowSocialState, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId, setConversationJumpTarget]);

const updateBrowserWindowSocialState = useCallback((windowId, patch = {}) => {
    if (!windowId) return;
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => {
      if (windowItem.id !== windowId) return windowItem;
      const previousSocial = windowItem.social || {};
      const nextSocial = {
        ...previousSocial,
        ...patch,
      };
      if (
        previousSocial.activeContactId === nextSocial.activeContactId
        && previousSocial.activeGroupId === nextSocial.activeGroupId
        && previousSocial.activeDrawer === nextSocial.activeDrawer
        && previousSocial.searchJumpTarget === nextSocial.searchJumpTarget
      ) {
        return windowItem;
      }
      return { ...windowItem, social: nextSocial };
    }));
  }, [setBrowserWindows]);

const buildActiveBrowserWindowSnapshot = useCallback(() => {
    if (typeof document === 'undefined' || activeTab === 'desktop' || !activeBrowserWindowId) {
      return null;
    }

    const root = document.querySelector('.app-container:not(.tab-desktop)');
    if (!root) return null;

    const directChildren = Array.from(root.children);
    const findDirectChild = (className) => directChildren.find((child) => child.classList?.contains(className));
    const snapshotParts = [];

    const syncFormValues = (sourceNode, cloneNode) => {
      const sourceFields = sourceNode.querySelectorAll('input, textarea, select');
      const cloneFields = cloneNode.querySelectorAll('input, textarea, select');
      sourceFields.forEach((sourceField, index) => {
        const cloneField = cloneFields[index];
        if (!cloneField) return;

        if (sourceField instanceof HTMLTextAreaElement) {
          cloneField.textContent = sourceField.value;
          return;
        }

        if (sourceField instanceof HTMLSelectElement) {
          Array.from(sourceField.options).forEach((option, optionIndex) => {
            if (cloneField.options?.[optionIndex]) {
              cloneField.options[optionIndex].selected = option.selected;
            }
          });
          return;
        }

        if (sourceField instanceof HTMLInputElement) {
          if (sourceField.type === 'checkbox' || sourceField.type === 'radio') {
            if (sourceField.checked) {
              cloneField.setAttribute('checked', '');
            } else {
              cloneField.removeAttribute('checked');
            }
          } else {
            cloneField.setAttribute('value', sourceField.value);
          }
        }
      });
    };

    const setSnapshotStyle = (element, property, value) => {
      if (!element?.style || value == null || value === '') return;
      try {
        element.style.setProperty(property, value, 'important');
      } catch {
        // Some browser-specific computed properties are readonly or invalid to set.
      }
    };

    const replaceCloneWithStillMedia = (sourceElement, cloneElement) => {
      if (!cloneElement?.parentNode) return null;
      const createImageReplacement = (src) => {
        if (!src) return null;
        const image = document.createElement('img');
        image.src = src;
        image.alt = sourceElement.getAttribute?.('alt') || '';
        image.draggable = false;
        image.setAttribute('aria-hidden', 'true');
        image.className = cloneElement.className || sourceElement.className || '';
        image.style.cssText = cloneElement.style.cssText;
        cloneElement.parentNode.replaceChild(image, cloneElement);
        return image;
      };

      try {
        if (sourceElement instanceof HTMLCanvasElement && sourceElement.width && sourceElement.height) {
          return createImageReplacement(sourceElement.toDataURL('image/png'));
        }

        if (
          sourceElement instanceof HTMLVideoElement
          && sourceElement.readyState >= 2
          && sourceElement.videoWidth
          && sourceElement.videoHeight
        ) {
          const canvas = document.createElement('canvas');
          canvas.width = sourceElement.videoWidth;
          canvas.height = sourceElement.videoHeight;
          const context = canvas.getContext('2d');
          context?.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
          return createImageReplacement(canvas.toDataURL('image/png'));
        }
      } catch {
        return null;
      }

      return null;
    };

    const freezeComputedSnapshotStyles = (sourceNode, cloneNode) => {
      const sourceNodes = [sourceNode, ...sourceNode.querySelectorAll('*')];
      const cloneNodes = [cloneNode, ...cloneNode.querySelectorAll('*')];

      sourceNodes.forEach((sourceElement, index) => {
        const cloneElement = cloneNodes[index];
        if (!cloneElement || !(sourceElement instanceof Element) || !(cloneElement instanceof Element)) return;
        const computedStyle = window.getComputedStyle(sourceElement);

        if (computedStyle.display === 'none') {
          setSnapshotStyle(cloneElement, 'display', 'none');
          return;
        }
        if (computedStyle.visibility && computedStyle.visibility !== 'visible') {
          setSnapshotStyle(cloneElement, 'visibility', computedStyle.visibility);
        }
        if (computedStyle.opacity && computedStyle.opacity !== '1') {
          setSnapshotStyle(cloneElement, 'opacity', computedStyle.opacity);
        }
        if (computedStyle.transform && computedStyle.transform !== 'none') {
          setSnapshotStyle(cloneElement, 'transform', computedStyle.transform);
          setSnapshotStyle(cloneElement, 'transform-origin', computedStyle.transformOrigin);
        }
        if (computedStyle.filter && computedStyle.filter !== 'none') {
          setSnapshotStyle(cloneElement, 'filter', computedStyle.filter);
        }
        if (computedStyle.backdropFilter && computedStyle.backdropFilter !== 'none') {
          setSnapshotStyle(cloneElement, 'backdrop-filter', computedStyle.backdropFilter);
        }
        setSnapshotStyle(cloneElement, 'animation', 'none');
        setSnapshotStyle(cloneElement, 'animation-delay', '0s');
        setSnapshotStyle(cloneElement, 'animation-duration', '0s');
        setSnapshotStyle(cloneElement, 'transition', 'none');
        setSnapshotStyle(cloneElement, 'transition-delay', '0s');
        setSnapshotStyle(cloneElement, 'transition-duration', '0s');
        setSnapshotStyle(cloneElement, 'caret-color', 'transparent');
        setSnapshotStyle(cloneElement, 'scroll-behavior', 'auto');
        setSnapshotStyle(cloneElement, 'pointer-events', 'none');
        cloneElement.setAttribute('data-browser-photo-node', 'true');

        if ((sourceElement.scrollTop || sourceElement.scrollLeft) && cloneElement.children?.length) {
          const scrollLeft = Number(sourceElement.scrollLeft) || 0;
          const scrollTop = Number(sourceElement.scrollTop) || 0;
          cloneElement.setAttribute('data-browser-photo-scroll', 'true');
          setSnapshotStyle(cloneElement, 'overflow', 'hidden');
          Array.from(cloneElement.children).forEach((child) => {
            const childTransform = child.style?.getPropertyValue('transform');
            const scrollTransform = `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`;
            setSnapshotStyle(child, 'transform', childTransform && childTransform !== 'none'
              ? `${scrollTransform} ${childTransform}`
              : scrollTransform);
          });
        }

        replaceCloneWithStillMedia(sourceElement, cloneElement);
      });
    };

    const lockSnapshotPieceToWindow = (sourceNode, cloneNode, origin) => {
      const rect = sourceNode.getBoundingClientRect();
      cloneNode.setAttribute('data-browser-photo-piece', 'true');
      setSnapshotStyle(cloneNode, 'position', 'absolute');
      setSnapshotStyle(cloneNode, 'left', `${Math.round(rect.left - origin.left)}px`);
      setSnapshotStyle(cloneNode, 'top', `${Math.round(rect.top - origin.top)}px`);
      setSnapshotStyle(cloneNode, 'right', 'auto');
      setSnapshotStyle(cloneNode, 'bottom', 'auto');
      setSnapshotStyle(cloneNode, 'width', `${Math.round(rect.width)}px`);
      setSnapshotStyle(cloneNode, 'height', `${Math.round(rect.height)}px`);
      setSnapshotStyle(cloneNode, 'min-width', '0px');
      setSnapshotStyle(cloneNode, 'min-height', '0px');
      setSnapshotStyle(cloneNode, 'max-width', 'none');
      setSnapshotStyle(cloneNode, 'max-height', 'none');
      setSnapshotStyle(cloneNode, 'margin', '0px');
      setSnapshotStyle(cloneNode, 'transform', 'none');
      setSnapshotStyle(cloneNode, 'transform-origin', '0px 0px');
      setSnapshotStyle(cloneNode, 'box-sizing', 'border-box');
    };

    const cloneForSnapshot = (sourceNode, origin) => {
      if (!sourceNode) return null;
      const rect = sourceNode.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const clone = sourceNode.cloneNode(true);
      syncFormValues(sourceNode, clone);
      freezeComputedSnapshotStyles(sourceNode, clone);
      lockSnapshotPieceToWindow(sourceNode, clone, origin);
      clone.querySelectorAll('button, a, input, textarea, select, [tabindex]').forEach((node) => {
        node.setAttribute('tabindex', '-1');
      });
      return clone.outerHTML;
    };

    const chromeRect = findDirectChild('desktop-browser-chrome')?.getBoundingClientRect();
    const contentRect = findDirectChild('right-column')?.getBoundingClientRect()
      || findDirectChild('middle-column')?.getBoundingClientRect();
    const windowWidth = Math.max(320, Math.round(chromeRect?.width || contentRect?.width || 980));
    const chromeHeight = Math.max(78, Math.round(chromeRect?.height || DESKTOP_WINDOW_CHROME_HEIGHT));
    const contentHeight = Math.max(260, Math.round(contentRect?.height || 620));
    const windowHeight = chromeHeight + contentHeight;
    const origin = {
      left: Math.round(chromeRect?.left ?? contentRect?.left ?? 0),
      top: Math.round(chromeRect?.top ?? Math.max(0, (contentRect?.top || chromeHeight) - chromeHeight)),
    };

    [
      findDirectChild('desktop-browser-chrome'),
      findDirectChild('sidebar-nav'),
      findDirectChild('middle-column'),
      findDirectChild('right-column'),
    ].forEach((node) => {
      const html = cloneForSnapshot(node, origin);
      if (html) snapshotParts.push(html);
    });

    if (!snapshotParts.length) return null;

    const rootClassName = String(root.className || '')
      .split(/\s+/)
      .filter((className) => className && !['is-window-dragging', 'is-window-resizing', 'is-window-tab-dragging', 'is-window-merge-target'].includes(className))
      .concat('is-window-snapshot-frozen')
      .join(' ');
    const snapshotStyle = [
      'position:relative!important',
      'display:block!important',
      'padding:0!important',
      'overflow:hidden!important',
      'contain:layout paint style!important',
      'pointer-events:none!important',
      '--browser-window-x:0px',
      '--browser-window-y:0px',
      '--real-window-left:0px',
      '--real-window-top:0px',
      `--browser-window-width:${windowWidth}px`,
      `--browser-window-height:${windowHeight}px`,
      `--browser-window-content-height:${contentHeight}px`,
      `--real-window-width:${windowWidth}px`,
      `--real-window-height:${windowHeight}px`,
      `--real-window-content-height:${contentHeight}px`,
      `--desktop-browser-chrome-height:${chromeHeight}px`,
      `--snapshot-window-width:${windowWidth}px`,
      `--snapshot-window-height:${windowHeight}px`,
      `width:${windowWidth}px!important`,
      `height:${windowHeight}px!important`,
      'min-width:0!important',
      'min-height:0!important',
      'max-width:none!important',
      'max-height:none!important',
    ].join(';');

    return {
      snapshotHtml: `<div class="${rootClassName} desktop-browser-snapshot-app" data-browser-photo-snapshot="true" style="${snapshotStyle}" aria-hidden="true">${snapshotParts.join('')}</div>`,
      snapshotWidth: windowWidth,
      snapshotHeight: windowHeight,
      snapshotTab: activeTab,
      snapshotUpdatedAt: Date.now(),
    };
  }, [DESKTOP_WINDOW_CHROME_HEIGHT, activeBrowserWindowId, activeTab]);

const snapshotActiveBrowserWindow = useCallback(() => null, []);

const openDesktop = useCallback(() => {
    snapshotActiveBrowserWindow();
    setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
      {
        ...windowItem,
        activeTab: windowItem.id === activeBrowserWindowId && activeTab !== 'desktop'
          ? activeTab
          : windowItem.activeTab,
        minimized: true,
        maximized: windowItem.id === activeBrowserWindowId
          ? browserWindowMaximized
          : windowItem.maximized,
      }
    )));
    setActiveBrowserWindowId(null);
    setBrowserWindowMaximized(false);
    setActiveTab('desktop');
  }, [activeBrowserWindowId, activeTab, browserWindowMaximized, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindows, snapshotActiveBrowserWindow]);

const openBrowserApp = useCallback((tab) => {
    snapshotActiveBrowserWindow();
    const allowMultipleWindows = DESKTOP_MULTI_WINDOW_APP_TABS.has(tab);
    const currentBrowserWindows = browserWindowsRef.current || [];
    const reusableWindow = allowMultipleWindows
      ? null
      : currentBrowserWindows.find((windowItem) => (windowItem.tabs || []).includes(tab));

    if (reusableWindow) {
      const reusableTabIndex = Math.max(0, (reusableWindow.tabs || []).indexOf(tab));
      setBrowserWindows((currentWindows) => currentWindows.map((windowItem) => (
        windowItem.id === reusableWindow.id
          ? { ...windowItem, activeTab: tab, activeTabIndex: reusableTabIndex, minimized: false, snapshotHtml: null }
          : windowItem
      )));
      setActiveBrowserWindowId(reusableWindow.id);
      setBrowserWindowMaximized(Boolean(reusableWindow.maximized));
      setActiveTab(tab);
      if (tab === 'chats') {
        applyBrowserWindowSocialState(reusableWindow);
      }
      setBrowserWindowRecallPulse({ windowId: reusableWindow.id, token: Date.now() });
      return { reused: true, windowId: reusableWindow.id };
    }

    const sequence = browserWindowSeqRef.current++;
    const targetWindowId = `browser-window-${sequence}`;
    const geometry = getDefaultBrowserWindowGeometry(sequence);
    const shouldOpenMaximized = Boolean(activeBrowserWindowId && activeTab !== 'desktop' && browserWindowMaximized);
    const newWindow = {
      id: targetWindowId,
      tabs: [tab],
      activeTab: tab,
      activeTabIndex: 0,
      minimized: false,
      maximized: shouldOpenMaximized,
      snapshotHtml: null,
      tabSnapshots: {},
      social: tab === 'chats'
        ? normalizeBrowserWindowSocialState({
          activeContactId: activeContactId || contacts[0]?.id || null,
          activeGroupId: activeGroupId,
          activeDrawer: activeDrawer,
        })
        : undefined,
      ...geometry,
    };

    setBrowserWindows((currentWindows) => ([
      ...currentWindows.filter((windowItem) => windowItem.id !== targetWindowId),
      newWindow,
    ]));

    setActiveBrowserWindowId(targetWindowId);
    setBrowserWindowMaximized(shouldOpenMaximized);
    setActiveTab(tab);
    return { created: true, windowId: targetWindowId };
  }, [DESKTOP_MULTI_WINDOW_APP_TABS, activeBrowserWindowId, activeContactId, activeDrawer, activeGroupId, activeTab, applyBrowserWindowSocialState, browserWindowMaximized, browserWindowSeqRef, browserWindowsRef, contacts, getDefaultBrowserWindowGeometry, normalizeBrowserWindowSocialState, setActiveBrowserWindowId, setActiveTab, setBrowserWindowMaximized, setBrowserWindowRecallPulse, setBrowserWindows, snapshotActiveBrowserWindow]);

const openSocialApp = useCallback(() => {
    const openResult = openBrowserApp('chats');
    if (openResult?.reused) {
      setActiveDrawer(null);
      return;
    }
    setActiveGroupId(null);
    activeGroupRef.current = null;
    const firstContact = contacts[0] || null;
    setActiveContactId(firstContact?.id || null);
    setActiveContactSnapshot(firstContact);
    activeContactRef.current = firstContact?.id || null;
    setActiveDrawer(null);
  }, [activeContactRef, activeGroupRef, contacts, openBrowserApp, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId]);

const openSimpleTabApp = useCallback((tab) => {
    openBrowserApp(tab);
    setActiveContactId(null);
    setActiveContactSnapshot(null);
    activeContactRef.current = null;
    setActiveGroupId(null);
    activeGroupRef.current = null;
    setActiveDrawer(null);
  }, [activeContactRef, activeGroupRef, openBrowserApp, setActiveContactId, setActiveContactSnapshot, setActiveDrawer, setActiveGroupId]);

useEffect(() => {
    if (!browserWindowRecallPulse || typeof window === 'undefined') return undefined;
    const timerId = window.setTimeout(() => {
      setBrowserWindowRecallPulse((current) => (
        current?.token === browserWindowRecallPulse.token ? null : current
      ));
    }, 940);
    return () => window.clearTimeout(timerId);
  }, [browserWindowRecallPulse, setBrowserWindowRecallPulse]);
    return { normalizeBrowserWindowSocialState, applyBrowserWindowSocialState, updateBrowserWindowSocialState, buildActiveBrowserWindowSnapshot, snapshotActiveBrowserWindow, openDesktop, openBrowserApp, openSocialApp, openSimpleTabApp };
}
