import { useEffect } from 'react';
import { useEventCallback } from '../../../../shared/hooks/useEventCallback.js';
import { commercialV2BehaviorNearbyCooldownMs, commercialV2BehaviorAutonomousCooldownMs } from '../behaviorTreeCore.js';

// One timer per mounted scene; the callback reads the latest committed scene state.
export function useAutonomousBehavior({ canRun, nearby, cooldownRef, pickBranch, activateBranch, setStatus }) {
    const tick = useEventCallback(() => {
        if (!canRun() || Date.now() < cooldownRef.current) return;
        const branch = pickBranch({ nearby });
        if (!branch) return;
        cooldownRef.current =
            Date.now() + (nearby ? commercialV2BehaviorNearbyCooldownMs : commercialV2BehaviorAutonomousCooldownMs);
        activateBranch(branch, 'base');
        setStatus(`日常行为自动执行：${branch.title}`);
    });
    useEffect(() => {
        const timer = window.setInterval(tick, 700);
        return () => window.clearInterval(timer);
    }, [tick]);
}
