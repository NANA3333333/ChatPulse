export const PRIVATE_CHAT_FOREGROUND_ENABLED_STORAGE_KEY = 'chatpulse:private-chat-foreground-enabled';

export const PRIVATE_CHAT_FOREGROUND_EXIT_MS = 960;

export const PRIVATE_CHAT_DECOR_STORAGE_KEY = 'chatpulse:private-chat-decor-adjustments:v8';

export const PRIVATE_CHAT_DECOR_EDITOR_STORAGE_KEY = 'chatpulse:private-chat-decor-editor-open';

export const PRIVATE_CHAT_FOREGROUND_PERSON_STORAGE_KEY = 'chatpulse:private-chat-foreground-person:v1';

export const PRIVATE_CHAT_FOREGROUND_PERSON_DEFAULT = { x: 0, y: 0, direction: 'front', frame: 0 };

export const PRIVATE_CHAT_FOREGROUND_PERSON_SPRITES = {
  front: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/front_walk_step_b.png?v=20260702',
  ],
  back: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/back_walk_step_b.png?v=20260702',
  ],
  left: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/left_walk_step_b.png?v=20260702',
  ],
  right: [
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_idle.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_step_a.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_passing.png?v=20260702',
    '/assets/pixel-world/characters/casual-boy-v1/frames-64x80/right_walk_step_b.png?v=20260702',
  ],
};

export const PRIVATE_CHAT_DECOR_DEFAULTS = {
  floor: { x: 28, y: 94, scale: 1.18 },
  left: { x: 12, y: 11, scale: 0.91 },
  right: { x: -7, y: 32, scale: 0.79 },
};

export const PRIVATE_CHAT_DECOR_TARGETS = [
  { id: 'floor', label: '地板', labelEn: 'Floor', selector: '[data-private-decor-id="floor"]' },
  { id: 'left', label: '左素材', labelEn: 'Left Decor', selector: '[data-private-decor-id="left"]' },
  { id: 'right', label: '右素材', labelEn: 'Right Decor', selector: '[data-private-decor-id="right"]' },
];
