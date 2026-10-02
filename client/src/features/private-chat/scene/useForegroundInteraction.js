import { useEffect } from 'react';

export function useForegroundInteraction(dependencies) {
const { normalizeForegroundPersonPosition, privateChatForegroundPersonKeysRef, privateChatForegroundPersonLastSaveRef, privateChatForegroundPersonPositionRef, savePrivateChatForegroundPersonPosition, setPrivateChatForegroundPersonPosition, shouldEnableForegroundPersonControl } = dependencies;
useEffect(() => {
    if (!shouldEnableForegroundPersonControl) return undefined;

    const moveByKey = {
      w: true,
      a: true,
      s: true,
      d: true,
    };

    let animationFrameId = 0;
    let lastTickAt = performance.now();
    let lastFrameAt = lastTickAt;
    let walkFrame = privateChatForegroundPersonPositionRef.current.frame || 0;
    const personCollisionSize = { width: 64 * 1.8, height: 80 * 1.8 };
    const decorCollisionTargets = [
      {
        selector: '.private-chat-scene-decor__left',
        inset: { top: 34, right: 22, bottom: 8, left: 20 },
      },
      {
        selector: '.private-chat-scene-decor__right',
        inset: { top: 26, right: 18, bottom: 6, left: 22 },
      },
    ];

    const intersectsRect = (a, b) => (
      a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top
    );

    const getControllingForegroundRoot = () => {
      const roots = Array.from(document.querySelectorAll('.app-container.tab-chats.has-private-chat.is-private-chat-scene.is-foreground-lifted'));
      if (!roots.length) return null;
      return roots.find(root => !root.classList.contains('desktop-browser-live-window'))
        || roots[roots.length - 1]
        || null;
    };

    const getPersonCollisionRect = (position) => {
      const lane = getControllingForegroundRoot()?.querySelector('.private-chat-pet-lane');
      if (!lane) return null;
      const laneRect = lane.getBoundingClientRect();
      const centerX = laneRect.left + (laneRect.width / 2) + position.x;
      const bottom = laneRect.bottom + position.y;
      return {
        left: centerX - (personCollisionSize.width / 2),
        right: centerX + (personCollisionSize.width / 2),
        top: bottom - personCollisionSize.height,
        bottom,
      };
    };

    const getDecorCollisionRects = () => decorCollisionTargets
      .map(({ selector, inset }) => {
        const element = getControllingForegroundRoot()?.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
          left: rect.left + inset.left,
          right: rect.right - inset.right,
          top: rect.top + inset.top,
          bottom: rect.bottom - inset.bottom,
        };
      })
      .filter(Boolean);

    const collidesWithDecor = (position, decorRects) => {
      const personRect = getPersonCollisionRect(position);
      if (!personRect) return false;
      return decorRects.some((decorRect) => intersectsRect(personRect, decorRect));
    };

    const resolveDecorCollision = (previous, desired) => {
      const decorRects = getDecorCollisionRects();
      if (!collidesWithDecor(desired, decorRects)) return desired;

      const xOnly = normalizeForegroundPersonPosition({
        ...desired,
        y: previous.y,
      });
      if (!collidesWithDecor(xOnly, decorRects)) return xOnly;

      const yOnly = normalizeForegroundPersonPosition({
        ...desired,
        x: previous.x,
      });
      if (!collidesWithDecor(yOnly, decorRects)) return yOnly;

      return normalizeForegroundPersonPosition({
        ...previous,
        direction: desired.direction,
        frame: desired.frame,
      });
    };

    const shouldIgnoreKeyTarget = (target) => {
      const tagName = target?.tagName?.toLowerCase();
      return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    };

    const nudgeForegroundPersonForKeyPress = (event) => {
      const keys = privateChatForegroundPersonKeysRef.current;
      let deltaX = 0;
      let deltaY = 0;
      if (keys.has('a')) deltaX -= 1;
      if (keys.has('d')) deltaX += 1;
      if (keys.has('w')) deltaY -= 1;
      if (keys.has('s')) deltaY += 1;
      if (deltaX === 0 && deltaY === 0) return;

      const length = Math.hypot(deltaX, deltaY) || 1;
      const speed = keys.has('shift') || event.shiftKey ? 320 : 190;
      const direction = deltaX < 0
        ? 'left'
        : deltaX > 0
          ? 'right'
          : deltaY < 0
            ? 'back'
            : 'front';
      walkFrame = (walkFrame + 1) % 4;
      lastFrameAt = performance.now();

      const previous = privateChatForegroundPersonPositionRef.current;
      const desired = normalizeForegroundPersonPosition({
        x: previous.x + (deltaX / length) * speed * 0.075,
        y: previous.y + (deltaY / length) * speed * 0.075,
        direction,
        frame: walkFrame,
      });
      const next = resolveDecorCollision(previous, desired);
      privateChatForegroundPersonPositionRef.current = next;
      setPrivateChatForegroundPersonPosition(next);
      savePrivateChatForegroundPersonPosition(next);
      privateChatForegroundPersonLastSaveRef.current = performance.now();
    };

    const normalizeMoveKey = (event) => {
      const key = String(event.key || '').toLowerCase();
      if (moveByKey[key] || key === 'shift') return key;
      const code = String(event.code || '').toLowerCase();
      if (code.startsWith('key')) {
        const codeKey = code.slice(3);
        if (moveByKey[codeKey]) return codeKey;
      }
      return key;
    };

    const updatePressedKey = (event, pressed) => {
      const key = normalizeMoveKey(event);
      if (key === 'shift') {
        if (pressed) {
          privateChatForegroundPersonKeysRef.current.add('shift');
        } else {
          privateChatForegroundPersonKeysRef.current.delete('shift');
        }
        return;
      }

      if (!moveByKey[key]) return;
      if (shouldIgnoreKeyTarget(event.target)) return;

      event.preventDefault();
      if (pressed) {
        const wasPressed = privateChatForegroundPersonKeysRef.current.has(key);
        privateChatForegroundPersonKeysRef.current.add(key);
        if (!wasPressed) {
          nudgeForegroundPersonForKeyPress(event);
        }
      } else {
        privateChatForegroundPersonKeysRef.current.delete(key);
      }
    };

    const animateForegroundPerson = (now) => {
      const keys = privateChatForegroundPersonKeysRef.current;
      const elapsedSeconds = Math.min((now - lastTickAt) / 1000, 0.05);
      lastTickAt = now;

      let deltaX = 0;
      let deltaY = 0;
      if (keys.has('a')) deltaX -= 1;
      if (keys.has('d')) deltaX += 1;
      if (keys.has('w')) deltaY -= 1;
      if (keys.has('s')) deltaY += 1;

      const isMoving = deltaX !== 0 || deltaY !== 0;
      if (isMoving) {
        const length = Math.hypot(deltaX, deltaY) || 1;
        const speed = keys.has('shift') ? 320 : 190;
        const direction = deltaX < 0
          ? 'left'
          : deltaX > 0
            ? 'right'
            : deltaY < 0
              ? 'back'
              : 'front';

        if (now - lastFrameAt >= 90) {
          walkFrame = (walkFrame + 1) % 4;
          lastFrameAt = now;
        }

        const previous = privateChatForegroundPersonPositionRef.current;
        const desired = normalizeForegroundPersonPosition({
          x: previous.x + (deltaX / length) * speed * elapsedSeconds,
          y: previous.y + (deltaY / length) * speed * elapsedSeconds,
          direction,
          frame: walkFrame,
        });
        const next = resolveDecorCollision(previous, desired);
        privateChatForegroundPersonPositionRef.current = next;
        setPrivateChatForegroundPersonPosition(next);

        if (now - privateChatForegroundPersonLastSaveRef.current >= 180) {
          savePrivateChatForegroundPersonPosition(next);
          privateChatForegroundPersonLastSaveRef.current = now;
        }
      } else if (privateChatForegroundPersonPositionRef.current.frame !== 0) {
        const next = normalizeForegroundPersonPosition({
          ...privateChatForegroundPersonPositionRef.current,
          frame: 0,
        });
        privateChatForegroundPersonPositionRef.current = next;
        setPrivateChatForegroundPersonPosition(next);
        savePrivateChatForegroundPersonPosition(next);
      }

      animationFrameId = window.requestAnimationFrame(animateForegroundPerson);
    };

    const pressedKeys = privateChatForegroundPersonKeysRef.current;
    const handleKeyDown = (event) => updatePressedKey(event, true);
    const handleKeyUp = (event) => updatePressedKey(event, false);

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    animationFrameId = window.requestAnimationFrame(animateForegroundPerson);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.cancelAnimationFrame(animationFrameId);
      pressedKeys.clear();
      savePrivateChatForegroundPersonPosition(privateChatForegroundPersonPositionRef.current);
    };
  }, [normalizeForegroundPersonPosition, privateChatForegroundPersonKeysRef, privateChatForegroundPersonLastSaveRef, privateChatForegroundPersonPositionRef, savePrivateChatForegroundPersonPosition, setPrivateChatForegroundPersonPosition, shouldEnableForegroundPersonControl]);
    return {  };
}
