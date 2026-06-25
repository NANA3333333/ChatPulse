const commercialV2BehaviorConfigStorageKey = 'pixelWorld.commercialStreetV2.behaviorTreeConfig';
const commercialV2BehaviorTreeStorageKey = 'pixelWorld.commercialStreetV2.behaviorTreeState';
const commercialV2BehaviorInteractionDistance = 170;
const commercialV2BehaviorInteractionSessionIdleMs = 180000;
const commercialV2BehaviorAutonomousInitialDelayMs = 1600;
const commercialV2BehaviorAutonomousCooldownMs = 6200;
const commercialV2BehaviorNearbyCooldownMs = 3000;
const commercialV2BehaviorBaseWaitMs = 550;
const commercialV2BehaviorBaseFallbackMs = 550;
const commercialV2BehaviorGenerationTimeoutMs = 0;
const commercialV2BehaviorBaseGenerationTimeoutMs = commercialV2BehaviorGenerationTimeoutMs;
const commercialV2BehaviorContextDefaultQ = 8;
const commercialV2BehaviorContextDefaultP = 12;
const commercialV2BehaviorContextMinQ = 1;
const commercialV2BehaviorContextMaxQ = 30;
const commercialV2BehaviorContextMinP = 2;
const commercialV2BehaviorContextMaxP = 50;
const commercialV2BehaviorPatchHistoryLimit = 120;
const commercialV2BehaviorIterationRecordLimit = 120;
const commercialV2BehaviorActions = [
  { id: 'greet', label: '打招呼', hint: '让角色停下来看向玩家' },
  { id: 'small_talk', label: '闲聊', hint: '从当前场景近况切入' },
  { id: 'ask_current_action', label: '在干嘛', hint: '询问角色当前意图' },
  { id: 'ask_destination', label: '去哪儿', hint: '追问下一步目的地' },
  { id: 'suggest_destination', label: '跟我来', hint: '玩家指定一个可用地点或锚点' },
  { id: 'request_company', label: '陪我一下', hint: '触发陪伴/同行行为' },
  { id: 'treat_food', label: '请你吃', hint: '触发去餐饮点和好感变化' },
  { id: 'request_help', label: '帮我一下', hint: '生成帮忙/跑腿回应' },
  { id: 'joke', label: '开玩笑', hint: '触发轻松反应' },
  { id: 'comfort', label: '安慰我', hint: '触发近距离安抚' }
];
const commercialV2BehaviorActionIds = new Set(commercialV2BehaviorActions.map((action) => action.id));
const commercialV2BehaviorPrimaryActionIds = ['greet', 'small_talk', 'ask_current_action', 'ask_destination'];
const commercialV2BehaviorContextActionIds = ['suggest_destination', 'request_company', 'treat_food', 'request_help', 'joke', 'comfort'];
const commercialV2BehaviorImportantPlaceIds = new Set([
  'hacker',
  'casino',
  'school_factory',
  'home_exit',
  'agency',
  'convenience',
  'restaurant',
  'hospital'
]);
const commercialV2BehaviorMovementActions = [
  { id: 'go_to_place', label: '前往地点', needs: ['place_id'], description: '走到某个表内地点附近。' },
  { id: 'wander_between', label: '两点间闲逛', needs: ['from_place_id', 'to_place_id'], description: '在两个表内地点之间来回平移。' },
  { id: 'loop_in_front_of', label: '地点前循环', needs: ['place_id'], description: '在某个表内地点前面小范围左右移动。' },
  { id: 'browse_near', label: '附近浏览', needs: ['place_id'], description: '靠近某个表内地点，停停走走。' },
  { id: 'patrol_segment', label: '街段巡逻', needs: ['from_place_id', 'to_place_id'], description: '在两个表内地点之间巡逻式移动。' },
  { id: 'approach_player', label: '靠近玩家', needs: [], description: '靠近玩家并面对玩家。' },
  { id: 'follow_player', label: '跟随玩家', needs: [], description: '跟随玩家，保持一小段距离。' },
  { id: 'walk_with_player', label: '陪玩家走', needs: ['to_place_id?'], description: '和玩家一起向某个表内地点走，地点可选。' },
  { id: 'idle_at_place', label: '地点停留', needs: ['place_id'], description: '在某个表内地点附近站立、等待、转向或说话。' }
];
const commercialV2BehaviorLivelyActionIds = new Set([
  ...commercialV2BehaviorMovementActions.map((action) => action.id),
  'face_player'
]);
const commercialV2BehaviorSpecialNodeIds = [
  'player_interaction'
];
const commercialV2BehaviorTravelFailureTrigger = 'runtime_state.travel_failed';
const commercialV2BehaviorBaseNodeIds = [
  'movement_recovery',
  'hard_needs',
  'routine_goal',
  'place_affordance',
  'background_mood',
  'curiosity',
  'wander',
  'idle_micro'
];
const commercialV2BehaviorRootNodeIds = [
  ...commercialV2BehaviorSpecialNodeIds,
  ...commercialV2BehaviorBaseNodeIds
];
const commercialV2BehaviorAutonomousNodeIds = [
  'base_needs_cafe_snack',
  'base_needs_home_rest',
  'base_routine_home_agency',
  'base_routine_sign_check',
  'base_wander_convenience_cafe',
  'base_loop_cafe_front',
  'base_patrol_agency_shop',
  'base_affordance_agency_window',
  'base_affordance_cafe_pause',
  'base_background_walk_cafe',
  'base_background_slow_down',
  'base_curiosity_player_glance',
  'base_curiosity_window_watch',
  'base_idle_watch_street',
  'base_idle_turn_pause'
];
const commercialV2BehaviorNearbyAutonomousNodeIds = [
  'base_curiosity_player_glance',
  'base_idle_watch_street',
  'base_loop_cafe_front',
  'base_affordance_agency_window',
  'base_wander_convenience_cafe'
];
const commercialV2BehaviorDefaultBaseActionNodeIds = [
  'base_travel_blocked_recover',
  'base_needs_cafe_snack',
  'base_needs_home_rest',
  'base_routine_home_agency',
  'base_routine_sign_check',
  'base_affordance_agency_window',
  'base_affordance_cafe_pause',
  'base_background_walk_cafe',
  'base_background_slow_down',
  'base_curiosity_player_glance',
  'base_curiosity_window_watch',
  'base_wander_convenience_cafe',
  'base_loop_cafe_front',
  'base_patrol_agency_shop',
  'base_idle_watch_street',
  'base_idle_turn_pause'
];
const commercialV2BehaviorLastDemoBranch = {
  branch_id: 'greet_flustered_cafe_20260530',
  title: '咖啡馆前被Nana打招呼，慌乱回应',
  priority: 90,
  ttl_ms: 45000,
  trigger: {
    player_action: 'greet',
    place_id: 'restaurant'
  },
  summary: '昨晚那张照片之后第一次在现实里碰面，脑子还没准备好怎么面对她，被打招呼的瞬间整个人僵了一下。',
  steps: [
    { action: 'go_to_place', place_id: 'restaurant', movement_style: 'hesitating' },
    { action: 'emote', text: '脚步顿了一下，视线闪躲' },
    { action: 'face_player' },
    { action: 'wait', duration_ms: 1200 },
    { action: 'say', text: '……你怎么在这。' },
    { action: 'emote', text: '耳尖微红，把手插进口袋里' },
    { action: 'say', text: '昨晚……算了，没事。吃了吗。' },
    { action: 'idle_at_place', place_id: 'restaurant', movement_style: 'slow' },
    {
      action: 'offer_choices',
      choices: [
        { id: 'sit_down', label: '一起进去坐坐？', trigger: 'request_company' },
        { id: 'ask_photo', label: '昨晚那个……', trigger: 'small_talk' },
        { id: 'leave_quietly', label: '不打扰你了', trigger: 'comfort' },
        { id: 'treat_coffee', label: '请你喝咖啡', trigger: 'treat_food' }
      ]
    }
  ]
};
function createCommercialV2PresetInteractionBranch(actionId, placeId = 'restaurant', placeLabel = '街区', options = {}) {
  const safeActionId = commercialV2BehaviorActionIds.has(actionId) ? actionId : 'greet';
  const targetPlaceId = String(placeId || 'restaurant');
  const targetPlaceLabel = String(placeLabel || '街区');
  const sceneType = String(options.sceneType || '').trim().toLowerCase();
  const isRoomScene = sceneType === 'room'
    || targetPlaceId.startsWith('room-anchor:')
    || targetPlaceId.startsWith('room-point:');
  const smallTalkTitle = isRoomScene ? '预设互动：房间闲聊' : '预设互动：街边闲聊';
  const smallTalkSummary = isRoomScene
    ? '玩家在房间里发起闲聊，角色用当前小屋的气氛接住话题。'
    : '玩家发起闲聊，角色用街区当前气氛接住话题。';
  const smallTalkOpening = isRoomScene
    ? '房间里安静得有点明显，刚好适合说会儿话。'
    : '今天这条街有点吵，但还挺适合闲逛。';
  const smallTalkEmote = isRoomScene
    ? `往${targetPlaceLabel}那边看了一眼，又把注意力放回你身上`
    : '往街边看了一眼，又把注意力放回你身上';
  const askSceneLabel = isRoomScene ? '问房间情况' : '问街上情况';
  const companyLine = isRoomScene ? '行。我陪你待一会儿。' : '行。我陪你走一段。';
  const sitTogetherLabel = isRoomScene ? '在这里坐一下' : '去坐一下';
  const commonChoices = [
    { id: 'ask_more', label: '继续问他', trigger: 'small_talk', place_id: targetPlaceId },
    { id: 'walk_together', label: '一起走走', trigger: 'request_company', place_id: targetPlaceId },
    { id: 'tease_lightly', label: '逗他一下', trigger: 'joke', place_id: targetPlaceId },
    { id: 'comfort_softly', label: '认真回应', trigger: 'comfort', place_id: targetPlaceId }
  ];
  const templates = {
    greet: {
      title: '预设互动：靠近打招呼',
      summary: '玩家靠近角色并打招呼，角色先给一个短回应，再等待玩家选择后续。',
      steps: [
        { action: 'face_player' },
        { action: 'emote', text: '停下脚步，抬眼看向你' },
        { action: 'say', text: '你来了。刚刚一直在这附近吗？' },
        { action: 'offer_choices', text: '你要怎么接话？', choices: commonChoices }
      ]
    },
    small_talk: {
      title: smallTalkTitle,
      summary: smallTalkSummary,
      steps: [
        { action: 'face_player' },
        { action: 'say', text: smallTalkOpening },
        { action: 'emote', text: smallTalkEmote },
        { action: 'offer_choices', text: '你想聊什么？', choices: [
          { id: 'ask_scene', label: askSceneLabel, trigger: 'ask_current_action', place_id: targetPlaceId },
          { id: 'ask_mood', label: '问他心情', trigger: 'small_talk', place_id: targetPlaceId },
          { id: 'invite_walk', label: '边走边聊', trigger: 'request_company', place_id: targetPlaceId },
          { id: 'joke_back', label: '开个玩笑', trigger: 'joke', place_id: targetPlaceId }
        ] }
      ]
    },
    ask_current_action: {
      title: '预设互动：问他在干嘛',
      summary: '玩家询问角色当前行动，角色先解释自己正在做什么。',
      steps: [
        { action: 'face_player' },
        { action: 'say', text: '没什么特别的，在把今天要做的事排一下。' },
        { action: 'say', text: `刚好走到${targetPlaceLabel}附近，就顺路看看。` },
        { action: 'offer_choices', text: '你要怎么继续？', choices: [
          { id: 'ask_detail', label: '追问细节', trigger: 'ask_current_action', place_id: targetPlaceId },
          { id: 'help_him', label: '说我帮你', trigger: 'request_help', place_id: targetPlaceId },
          { id: 'go_elsewhere', label: '叫他换地方', trigger: 'suggest_destination', place_id: targetPlaceId },
          { id: 'stay_with_him', label: '陪他一会儿', trigger: 'request_company', place_id: targetPlaceId }
        ] }
      ]
    },
    ask_destination: {
      title: '预设互动：问他去哪儿',
      summary: '玩家追问角色下一步目的地，角色先给一个模糊回答。',
      steps: [
        { action: 'face_player' },
        { action: 'say', text: `可能去${targetPlaceLabel}，也可能只是路过。` },
        { action: 'emote', text: '像是在等你决定要不要一起走' },
        { action: 'offer_choices', text: '你要怎么决定？', choices: [
          { id: 'lead_place', label: `带他去${targetPlaceLabel}`, trigger: 'suggest_destination', place_id: targetPlaceId },
          { id: 'walk_with_me', label: '让他陪你走', trigger: 'request_company', place_id: targetPlaceId },
          { id: 'ask_reason', label: '问为什么去', trigger: 'small_talk', place_id: targetPlaceId },
          { id: 'tease_direction', label: '故意逗他', trigger: 'joke', place_id: targetPlaceId }
        ] }
      ]
    },
    suggest_destination: {
      title: '预设互动：玩家提出目的地',
      summary: '玩家邀请角色去指定地点，角色先判断要不要跟上。',
      steps: [
        { action: 'face_player' },
        { action: 'say', text: `去${targetPlaceLabel}？可以，但你别走太快。` },
        { action: 'walk_with_player', to_place_id: targetPlaceId, movement_style: 'walk_together' },
        { action: 'offer_choices', text: '到了附近以后，你要做什么？', choices: [
          { id: 'ask_arrived', label: '问他感觉', trigger: 'small_talk', place_id: targetPlaceId },
          { id: 'ask_help', label: '请他帮忙', trigger: 'request_help', place_id: targetPlaceId },
          { id: 'treat_here', label: '说请他吃点', trigger: 'treat_food', place_id: targetPlaceId },
          { id: 'keep_walking', label: '继续一起走', trigger: 'request_company', place_id: targetPlaceId }
        ] }
      ]
    },
    request_company: {
      title: '预设互动：请求陪伴',
      summary: '玩家想让角色陪自己一会儿，角色先靠近并回应。',
      steps: [
        { action: 'approach_player', movement_style: 'soft' },
        { action: 'face_player' },
        { action: 'say', text: companyLine },
        { action: 'offer_choices', text: '你想怎么和他相处？', choices: [
          { id: 'walk_quietly', label: '安静走一会儿', trigger: 'request_company', place_id: targetPlaceId },
          { id: 'say_worry', label: '说有点累', trigger: 'comfort', place_id: targetPlaceId },
          { id: 'ask_plan', label: '问他的计划', trigger: 'ask_current_action', place_id: targetPlaceId },
          { id: 'sit_together', label: sitTogetherLabel, trigger: 'treat_food', place_id: targetPlaceId }
        ] }
      ]
    },
    treat_food: {
      title: '预设互动：玩家请吃东西',
      summary: '玩家提出请角色吃东西，角色先接住好意。',
      steps: [
        { action: 'face_player' },
        { action: 'say', text: '你请？那我可记住了。' },
        { action: 'walk_with_player', to_place_id: targetPlaceId || 'restaurant', movement_style: 'walk_together' },
        { action: 'offer_choices', text: '你要怎么继续？', choices: [
          { id: 'order_food', label: '让他点单', trigger: 'treat_food', place_id: targetPlaceId || 'restaurant' },
          { id: 'ask_preference', label: '问他想吃什么', trigger: 'small_talk', place_id: targetPlaceId || 'restaurant' },
          { id: 'tease_debt', label: '说他欠你一次', trigger: 'joke', place_id: targetPlaceId || 'restaurant' },
          { id: 'sit_together', label: '坐下聊聊', trigger: 'request_company', place_id: targetPlaceId || 'restaurant' }
        ] }
      ]
    },
    request_help: {
      title: '预设互动：请求帮忙',
      summary: '玩家请角色帮忙，角色先确认事情大小。',
      steps: [
        { action: 'face_player' },
        { action: 'say', text: '帮忙可以。先说清楚，别又只告诉我一半。' },
        { action: 'emote', text: '嘴上嫌麻烦，但已经往你这边站近了点' },
        { action: 'offer_choices', text: '你要他帮什么？', choices: [
          { id: 'small_errand', label: '跑个小腿', trigger: 'request_help', place_id: targetPlaceId },
          { id: 'go_together', label: '一起过去', trigger: 'suggest_destination', place_id: targetPlaceId },
          { id: 'need_comfort', label: '其实想被安慰', trigger: 'comfort', place_id: targetPlaceId },
          { id: 'make_joke', label: '故意说得很严重', trigger: 'joke', place_id: targetPlaceId }
        ] }
      ]
    },
    joke: {
      title: '预设互动：开玩笑',
      summary: '玩家开玩笑试探角色反应，角色先吐槽再接梗。',
      steps: [
        { action: 'face_player' },
        { action: 'emote', text: '愣了一下，然后忍不住笑了' },
        { action: 'say', text: '你这个笑话很危险，差一点就不好笑了。' },
        { action: 'offer_choices', text: '你要怎么接梗？', choices: [
          { id: 'joke_more', label: '继续逗他', trigger: 'joke', place_id: targetPlaceId },
          { id: 'turn_serious', label: '突然认真', trigger: 'comfort', place_id: targetPlaceId },
          { id: 'invite_walk', label: '边走边闹', trigger: 'request_company', place_id: targetPlaceId },
          { id: 'ask_reaction', label: '问他笑什么', trigger: 'small_talk', place_id: targetPlaceId }
        ] }
      ]
    },
    comfort: {
      title: '预设互动：请求安慰',
      summary: '玩家想被安慰，角色先停下来认真回应。',
      steps: [
        { action: 'approach_player', movement_style: 'gentle' },
        { action: 'face_player' },
        { action: 'say', text: '先别急着硬撑。你说，我听着。' },
        { action: 'offer_choices', text: '你要怎么回应他？', choices: [
          { id: 'tell_truth', label: '说实话', trigger: 'comfort', place_id: targetPlaceId },
          { id: 'ask_company', label: '让他陪你', trigger: 'request_company', place_id: targetPlaceId },
          { id: 'change_topic', label: '换个轻松话题', trigger: 'small_talk', place_id: targetPlaceId },
          { id: 'pretend_ok', label: '假装没事', trigger: 'joke', place_id: targetPlaceId }
        ] }
      ]
    }
  };
  const branch = templates[safeActionId] || templates.greet;
  return {
    branch_id: `preset_${safeActionId}_${targetPlaceId}`,
    title: branch.title,
    priority: 88,
    ttl_ms: 60000,
    trigger: {
      player_action: safeActionId,
      place_id: targetPlaceId
    },
    summary: branch.summary,
    steps: branch.steps,
    branch_kind: 'special'
  };
}
const commercialV2BehaviorDefaultConfig = {
  api_endpoint: '',
  api_key: '',
  model_name: '',
  context_q_limit: commercialV2BehaviorContextDefaultQ,
  context_summary_threshold: commercialV2BehaviorContextDefaultP
};

async function fetchBehaviorJsonWithTimeout(url, options = {}, timeoutMs = 18000) {
  const hasTimeout = Number(timeoutMs) > 0;
  const controller = hasTimeout ? new AbortController() : null;
  const timeoutId = hasTimeout ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {})
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

function formatBehaviorRequestError(error, fallback = '请求失败，请重试。') {
  if (error?.name === 'AbortError') return '请求超时，请重试。';
  return error?.message || fallback;
}

function getBehaviorAuthHeaders() {
  const token = localStorage.getItem('cp_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : ''
  };
}

function formatBehaviorJson(value, fallback = '{}') {
  try {
    return JSON.stringify(value || JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

function normalizeBehaviorPlaceLookupText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_:：,，.。;；!?！？()（）[\]【】"'“”‘’、/\\]+/g, '');
}

function resolveBehaviorChoicePlaceIdFromPlaces(choice = {}, triggerAction = '', behaviorPlaces = [], fallbackPlaceOptions = []) {
  const explicitPlaceId = String(choice?.place_id || choice?.placeId || choice?.to_place_id || choice?.toPlaceId || '').trim();
  if (explicitPlaceId) return explicitPlaceId;
  if (triggerAction !== 'suggest_destination') return '';
  const searchText = normalizeBehaviorPlaceLookupText([
    choice?.label,
    choice?.text,
    choice?.title,
    choice?.place_label,
    choice?.placeLabel,
    choice?.target_label,
    choice?.targetLabel
  ].filter(Boolean).join(' '));
  if (!searchText) return '';
  const keywordHints = ['梳妆台', '床头柜', '书架', '书桌', '挂画', '地毯', '沙发', '衣柜', '床', '画', '灯', '柜', '桌', '椅', '镜'];
  let best = null;
  const places = Array.isArray(behaviorPlaces) && behaviorPlaces.length
    ? behaviorPlaces
    : (Array.isArray(fallbackPlaceOptions) ? fallbackPlaceOptions : []).map((option) => ({
      placeId: option?.placeId || option?.id,
      locationId: option?.locationId,
      name: option?.name || option?.label,
      label: option?.label,
      kind: option?.kind,
      aliases: Array.isArray(option?.aliases) ? option.aliases : []
    }));
  places.filter(Boolean).forEach((place) => {
    const candidates = [
      place.placeId,
      place.locationId,
      place.name,
      place.label,
      place.kind,
      ...(Array.isArray(place.aliases) ? place.aliases : [])
    ].map(normalizeBehaviorPlaceLookupText).filter((value) => value.length >= 2);
    let score = 0;
    candidates.forEach((candidate) => {
      if (searchText.includes(candidate) || candidate.includes(searchText)) score = Math.max(score, 100 + Math.min(candidate.length, 40));
      keywordHints.forEach((keyword) => {
        const key = normalizeBehaviorPlaceLookupText(keyword);
        if (searchText.includes(key) && candidate.includes(key)) score = Math.max(score, 40 + key.length);
      });
    });
    if (score > 0 && (!best || score > best.score)) {
      best = { id: place.placeId || place.id || place.locationId, score };
    }
  });
  return best?.id || '';
}

function resolveBehaviorChoiceTrigger(choice = {}) {
  return [
    choice?.trigger,
    choice?.action_id,
    choice?.actionId,
    choice?.next_action,
    choice?.nextAction,
    choice?.player_action,
    choice?.playerAction,
    choice?.id,
    choice?.action
  ]
    .map((value) => String(value || '').trim())
    .find((value) => commercialV2BehaviorActionIds.has(value)) || '';
}

function normalizeBehaviorDialogChoices(choices) {
  if (!Array.isArray(choices)) return [];
  return choices.slice(0, 4).map((choice, index) => {
    if (typeof choice === 'string') {
      const label = choice.trim();
      const trigger = commercialV2BehaviorActionIds.has(label) ? label : '';
      return label && trigger ? { id: trigger, label, trigger } : null;
    }
    if (!choice || typeof choice !== 'object') return null;
    const label = String(choice.label || choice.text || choice.title || `选项 ${index + 1}`).trim();
    const trigger = resolveBehaviorChoiceTrigger(choice);
    if (!trigger) return null;
    return {
      ...choice,
      id: String(choice.id || trigger || `choice_${index + 1}`),
      label: label || `选项 ${index + 1}`,
      trigger
    };
  }).filter(Boolean);
}

function summarizeBehaviorPlaceForPayload(place) {
  if (!place) return null;
  return {
    order: place.order || 0,
    id: place.placeId,
    location_id: place.locationId,
    location_ids: place.locationIds || [],
    label: place.name,
    kind: place.kind,
    actions: place.actions || [],
    aliases: place.aliases || []
  };
}

function buildBehaviorTreePayloadSummary(behaviorTreeState, behaviorConfig, defaultTreeId = 'street_runtime_single_character') {
  const nodes = behaviorTreeState?.nodes || {};
  const compactNodes = {};
  const patchHistory = Array.isArray(behaviorTreeState?.patch_history) ? behaviorTreeState.patch_history : [];
  const contextConfig = buildCommercialBehaviorContextConfig(behaviorConfig);
  const iterationRecords = buildCommercialBehaviorIterationRecords(behaviorTreeState);
  const iterationState = readCommercialBehaviorIterationState(behaviorTreeState);
  const contextStats = buildCommercialBehaviorContextStats(behaviorTreeState, behaviorConfig);
  const readableNodeIds = new Set(iterationRecords
    .slice(-contextConfig.q_raw_limit)
    .map((record) => String(record.node_id || '').trim())
    .filter(Boolean));
  const iteratedNodeIds = new Set(iterationRecords
    .map((record) => String(record.node_id || '').trim())
    .filter(Boolean));
  const prioritizedNodeIds = [
    behaviorTreeState?.active_node_id,
    ...Array.from(readableNodeIds).reverse(),
    ...patchHistory.slice(0, contextConfig.q_raw_limit).map((item) => item?.node_id || item?.nodeId || item?.next_active_node_id || item?.nextActiveNodeId)
  ].map((id) => String(id || '').trim()).filter(Boolean);
  const orderedEntries = [];
  const seenNodeIds = new Set();
  function pushBehaviorNode(id) {
    if (!id || seenNodeIds.has(id) || !nodes[id]) return;
    seenNodeIds.add(id);
    orderedEntries.push([id, nodes[id]]);
  }
  prioritizedNodeIds.forEach(pushBehaviorNode);
  Object.keys(nodes).forEach((id) => {
    if (iteratedNodeIds.has(id) && !readableNodeIds.has(id)) return;
    pushBehaviorNode(id);
  });
  orderedEntries.slice(0, 60).forEach(([id, node]) => {
    const childIds = Array.isArray(node.children_ids) ? node.children_ids : [];
    compactNodes[id] = {
      id: node.id || id,
      type: node.type || 'Node',
      title: node.title || '',
      priority: node.priority,
      trigger: node.trigger,
      children_ids: childIds
        .filter((childId) => !iteratedNodeIds.has(childId) || readableNodeIds.has(childId))
        .slice(0, 12),
      summary: node.summary || '',
      steps: Array.isArray(node.steps) ? node.steps.slice(0, 10) : undefined,
      branch_kind: node.branch_kind || node.branchKind || '',
      source: node.source || ''
    };
  });
  return {
    tree_id: behaviorTreeState?.tree_id || defaultTreeId,
    schema: behaviorTreeState?.schema || 'full_behavior_tree_patch_v1',
    version: behaviorTreeState?.version || 1,
    root_id: behaviorTreeState?.root_id || 'street_character_root',
    active_node_id: behaviorTreeState?.active_node_id || '',
    nodes: compactNodes,
    memory: behaviorTreeState?.memory || {},
    patch_history: patchHistory.slice(0, contextConfig.q_raw_limit),
    iteration_context: {
      config: contextConfig,
      summaries: Array.isArray(iterationState.summaries) ? iterationState.summaries.slice(-3) : [],
      summary_cursor_record_id: iterationState.summary_cursor_record_id || '',
      stats: contextStats,
      records: iterationRecords
    }
  };
}

function normalizeCommercialBehaviorContextLimit(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}
function normalizeCommercialBehaviorConfig(raw = {}) {
  return {
    ...commercialV2BehaviorDefaultConfig,
    api_endpoint: String(raw.api_endpoint || ''),
    api_key: String(raw.api_key || ''),
    model_name: String(raw.model_name || ''),
    context_q_limit: normalizeCommercialBehaviorContextLimit(
      raw.context_q_limit ?? raw.behavior_context_q ?? raw.q_raw_limit,
      commercialV2BehaviorContextDefaultQ,
      commercialV2BehaviorContextMinQ,
      commercialV2BehaviorContextMaxQ
    ),
    context_summary_threshold: normalizeCommercialBehaviorContextLimit(
      raw.context_summary_threshold ?? raw.behavior_context_p ?? raw.p_summary_threshold,
      commercialV2BehaviorContextDefaultP,
      commercialV2BehaviorContextMinP,
      commercialV2BehaviorContextMaxP
    )
  };
}

function readStoredCommercialBehaviorConfig() {
  if (typeof localStorage === 'undefined') return commercialV2BehaviorDefaultConfig;
  try {
    const raw = localStorage.getItem(commercialV2BehaviorConfigStorageKey);
    if (!raw) return commercialV2BehaviorDefaultConfig;
    const parsed = JSON.parse(raw);
    return normalizeCommercialBehaviorConfig(parsed);
  } catch {
    localStorage.removeItem(commercialV2BehaviorConfigStorageKey);
    return commercialV2BehaviorDefaultConfig;
  }
}

function createCommercialV2BehaviorTreeState() {
  const nodes = {
    street_character_root: {
      id: 'street_character_root',
      type: 'PrioritySelector',
      title: '街区角色根节点',
      children_ids: commercialV2BehaviorRootNodeIds
    },
    player_interaction: {
      id: 'player_interaction',
      type: 'Selector',
      title: '玩家互动回应池',
      branch_kind: 'special',
      priority: 100,
      trigger: 'player_event.active',
      summary: '玩家靠近、点击互动、选择回应后，AI 只局部更新这里的后续互动回应。',
      children_ids: []
    },
    movement_recovery: {
      id: 'movement_recovery',
      type: 'Selector',
      title: '移动恢复行为组',
      branch_kind: 'base',
      priority: 88,
      trigger: commercialV2BehaviorTravelFailureTrigger,
      summary: '小人移动目标不可达、路径被挡住或循迹失败时，先执行这里的恢复反应。',
      children_ids: ['base_travel_blocked_recover']
    },
    base_travel_blocked_recover: {
      id: 'base_travel_blocked_recover',
      type: 'ActionSequence',
      title: '基础：循迹失败后停下确认',
      branch_kind: 'base',
      priority: 88,
      trigger: commercialV2BehaviorTravelFailureTrigger,
      summary: '角色遇到移动失败时停下来确认路线，用短反应承接失败状态。',
      ttl_ms: 12000,
      steps: [
        { action: 'emote', text: '脚步顿了一下，像是在重新判断路线', duration_ms: 1200 },
        { action: 'say', text: '这边好像过不去，先换个办法。', duration_ms: 1600 },
        { action: 'wait', duration_ms: 900 }
      ]
    },
    hard_needs: {
      id: 'hard_needs',
      type: 'Selector',
      title: '硬需求行为组',
      branch_kind: 'base',
      priority: 82,
      trigger: 'runtime_state.need_high',
      summary: '无互动时，角色根据饥饿、精力、压力等状态选择自己的行动。',
      children_ids: ['base_needs_cafe_snack', 'base_needs_home_rest']
    },
    routine_goal: {
      id: 'routine_goal',
      type: 'Selector',
      title: '本地例行行为组',
      branch_kind: 'base',
      priority: 76,
      trigger: 'runtime_state.routine_tick',
      summary: '无互动时，角色按本地默认节奏活动；不由私聊或商业街活动触发。',
      children_ids: ['base_routine_home_agency', 'base_routine_sign_check']
    },
    place_affordance: {
      id: 'place_affordance',
      type: 'Selector',
      title: '地点能力行为组',
      branch_kind: 'base',
      priority: 68,
      trigger: 'location.has_affordance',
      summary: '无互动时，角色会利用附近建筑能力，例如看房源、买东西、在咖啡馆停留。',
      children_ids: ['base_affordance_agency_window', 'base_affordance_cafe_pause']
    },
    background_mood: {
      id: 'background_mood',
      type: 'Selector',
      title: '背景情绪行为组',
      branch_kind: 'base',
      priority: 60,
      trigger: 'runtime_state.mood_idle',
      summary: 'AI 上文只影响语气/轻微情绪，不因私聊或商业街活动触发移动。',
      children_ids: ['base_background_walk_cafe', 'base_background_slow_down']
    },
    curiosity: {
      id: 'curiosity',
      type: 'Selector',
      title: '好奇心行为组',
      branch_kind: 'base',
      priority: 52,
      trigger: 'nearby_place_or_player',
      summary: '无互动时，角色偶尔看向玩家或看向建筑，但不直接进入对话。',
      children_ids: ['base_curiosity_player_glance', 'base_curiosity_window_watch']
    },
    wander: {
      id: 'wander',
      type: 'Selector',
      title: '自由活动行为组',
      branch_kind: 'base',
      priority: 36,
      trigger: 'otherwise',
      summary: '无互动时的默认街区移动循环。',
      children_ids: ['base_wander_convenience_cafe', 'base_loop_cafe_front', 'base_patrol_agency_shop']
    },
    idle_micro: {
      id: 'idle_micro',
      type: 'Selector',
      title: '微动作行为组',
      branch_kind: 'base',
      priority: 20,
      trigger: 'idle',
      summary: '没有更强目标时，角色做轻量停留，不打断玩家。',
      children_ids: ['base_idle_watch_street', 'base_idle_turn_pause']
    },
    base_needs_cafe_snack: {
      id: 'base_needs_cafe_snack',
      type: 'ActionSequence',
      title: '基础：去咖啡馆补一点能量',
      branch_kind: 'base',
      priority: 82,
      trigger: 'runtime_state.hunger_or_low_energy',
      summary: '角色无互动时，如果状态偏低，会慢慢挪到咖啡馆附近停一会儿。',
      ttl_ms: 38000,
      steps: [
        { action: 'go_to_place', place_id: 'restaurant', movement_style: 'slow' },
        { action: 'say', text: '先买点热的，脑子才转得动。', duration_ms: 1600 },
        { action: 'idle_at_place', place_id: 'restaurant', movement_style: 'resting' },
        { action: 'emote', text: '低头闻了闻咖啡香气', duration_ms: 1400 },
        { action: 'wait', duration_ms: 1800 }
      ]
    },
    base_needs_home_rest: {
      id: 'base_needs_home_rest',
      type: 'ActionSequence',
      title: '基础：回公寓门口缓一下',
      branch_kind: 'base',
      priority: 80,
      trigger: 'runtime_state.energy_low',
      summary: '角色无互动时，精力低会回公寓住宅附近短暂停留。',
      ttl_ms: 36000,
      steps: [
        { action: 'go_to_place', place_id: 'home_exit', movement_style: 'tired' },
        { action: 'say', text: '回门口站一会儿就好。', duration_ms: 1500 },
        { action: 'idle_at_place', place_id: 'home_exit', movement_style: 'quiet' },
        { action: 'emote', text: '肩膀松下来一点', duration_ms: 1300 },
        { action: 'wait', duration_ms: 1500 }
      ]
    },
    base_routine_home_agency: {
      id: 'base_routine_home_agency',
      type: 'ActionSequence',
      title: '基础：从公寓走到中介所',
      branch_kind: 'base',
      priority: 76,
      trigger: 'runtime_state.routine_tick',
      summary: '角色无互动时，按本地默认节奏在公寓住宅和房产中介所之间移动。',
      ttl_ms: 42000,
      steps: [
        { action: 'go_to_place', place_id: 'home_exit', movement_style: 'normal' },
        { action: 'emote', text: '确认了一下随身小包', duration_ms: 1200 },
        { action: 'wait', duration_ms: 800 },
        { action: 'go_to_place', place_id: 'agency', movement_style: 'normal' },
        { action: 'say', text: '看看今天窗上有没有新东西。', duration_ms: 1600 },
        { action: 'idle_at_place', place_id: 'agency', movement_style: 'checking' }
      ]
    },
    base_routine_sign_check: {
      id: 'base_routine_sign_check',
      type: 'ActionSequence',
      title: '基础：看一眼街边招牌',
      branch_kind: 'base',
      priority: 74,
      trigger: 'runtime_state.routine_tick',
      summary: '角色无互动时，会靠近便利店或中介附近看招牌，不读取商业街活动公告。',
      ttl_ms: 38000,
      steps: [
        { action: 'browse_near', place_id: 'convenience', movement_style: 'checking_notice' },
        { action: 'say', text: '这个牌子是不是换过位置？', duration_ms: 1600 },
        { action: 'wait', duration_ms: 1400 },
        { action: 'idle_at_place', place_id: 'convenience', movement_style: 'thinking' }
      ]
    },
    base_affordance_agency_window: {
      id: 'base_affordance_agency_window',
      type: 'ActionSequence',
      title: '基础：在中介所前看橱窗',
      branch_kind: 'base',
      priority: 68,
      trigger: 'location.affordance.agency',
      summary: '角色无互动时，会在房产中介所前停停走走。',
      ttl_ms: 40000,
      steps: [
        { action: 'browse_near', place_id: 'agency', movement_style: 'window_shopping' },
        { action: 'say', text: '这套采光好像还行。', duration_ms: 1500 },
        { action: 'wait', duration_ms: 1200 },
        { action: 'emote', text: '指尖在橱窗前轻轻停了一下', duration_ms: 1400 },
        { action: 'loop_in_front_of', place_id: 'agency', movement_style: 'small_loop' }
      ]
    },
    base_affordance_cafe_pause: {
      id: 'base_affordance_cafe_pause',
      type: 'ActionSequence',
      title: '基础：咖啡馆门口停顿',
      branch_kind: 'base',
      priority: 66,
      trigger: 'location.affordance.restaurant',
      summary: '角色无互动时，会在咖啡馆附近停顿，像是在犹豫要不要进去。',
      ttl_ms: 38000,
      steps: [
        { action: 'browse_near', place_id: 'restaurant', movement_style: 'hesitating' },
        { action: 'say', text: '进去坐一下……还是算了。', duration_ms: 1700 },
        { action: 'wait', duration_ms: 1400 },
        { action: 'idle_at_place', place_id: 'restaurant', movement_style: 'slow' }
      ]
    },
    base_background_walk_cafe: {
      id: 'base_background_walk_cafe',
      type: 'ActionSequence',
      title: '基础：心情放慢到咖啡馆',
      branch_kind: 'base',
      priority: 60,
      trigger: 'runtime_state.mood_idle',
      summary: '角色无互动时，根据轻量情绪在咖啡馆附近慢下来；不由私聊或商业街活动触发。',
      ttl_ms: 38000,
      steps: [
        { action: 'go_to_place', place_id: 'restaurant', movement_style: 'distracted' },
        { action: 'emote', text: '走着走着忽然慢了下来', duration_ms: 1400 },
        { action: 'wait', duration_ms: 1300 },
        { action: 'say', text: '今天街上有点安静。', duration_ms: 1500 },
        { action: 'idle_at_place', place_id: 'restaurant', movement_style: 'quiet' }
      ]
    },
    base_background_slow_down: {
      id: 'base_background_slow_down',
      type: 'ActionSequence',
      title: '基础：路过时慢下来',
      branch_kind: 'base',
      priority: 58,
      trigger: 'runtime_state.mood_idle',
      summary: '角色无互动时，轻量情绪会表现为走位节奏变化。',
      ttl_ms: 36000,
      steps: [
        { action: 'patrol_segment', from_place_id: 'agency', to_place_id: 'restaurant', movement_style: 'slow' },
        { action: 'say', text: '慢慢走也不错。', duration_ms: 1400 },
        { action: 'wait', duration_ms: 1200 },
        { action: 'patrol_segment', from_place_id: 'restaurant', to_place_id: 'agency', movement_style: 'slow' }
      ]
    },
    base_curiosity_player_glance: {
      id: 'base_curiosity_player_glance',
      type: 'ActionSequence',
      title: '基础：注意到玩家但不打断',
      branch_kind: 'base',
      priority: 52,
      trigger: 'nearby_player.no_interaction',
      summary: '角色无互动时，靠近玩家一点点，但不弹正式对话。',
      ttl_ms: 30000,
      steps: [
        { action: 'approach_player', movement_style: 'curious' },
        { action: 'face_player' },
        { action: 'emote', text: '看了你一眼，又假装在看路', duration_ms: 1600 },
        { action: 'wait', duration_ms: 900 }
      ]
    },
    base_curiosity_window_watch: {
      id: 'base_curiosity_window_watch',
      type: 'ActionSequence',
      title: '基础：看看橱窗和路人',
      branch_kind: 'base',
      priority: 50,
      trigger: 'nearby_place',
      summary: '角色无互动时，随机在当前街段附近停顿。',
      ttl_ms: 34000,
      steps: [
        { action: 'browse_near', place_id: 'convenience', movement_style: 'look_around' },
        { action: 'say', text: '便利店灯总是这么亮。', duration_ms: 1500 },
        { action: 'wait', duration_ms: 1100 },
        { action: 'idle_at_place', place_id: 'convenience', movement_style: 'watching' }
      ]
    },
    base_wander_convenience_cafe: {
      id: 'base_wander_convenience_cafe',
      type: 'ActionSequence',
      title: '基础：便利店和咖啡馆之间闲逛',
      branch_kind: 'base',
      priority: 36,
      trigger: 'otherwise',
      summary: '角色无互动时的默认平移闲逛路线。',
      ttl_ms: 42000,
      steps: [
        { action: 'wander_between', from_place_id: 'convenience', to_place_id: 'restaurant', movement_style: 'window_shopping' },
        { action: 'say', text: '从这边走过去刚好。', duration_ms: 1400 },
        { action: 'wait', duration_ms: 1100 },
        { action: 'wander_between', from_place_id: 'restaurant', to_place_id: 'convenience', movement_style: 'window_shopping' },
        { action: 'emote', text: '回头看了一眼咖啡馆门口', duration_ms: 1300 },
        { action: 'wait', duration_ms: 900 }
      ]
    },
    base_loop_cafe_front: {
      id: 'base_loop_cafe_front',
      type: 'ActionSequence',
      title: '基础：咖啡馆门前小循环',
      branch_kind: 'base',
      priority: 34,
      trigger: 'otherwise',
      summary: '角色无互动时在咖啡馆前小范围活动。',
      ttl_ms: 36000,
      steps: [
        { action: 'loop_in_front_of', place_id: 'restaurant', movement_style: 'small_loop' },
        { action: 'say', text: '菜单换了吗？', duration_ms: 1300 },
        { action: 'wait', duration_ms: 900 },
        { action: 'browse_near', place_id: 'restaurant', movement_style: 'slow' }
      ]
    },
    base_patrol_agency_shop: {
      id: 'base_patrol_agency_shop',
      type: 'ActionSequence',
      title: '基础：中介所到便利店巡街',
      branch_kind: 'base',
      priority: 32,
      trigger: 'otherwise',
      summary: '角色无互动时在中介所和便利店之间来回移动。',
      ttl_ms: 42000,
      steps: [
        { action: 'patrol_segment', from_place_id: 'agency', to_place_id: 'convenience', movement_style: 'patrol' },
        { action: 'emote', text: '像是在给自己找个理由散步', duration_ms: 1500 },
        { action: 'wait', duration_ms: 900 },
        { action: 'patrol_segment', from_place_id: 'convenience', to_place_id: 'agency', movement_style: 'patrol' }
      ]
    },
    base_idle_watch_street: {
      id: 'base_idle_watch_street',
      type: 'ActionSequence',
      title: '基础：站在街边看人流',
      branch_kind: 'base',
      priority: 20,
      trigger: 'idle',
      summary: '角色无互动时短暂停留，不主动开启对话。',
      ttl_ms: 26000,
      steps: [
        { action: 'idle_at_place', place_id: 'agency', movement_style: 'watching' },
        { action: 'say', text: '人来人往的。', duration_ms: 1300 },
        { action: 'wait', duration_ms: 1500 }
      ]
    },
    base_idle_turn_pause: {
      id: 'base_idle_turn_pause',
      type: 'ActionSequence',
      title: '基础：短暂停顿转向',
      branch_kind: 'base',
      priority: 18,
      trigger: 'idle',
      summary: '角色无互动时做极轻的站立变化。',
      ttl_ms: 22000,
      steps: [
        { action: 'idle_at_place', place_id: 'convenience', movement_style: 'idle' },
        { action: 'emote', text: '轻轻换了个站姿', duration_ms: 1200 },
        { action: 'wait', duration_ms: 1200 }
      ]
    }
  };
  return {
    tree_id: 'street_runtime_single_character',
    schema: 'full_behavior_tree_patch_v1',
    version: 1,
    root_id: 'street_character_root',
    active_node_id: '',
    nodes,
    memory: {},
    patch_history: []
  };
}

function createCommercialBehaviorTreeRebuildState(currentTree = null, defaultTreeId = 'street_runtime_single_character') {
  const fallback = createCommercialV2BehaviorTreeState();
  const current = currentTree && typeof currentTree === 'object' ? currentTree : {};
  const nodes = { ...fallback.nodes };
  nodes.player_interaction = {
    ...nodes.player_interaction,
    children_ids: []
  };
  commercialV2BehaviorBaseNodeIds.forEach((nodeId) => {
    nodes[nodeId] = {
      ...nodes[nodeId],
      children_ids: []
    };
  });
  return {
    ...fallback,
    tree_id: defaultTreeId || current.tree_id || fallback.tree_id,
    schema: current.schema || fallback.schema,
    version: 1,
    root_id: current.root_id || fallback.root_id,
    active_node_id: '',
    nodes,
    memory: {},
    patch_history: []
  };
}

function normalizeCommercialBehaviorNodeId(value, fallback = 'node') {
  const raw = String(value || '').trim().slice(0, 80);
  const safe = raw
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || `${fallback}_${Date.now().toString(36)}`;
}
function isCommercialBehaviorAiSource(source = '') {
  return String(source || '').startsWith('ai');
}
function buildCommercialBehaviorOwnerMeta(characterId = '', character = null) {
  const ownerCharacterId = String(characterId || character?.id || '').trim();
  if (!ownerCharacterId) return {};
  const ownerCharacterName = String(character?.name || character?.label || ownerCharacterId).trim().slice(0, 80);
  return {
    owner_character_id: ownerCharacterId,
    owner_character_name: ownerCharacterName
  };
}

function readStoredCommercialBehaviorTreeState() {
  const fallback = createCommercialV2BehaviorTreeState();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(commercialV2BehaviorTreeStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const nodes = {
      ...fallback.nodes,
      ...(parsed.nodes || {})
    };
    delete nodes.temporary_ai_branch;
    delete nodes.city_agent_goal;
    delete nodes.memory_echo;
    delete nodes.base_schedule_home_agency;
    delete nodes.base_schedule_notice_check;
    delete nodes.base_memory_walk_cafe;
    delete nodes.base_memory_slow_down;
    nodes.street_character_root = {
      ...fallback.nodes.street_character_root,
      ...(nodes.street_character_root || {}),
      children_ids: commercialV2BehaviorRootNodeIds
    };
    nodes.player_interaction = {
      ...fallback.nodes.player_interaction,
      ...(nodes.player_interaction || {}),
      title: '玩家互动回应池',
      branch_kind: 'special',
      trigger: 'player_event.active'
    };
    commercialV2BehaviorBaseNodeIds.forEach((nodeId) => {
      const storedChildren = Array.isArray(nodes[nodeId]?.children_ids)
        ? nodes[nodeId].children_ids
        : null;
      nodes[nodeId] = {
        ...fallback.nodes[nodeId],
        ...(nodes[nodeId] || {}),
        branch_kind: 'base',
        children_ids: storedChildren || fallback.nodes[nodeId]?.children_ids || []
      };
    });
    commercialV2BehaviorDefaultBaseActionNodeIds.forEach((nodeId) => {
      nodes[nodeId] = fallback.nodes[nodeId];
    });
    return {
      ...fallback,
      ...parsed,
      root_id: 'street_character_root',
      nodes,
      memory: parsed.memory && typeof parsed.memory === 'object' ? parsed.memory : {},
      patch_history: Array.isArray(parsed.patch_history) ? parsed.patch_history.slice(0, commercialV2BehaviorPatchHistoryLimit) : []
    };
  } catch {
    localStorage.removeItem(commercialV2BehaviorTreeStorageKey);
    return fallback;
  }
}

function readStoredRoomBehaviorTreeState(storageKey, maxStorageBytes = 500000) {
  const fallback = createCommercialV2BehaviorTreeState();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    if (raw.length > maxStorageBytes) {
      localStorage.removeItem(storageKey);
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const nodes = {
      ...fallback.nodes,
      ...(parsed.nodes || {})
    };
    nodes.street_character_root = {
      ...fallback.nodes.street_character_root,
      ...(nodes.street_character_root || {}),
      children_ids: commercialV2BehaviorRootNodeIds
    };
    nodes.player_interaction = {
      ...fallback.nodes.player_interaction,
      ...(nodes.player_interaction || {}),
      title: '玩家互动回应池',
      branch_kind: 'special',
      trigger: 'player_event.active'
    };
    commercialV2BehaviorBaseNodeIds.forEach((nodeId) => {
      const storedChildren = Array.isArray(nodes[nodeId]?.children_ids)
        ? nodes[nodeId].children_ids
        : null;
      nodes[nodeId] = {
        ...fallback.nodes[nodeId],
        ...(nodes[nodeId] || {}),
        branch_kind: 'base',
        children_ids: storedChildren || fallback.nodes[nodeId]?.children_ids || []
      };
    });
    return {
      ...fallback,
      ...parsed,
      tree_id: parsed.tree_id || 'room_runtime_single_character',
      root_id: 'street_character_root',
      nodes,
      memory: parsed.memory && typeof parsed.memory === 'object' ? parsed.memory : {},
      patch_history: Array.isArray(parsed.patch_history) ? parsed.patch_history.slice(0, commercialV2BehaviorPatchHistoryLimit) : []
    };
  } catch {
    localStorage.removeItem(storageKey);
    return fallback;
  }
}

function buildCommercialBehaviorSourceOwnerMeta(source = '', characterId = '', character = null) {
  return isCommercialBehaviorAiSource(source)
    ? buildCommercialBehaviorOwnerMeta(characterId, character)
    : {};
}
function mergeCommercialBehaviorOwnerMemoryDelta(memoryDelta = {}, ownerMeta = {}) {
  if (!ownerMeta?.owner_character_id) return memoryDelta || {};
  return {
    ...(memoryDelta || {}),
    behavior_owner_character_id: ownerMeta.owner_character_id,
    behavior_owner_character_name: ownerMeta.owner_character_name || ownerMeta.owner_character_id
  };
}
function commercialBehaviorBranchMatchesOwner(branch = {}, characterId = '') {
  const ownerCharacterId = String(branch?.owner_character_id || branch?.ownerCharacterId || '').trim();
  return !ownerCharacterId || ownerCharacterId === String(characterId || '').trim();
}
function createCommercialBehaviorPatchFromBranch(branch, source = 'manual', patchMeta = {}) {
  if (!branch || typeof branch !== 'object') return null;
  const branchId = normalizeCommercialBehaviorNodeId(branch.branch_id || branch.id || patchMeta.node_id, 'branch');
  const targetNodeId = normalizeCommercialBehaviorNodeId(patchMeta.target_node_id || patchMeta.targetNodeId || 'player_interaction', 'target');
  const ownerCharacterId = String(patchMeta.owner_character_id || patchMeta.ownerCharacterId || branch.owner_character_id || branch.ownerCharacterId || '').trim();
  const ownerCharacterName = String(patchMeta.owner_character_name || patchMeta.ownerCharacterName || branch.owner_character_name || branch.ownerCharacterName || '').trim().slice(0, 80);
  const node = {
    id: branchId,
    type: 'ActionSequence',
    title: String(branch.title || '行为').slice(0, 80),
    priority: Number(branch.priority) || 90,
    trigger: branch.trigger || {},
    summary: String(branch.summary || '').slice(0, 180),
    ttl_ms: Number(branch.ttl_ms || branch.ttlMs) || 45000,
    steps: Array.isArray(branch.steps) ? branch.steps : [],
    branch_kind: branch.branch_kind || branch.branchKind || (targetNodeId === 'player_interaction' ? 'special' : 'base'),
    source
  };
  if (ownerCharacterId) {
    node.owner_character_id = ownerCharacterId;
    node.owner_character_name = ownerCharacterName || ownerCharacterId;
  }
  return {
    patch_id: normalizeCommercialBehaviorNodeId(patchMeta.patch_id || `patch_${branchId}_${Date.now().toString(36)}`, 'patch'),
    source,
    operation: 'upsert_child',
    target_node_id: targetNodeId,
    next_active_node_id: branchId,
    reason: String(patchMeta.reason || branch.summary || '').slice(0, 180),
    node,
    memory_delta: patchMeta.memory_delta || patchMeta.memoryDelta || {}
  };
}
function normalizeCommercialBehaviorPatch(rawPatch, fallbackBranch = null, source = 'ai') {
  const patch = rawPatch && typeof rawPatch === 'object' ? rawPatch : null;
  const rawNode = patch?.node && typeof patch.node === 'object' ? patch.node : null;
  const branchLike = rawNode?.steps ? rawNode : (fallbackBranch || patch?.branch || null);
  if (!branchLike) return null;
  const branch = {
    branch_id: branchLike.branch_id || branchLike.id || patch?.next_active_node_id || patch?.nextActiveNodeId,
    title: branchLike.title,
    priority: branchLike.priority,
    ttl_ms: branchLike.ttl_ms || branchLike.ttlMs,
    trigger: branchLike.trigger,
    summary: branchLike.summary,
    steps: branchLike.steps,
    branch_kind: branchLike.branch_kind || branchLike.branchKind,
    owner_character_id: branchLike.owner_character_id || branchLike.ownerCharacterId || rawNode?.owner_character_id || rawNode?.ownerCharacterId,
    owner_character_name: branchLike.owner_character_name || branchLike.ownerCharacterName || rawNode?.owner_character_name || rawNode?.ownerCharacterName
  };
  const normalized = createCommercialBehaviorPatchFromBranch(branch, source, {
    patch_id: patch?.patch_id || patch?.patchId,
    target_node_id: patch?.target_node_id || patch?.targetNodeId,
    reason: patch?.reason,
    memory_delta: patch?.memory_delta || patch?.memoryDelta,
    owner_character_id: patch?.owner_character_id || patch?.ownerCharacterId || branch.owner_character_id,
    owner_character_name: patch?.owner_character_name || patch?.ownerCharacterName || branch.owner_character_name
  });
  if (!normalized) return null;
  normalized.operation = patch?.operation || 'upsert_child';
  normalized.next_active_node_id = normalizeCommercialBehaviorNodeId(
    patch?.next_active_node_id || patch?.nextActiveNodeId || normalized.next_active_node_id,
    'active'
  );
  normalized.node.id = normalizeCommercialBehaviorNodeId(rawNode?.id || rawNode?.node_id || normalized.node.id, 'node');
  if (normalized.next_active_node_id !== normalized.node.id && !patch?.next_active_node_id && !patch?.nextActiveNodeId) {
    normalized.next_active_node_id = normalized.node.id;
  }
  return normalized;
}
function applyCommercialBehaviorTreePatch(treeState, rawPatch) {
  const patch = normalizeCommercialBehaviorPatch(rawPatch, rawPatch?.branch, rawPatch?.source || 'manual');
  if (!patch?.node?.steps?.length) return { tree: treeState || createCommercialV2BehaviorTreeState(), patch: null, activeBranch: null };
  const currentTree = treeState && typeof treeState === 'object' ? treeState : createCommercialV2BehaviorTreeState();
  const nodes = {
    ...createCommercialV2BehaviorTreeState().nodes,
    ...(currentTree.nodes || {})
  };
  const targetNodeId = nodes[patch.target_node_id] ? patch.target_node_id : 'player_interaction';
  const targetNode = nodes[targetNodeId] || { id: targetNodeId, type: 'Selector', children_ids: [] };
  const branchKind = patch.node.branch_kind || patch.node.branchKind || (targetNodeId === 'player_interaction' ? 'special' : 'base');
  nodes[patch.node.id] = {
    ...(nodes[patch.node.id] || {}),
    ...patch.node,
    id: patch.node.id,
    branch_kind: branchKind
  };
  const nextChildren = [
    patch.node.id,
    ...(Array.isArray(targetNode.children_ids) ? targetNode.children_ids : []).filter((id) => id !== patch.node.id)
  ].slice(0, 12);
  nodes[targetNodeId] = {
    ...targetNode,
    children_ids: nextChildren
  };
  const previousIterationSequence = Number(
    currentTree.memory?.behavior_iteration_sequence
    || currentTree.memory?.behaviorIterationSequence
    || currentTree.patch_history?.[0]?.sequence
    || 0
  ) || 0;
  const nextBehaviorIterationSequence = previousIterationSequence + 1;
  const historyItem = {
    patch_id: patch.patch_id,
    sequence: nextBehaviorIterationSequence,
    source: patch.source,
    operation: patch.operation,
    target_node_id: targetNodeId,
    node_id: patch.node.id,
    title: patch.node.title,
    created_at: new Date().toISOString(),
    reason: patch.reason || '',
    owner_character_id: patch.node.owner_character_id || '',
    owner_character_name: patch.node.owner_character_name || ''
  };
  const nextTree = {
    ...currentTree,
    schema: 'full_behavior_tree_patch_v1',
    version: (Number(currentTree.version) || 1) + 1,
    root_id: currentTree.root_id || 'street_character_root',
    active_node_id: patch.next_active_node_id || patch.node.id,
    nodes,
    memory: {
      ...(currentTree.memory || {}),
      ...(patch.memory_delta || {}),
      last_patch_id: patch.patch_id,
      last_active_node_id: patch.next_active_node_id || patch.node.id,
      behavior_iteration_sequence: nextBehaviorIterationSequence
    },
    patch_history: [historyItem, ...((currentTree.patch_history || []).filter((item) => item.patch_id !== patch.patch_id))].slice(0, commercialV2BehaviorPatchHistoryLimit)
  };
  return {
    tree: nextTree,
    patch,
    activeBranch: {
      branch_id: patch.node.id,
      title: patch.node.title,
      priority: patch.node.priority,
      ttl_ms: patch.node.ttl_ms,
      trigger: patch.node.trigger || {},
      summary: patch.node.summary || '',
      steps: patch.node.steps || [],
      branch_kind: branchKind,
      owner_character_id: patch.node.owner_character_id || '',
      owner_character_name: patch.node.owner_character_name || ''
    }
  };
}

function mergeCommercialBehaviorTreePatchForRuntime(currentTree, rawPatch, fallbackBranch = null, source = 'manual', characterId = '', character = null) {
  const ownerMeta = buildCommercialBehaviorSourceOwnerMeta(source, characterId, character);
  const patch = rawPatch || (fallbackBranch ? createCommercialBehaviorPatchFromBranch(fallbackBranch, source, ownerMeta) : null);
  return applyCommercialBehaviorTreePatch(currentTree, {
    ...(patch || {}),
    ...ownerMeta,
    source,
    branch: fallbackBranch || patch?.branch,
    memory_delta: mergeCommercialBehaviorOwnerMemoryDelta(patch?.memory_delta || patch?.memoryDelta || {}, ownerMeta)
  });
}

function mergeCommercialBehaviorTreePatchesForRuntime(currentTree, rawPatches = [], source = 'manual', characterId = '', character = null) {
  if (!Array.isArray(rawPatches) || !rawPatches.length) return null;
  let nextTree = currentTree;
  const patches = [];
  rawPatches.forEach((rawPatch) => {
    const patchSource = rawPatch?.source || source;
    const ownerMeta = buildCommercialBehaviorSourceOwnerMeta(patchSource, characterId, character);
    const result = applyCommercialBehaviorTreePatch(nextTree, {
      ...(rawPatch || {}),
      ...ownerMeta,
      source: patchSource,
      memory_delta: mergeCommercialBehaviorOwnerMemoryDelta(rawPatch?.memory_delta || rawPatch?.memoryDelta || {}, ownerMeta)
    });
    if (!result.patch) return;
    nextTree = result.tree;
    patches.push(result.patch);
  });
  if (!patches.length) return null;
  return { tree: nextTree, patches };
}

function createCommercialBehaviorBranchFromNode(node) {
  if (!node || !Array.isArray(node.steps) || !node.steps.length) return null;
  return {
    branch_id: node.id,
    title: node.title || node.id,
    priority: node.priority,
    ttl_ms: node.ttl_ms || node.ttlMs,
    trigger: node.trigger || {},
    summary: node.summary || '',
    steps: node.steps,
    branch_kind: node.branch_kind || node.branchKind || 'base',
    source: node.source || '',
    owner_character_id: node.owner_character_id || node.ownerCharacterId || '',
    owner_character_name: node.owner_character_name || node.ownerCharacterName || ''
  };
}
function getCommercialBehaviorBranchLivelinessScore(branch = {}) {
  const steps = Array.isArray(branch.steps) ? branch.steps : [];
  let score = Math.min(steps.length, 8);
  steps.forEach((step) => {
    const action = String(step?.action || '').trim();
    if (commercialV2BehaviorLivelyActionIds.has(action)) score += action === 'idle_at_place' ? 2 : 4;
    if (action === 'say') score += 5;
    if (action === 'emote') score += 3;
    if (action === 'wait') score -= 1;
  });
  const idText = `${branch.branch_id || ''} ${branch.title || ''}`.toLowerCase();
  if (idText.includes('idle')) score -= 3;
  if (idText.includes('wander') || idText.includes('patrol') || idText.includes('walk')) score += 3;
  return score;
}
function sortCommercialBehaviorBranchesByLiveliness(branches = []) {
  return (Array.isArray(branches) ? branches : [])
    .map((branch, index) => ({
      branch,
      index,
      score: getCommercialBehaviorBranchLivelinessScore(branch)
    }))
    .sort((left, right) => (right.score - left.score) || (left.index - right.index))
    .map((entry) => entry.branch);
}
function normalizeCommercialBehaviorIterationStep(step = {}) {
  if (!step || typeof step !== 'object') return null;
  const normalized = {
    action: String(step.action || '').slice(0, 60)
  };
  if (!normalized.action) return null;
  ['text', 'place_id', 'from_place_id', 'to_place_id', 'movement_style', 'reason'].forEach((key) => {
    if (step[key] !== undefined) normalized[key] = String(step[key] || '').slice(0, key === 'text' ? 180 : 80);
  });
  if (step.duration_ms !== undefined) normalized.duration_ms = Number(step.duration_ms) || 0;
  if (Array.isArray(step.choices)) {
    normalized.choices = step.choices.slice(0, 4).map((choice) => ({
      id: String(choice?.id || '').slice(0, 40),
      label: String(choice?.label || choice?.text || '').slice(0, 40),
      trigger: String(choice?.trigger || '').slice(0, 60),
      place_id: String(choice?.place_id || choice?.placeId || '').slice(0, 80)
    })).filter((choice) => choice.label || choice.trigger);
  }
  return normalized;
}
function buildCommercialBehaviorIterationRecords(treeState, limit = commercialV2BehaviorIterationRecordLimit) {
  const nodes = treeState?.nodes && typeof treeState.nodes === 'object' ? treeState.nodes : {};
  const patchHistory = Array.isArray(treeState?.patch_history) ? treeState.patch_history : [];
  const chronological = patchHistory.slice(0, limit).reverse();
  return chronological.map((item, index) => {
    const nodeId = String(item?.node_id || item?.nodeId || item?.next_active_node_id || item?.nextActiveNodeId || '').trim();
    const node = nodeId ? nodes[nodeId] : null;
    const patchId = String(item?.patch_id || item?.patchId || '').trim();
    return {
      record_id: patchId || `${nodeId || 'behavior_record'}_${index + 1}`,
      sequence: Number(item?.sequence || item?.iteration_sequence || item?.iterationSequence) || index + 1,
      created_at: item?.created_at || item?.createdAt || '',
      source: item?.source || node?.source || '',
      target_node_id: item?.target_node_id || item?.targetNodeId || '',
      node_id: nodeId,
      branch_kind: node?.branch_kind || node?.branchKind || (String(item?.target_node_id || '').trim() === 'player_interaction' ? 'special' : 'base'),
      title: item?.title || node?.title || nodeId,
      reason: item?.reason || '',
      summary: node?.summary || item?.summary || '',
      trigger: node?.trigger || item?.trigger || '',
      steps: Array.isArray(node?.steps)
        ? node.steps.map(normalizeCommercialBehaviorIterationStep).filter(Boolean).slice(0, 10)
        : []
    };
  }).filter((record) => record.node_id || record.title || record.steps.length);
}
function readCommercialBehaviorIterationState(treeState) {
  const state = treeState?.memory?.behavior_iteration_context;
  return state && typeof state === 'object' ? state : {};
}
function buildCommercialBehaviorContextConfig(config = {}) {
  const normalized = normalizeCommercialBehaviorConfig(config);
  return {
    q_raw_limit: normalized.context_q_limit,
    p_summary_threshold: normalized.context_summary_threshold,
    max_summary_rounds: 3
  };
}
function resolveCommercialBehaviorSummaryCursor(records = [], summaries = [], iterationState = {}) {
  const explicitCursorId = String(
    iterationState.summary_cursor_record_id
    || iterationState.summaryCursorRecordId
    || ''
  ).trim();
  const candidateIds = [
    explicitCursorId,
    ...summaries.slice().reverse().map((summary) => summary?.end_record_id || summary?.endRecordId)
  ].map((id) => String(id || '').trim()).filter(Boolean);
  for (const recordId of candidateIds) {
    const recordIndex = records.findIndex((record) => String(record?.record_id || '') === recordId);
    if (recordIndex >= 0) {
      const record = records[recordIndex] || {};
      return {
        record_id: String(record.record_id || ''),
        sequence: Number(record.sequence || 0) || 0,
        index: recordIndex,
        found: true
      };
    }
  }
  const lastSummary = summaries[summaries.length - 1] || null;
  return {
    record_id: explicitCursorId || String(lastSummary?.end_record_id || lastSummary?.endRecordId || ''),
    sequence: 0,
    index: -1,
    found: false
  };
}
function buildCommercialBehaviorContextStats(treeState, behaviorConfig = {}) {
  const config = buildCommercialBehaviorContextConfig(behaviorConfig);
  const records = buildCommercialBehaviorIterationRecords(treeState);
  const iterationState = readCommercialBehaviorIterationState(treeState);
  const summaries = Array.isArray(iterationState.summaries) ? iterationState.summaries : [];
  const rawRecords = records.slice(-config.q_raw_limit);
  const overflowRecords = records.slice(0, Math.max(0, records.length - config.q_raw_limit));
  const cursor = resolveCommercialBehaviorSummaryCursor(records, summaries, iterationState);
  const pendingRecords = cursor.found
    ? (cursor.index >= overflowRecords.length ? [] : overflowRecords.slice(cursor.index + 1))
    : overflowRecords.slice();
  return {
    total_record_count: records.length,
    raw_readable_count: rawRecords.length,
    q_raw_limit: config.q_raw_limit,
    overflow_count: overflowRecords.length,
    pending_summary_count: pendingRecords.length,
    p_summary_threshold: config.p_summary_threshold,
    active_summary_count: summaries.slice(-config.max_summary_rounds).length,
    stored_summary_count: summaries.length,
    max_summary_rounds: config.max_summary_rounds,
    summary_cursor_record_id: cursor.record_id || '',
    will_summarize_before_next_reply: pendingRecords.length >= config.p_summary_threshold
  };
}
function mergeCommercialBehaviorIterationStateFromInput(treeState, inputPackage) {
  const contextState = inputPackage?.behavior_tree?.iteration_context?.state;
  if (!contextState || typeof contextState !== 'object') return treeState;
  const currentTree = treeState && typeof treeState === 'object' ? treeState : createCommercialV2BehaviorTreeState();
  const currentMemory = currentTree.memory && typeof currentTree.memory === 'object' ? currentTree.memory : {};
  const previousState = currentMemory.behavior_iteration_context && typeof currentMemory.behavior_iteration_context === 'object'
    ? currentMemory.behavior_iteration_context
    : {};
  return {
    ...currentTree,
    memory: {
      ...currentMemory,
      behavior_iteration_context: {
        ...previousState,
        summaries: Array.isArray(contextState.summaries) ? contextState.summaries.slice(-20) : (previousState.summaries || []),
        summary_cursor_record_id: contextState.summary_cursor_record_id || previousState.summary_cursor_record_id || '',
        last_error: contextState.last_error || '',
        last_success_at: contextState.last_success_at || previousState.last_success_at || 0,
        last_run_at: contextState.last_run_at || previousState.last_run_at || 0
      }
    }
  };
}
function behaviorBranchReferencesOnlyPlaces(branch, allowedPlaceIds = []) {
  const allowedPlaceIdSet = new Set((allowedPlaceIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  if (!allowedPlaceIdSet.size || !Array.isArray(branch?.steps)) return true;
  return branch.steps.every((step) => {
    const rawIds = [
      step?.place_id,
      step?.placeId,
      step?.from_place_id,
      step?.fromPlaceId,
      step?.to_place_id,
      step?.toPlaceId,
      step?.target_place_id,
      step?.targetPlaceId
    ].map((value) => String(value || '').trim()).filter(Boolean);
    return rawIds.every((id) => allowedPlaceIdSet.has(id));
  });
}
function getCommercialBehaviorTriggerText(trigger) {
  if (typeof trigger === 'string') return trigger;
  if (!trigger || typeof trigger !== 'object') return '';
  return [
    trigger.id,
    trigger.type,
    trigger.name,
    trigger.runtime_state,
    trigger.runtimeState,
    trigger.event,
    trigger.reason
  ].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
}
function commercialBehaviorBranchHasTrigger(branch = {}, triggerId = '') {
  const triggerText = getCommercialBehaviorTriggerText(branch.trigger).trim();
  if (!triggerId) return false;
  if (triggerText === triggerId) return true;
  if (triggerId === commercialV2BehaviorTravelFailureTrigger) {
    return triggerText.includes('travel_failed')
      || triggerText.includes('path_failed')
      || triggerText.includes('movement_recovery');
  }
  return false;
}
function commercialBehaviorBranchIsTravelRecovery(branch = {}) {
  return commercialBehaviorBranchHasTrigger(branch, commercialV2BehaviorTravelFailureTrigger);
}
function pickCommercialBehaviorBaseBranchByTrigger(treeState, triggerId = '', allowedPlaceIds = [], ownerCharacterId = '') {
  const nodes = treeState?.nodes && typeof treeState.nodes === 'object' ? treeState.nodes : {};
  const sourceNodeIds = commercialV2BehaviorBaseNodeIds
    .flatMap((nodeId) => Array.isArray(nodes[nodeId]?.children_ids) ? nodes[nodeId].children_ids : [])
    .filter(Boolean);
  const candidates = sourceNodeIds
    .map((nodeId) => createCommercialBehaviorBranchFromNode(nodes[nodeId]))
    .filter((branch) => branch
      && branch.branch_kind === 'base'
      && commercialBehaviorBranchHasTrigger(branch, triggerId)
      && commercialBehaviorBranchMatchesOwner(branch, ownerCharacterId)
      && behaviorBranchReferencesOnlyPlaces(branch, allowedPlaceIds))
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  return candidates[0] || null;
}
function pickGeneratedInteractionStarterBranch(treeState, actionId, placeId = '', allowedPlaceIds = [], ownerCharacterId = '') {
  const nodes = treeState?.nodes && typeof treeState.nodes === 'object' ? treeState.nodes : {};
  const childrenIds = Array.isArray(nodes.player_interaction?.children_ids) ? nodes.player_interaction.children_ids : [];
  const safeActionId = String(actionId || '').trim();
  if (!safeActionId || !childrenIds.length) return null;
  const candidates = childrenIds
    .map((nodeId) => nodes[nodeId])
    .filter((node) => {
      if (!node || node.branch_kind !== 'special' || !Array.isArray(node.steps) || !node.steps.length) return false;
      if (String(node.source || '') !== 'ai-interaction-starter') return false;
      if (!commercialBehaviorBranchMatchesOwner(node, ownerCharacterId)) return false;
      return String(node.trigger?.player_action || node.trigger?.playerAction || '').trim() === safeActionId;
    })
    .map((node) => createCommercialBehaviorBranchFromNode(node))
    .filter((branch) => branch && behaviorBranchReferencesOnlyPlaces(branch, allowedPlaceIds));
  if (!candidates.length) return null;
  const safePlaceId = String(placeId || '').trim();
  return candidates.find((branch) => String(branch.trigger?.place_id || branch.trigger?.placeId || '').trim() === safePlaceId)
    || candidates.find((branch) => !String(branch.trigger?.place_id || branch.trigger?.placeId || '').trim())
    || candidates[0];
}

function normalizeRoomBehaviorPlace(place, index = 0) {
  const id = String(place?.placeId || place?.id || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(place?.name || place?.label || place?.title || id).trim() || id,
    kind: String(place?.kind || '').trim(),
    order: Number(place?.order) || index + 1
  };
}

function pickRoomBehaviorPlace(places, matcher, fallbackIndex = 0) {
  const matched = places.find((place) => matcher(place));
  return matched || places[fallbackIndex] || places[0] || null;
}

function createRoomDefaultBehaviorSeedNodes(roomPlaces = []) {
  const places = roomPlaces
    .map((place, index) => normalizeRoomBehaviorPlace(place, index))
    .filter(Boolean);
  const categoryChildren = Object.fromEntries(commercialV2BehaviorBaseNodeIds.map((nodeId) => [nodeId, []]));
  const nodes = {};
  const addNode = (targetNodeId, node) => {
    if (!node?.id) return;
    nodes[node.id] = {
      type: 'ActionSequence',
      branch_kind: 'base',
      priority: 50,
      ttl_ms: 32000,
      ...node
    };
    categoryChildren[targetNodeId] = [
      ...(categoryChildren[targetNodeId] || []),
      node.id
    ];
  };
  if (!places.length) return { nodes, categoryChildren };
  const lower = (place) => `${place.id} ${place.label} ${place.kind}`.toLowerCase();
  const bed = pickRoomBehaviorPlace(places, (place) => lower(place).includes('bed') || lower(place).includes('床'), 0);
  const vanity = pickRoomBehaviorPlace(places, (place) => lower(place).includes('vanity') || lower(place).includes('mirror') || lower(place).includes('梳妆') || lower(place).includes('镜'), 1);
  const wardrobe = pickRoomBehaviorPlace(places, (place) => lower(place).includes('wardrobe') || lower(place).includes('衣柜') || lower(place).includes('柜'), 2);
  const center = pickRoomBehaviorPlace(places, (place) => place.id === 'room-point:center' || lower(place).includes('中心') || lower(place).includes('center'), 0);
  const left = pickRoomBehaviorPlace(places, (place) => place.id === 'room-point:left' || lower(place).includes('左'), 0);
  const right = pickRoomBehaviorPlace(places, (place) => place.id === 'room-point:right' || lower(place).includes('右'), Math.min(1, places.length - 1));
  const first = places[0];
  const second = places.find((place) => place.id !== first?.id) || first;
  const idlePlace = center || first;
  const restPlace = bed || idlePlace;
  const dailyPlace = vanity || wardrobe || idlePlace;
  const affordancePlace = wardrobe || vanity || restPlace || idlePlace;
  const routeStart = left || first;
  const routeEnd = right && right.id !== routeStart?.id ? right : second;
  const canTravelBetween = routeStart?.id && routeEnd?.id && routeStart.id !== routeEnd.id;

  addNode('hard_needs', {
    id: 'room_base_needs_rest',
    title: `基础：在${restPlace.label}旁边缓一下`,
    priority: 82,
    trigger: 'runtime_state.energy_low',
    summary: '无互动时，角色会利用当前房间里的休息锚点短暂停留。',
    steps: [
      { action: 'go_to_place', place_id: restPlace.id, movement_style: 'quiet' },
      { action: 'say', text: '我在这里歇一会儿。', duration_ms: 1400 },
      { action: 'idle_at_place', place_id: restPlace.id, movement_style: 'resting' },
      { action: 'wait', duration_ms: 1600 }
    ]
  });
  addNode('routine_goal', {
    id: 'room_base_routine_tidy',
    title: `基础：去${dailyPlace.label}前整理一下`,
    priority: 76,
    trigger: 'runtime_state.routine_tick',
    summary: '无互动时，角色按房间本地节奏整理、停顿和观察。',
    steps: [
      { action: 'go_to_place', place_id: dailyPlace.id, movement_style: 'normal' },
      { action: 'emote', text: '顺手整理了一下身边的小东西', duration_ms: 1300 },
      { action: 'idle_at_place', place_id: dailyPlace.id, movement_style: 'focused' },
      { action: 'wait', duration_ms: 1200 }
    ]
  });
  addNode('place_affordance', {
    id: 'room_base_affordance_pause',
    title: `基础：在${affordancePlace.label}旁停留`,
    priority: 68,
    trigger: 'location.has_affordance',
    summary: '无互动时，角色会使用或观察附近家具锚点。',
    steps: [
      { action: 'browse_near', place_id: affordancePlace.id, movement_style: 'checking' },
      { action: 'emote', text: '低头确认了一下摆放的位置', duration_ms: 1200 },
      { action: 'idle_at_place', place_id: affordancePlace.id, movement_style: 'calm' }
    ]
  });
  addNode('background_mood', {
    id: 'room_base_mood_slow_down',
    title: `基础：在${idlePlace.label}慢下来`,
    priority: 60,
    trigger: 'runtime_state.mood_idle',
    summary: 'AI 上文只轻微影响语气和情绪，房间行动仍由本地运行时触发。',
    steps: [
      { action: 'go_to_place', place_id: idlePlace.id, movement_style: 'slow' },
      { action: 'emote', text: '站定后轻轻呼出一口气', duration_ms: 1300 },
      { action: 'wait', duration_ms: 1400 }
    ]
  });
  addNode('curiosity', {
    id: 'room_base_curiosity_player_glance',
    title: '基础：看向玩家又移开',
    priority: 52,
    trigger: 'nearby_place_or_player',
    summary: '无互动时，角色可以注意到玩家，但不会主动进入对话。',
    steps: [
      { action: 'approach_player', movement_style: 'soft' },
      { action: 'face_player' },
      { action: 'emote', text: '看了你一眼，又很快装作在忙', duration_ms: 1500 },
      { action: 'wait', duration_ms: 1000 }
    ]
  });
  addNode('wander', canTravelBetween ? {
    id: 'room_base_wander_between_anchors',
    title: `基础：在${routeStart.label}和${routeEnd.label}之间走动`,
    priority: 36,
    trigger: 'otherwise',
    summary: '无互动时的默认房间移动循环。',
    steps: [
      { action: 'wander_between', from_place_id: routeStart.id, to_place_id: routeEnd.id, movement_style: 'casual' },
      { action: 'wait', duration_ms: 900 },
      { action: 'patrol_segment', from_place_id: routeEnd.id, to_place_id: routeStart.id, movement_style: 'casual' }
    ]
  } : {
    id: 'room_base_wander_near_anchor',
    title: `基础：在${idlePlace.label}附近走动`,
    priority: 36,
    trigger: 'otherwise',
    summary: '无互动时的默认房间停停走走。',
    steps: [
      { action: 'loop_in_front_of', place_id: idlePlace.id, movement_style: 'casual' },
      { action: 'wait', duration_ms: 900 },
      { action: 'idle_at_place', place_id: idlePlace.id, movement_style: 'idle' }
    ]
  });
  addNode('idle_micro', {
    id: 'room_base_idle_center',
    title: `基础：在${idlePlace.label}短暂停顿`,
    priority: 20,
    trigger: 'idle',
    summary: '没有更强目标时，角色做轻量停留。',
    steps: [
      { action: 'idle_at_place', place_id: idlePlace.id, movement_style: 'idle' },
      { action: 'emote', text: '轻轻换了个站姿', duration_ms: 1200 },
      { action: 'wait', duration_ms: 1100 }
    ]
  });
  return { nodes, categoryChildren };
}

function adaptRoomBehaviorTreeStateForPlaces(treeState, roomPlaces = []) {
  const fallback = createCommercialV2BehaviorTreeState();
  const currentTree = treeState && typeof treeState === 'object' ? treeState : fallback;
  const currentNodes = currentTree.nodes && typeof currentTree.nodes === 'object' ? currentTree.nodes : {};
  const { nodes: roomSeedNodes, categoryChildren } = createRoomDefaultBehaviorSeedNodes(roomPlaces);
  const oldCommercialSeedIds = new Set(commercialV2BehaviorAutonomousNodeIds);
  const nodes = {
    ...fallback.nodes,
    ...currentNodes,
    ...roomSeedNodes
  };
  nodes.street_character_root = {
    ...fallback.nodes.street_character_root,
    ...(nodes.street_character_root || {}),
    title: '通用角色行为根节点',
    summary: '完整行为树骨架通用；具体可用地点由当前场景锚点白名单决定。',
    children_ids: commercialV2BehaviorRootNodeIds
  };
  nodes.player_interaction = {
    ...fallback.nodes.player_interaction,
    ...(nodes.player_interaction || {}),
    title: '玩家互动回应池',
    branch_kind: 'special',
    trigger: 'player_event.active',
    summary: '玩家点击互动会先播放本地预制开场；末尾选项继续生成新的互动枝丫。'
  };
  const baseNodeMeta = {
    movement_recovery: ['移动恢复行为组', '移动目标不可达、路径被挡住或循迹失败时，角色先执行这里的恢复反应。'],
    hard_needs: ['硬需求行为组', '无互动时，角色根据精力、压力等状态选择自己的本地行动。'],
    routine_goal: ['本地例行行为组', '无互动时，角色按当前场景的本地默认节奏活动。'],
    place_affordance: ['锚点能力行为组', '无互动时，角色会使用或观察附近可用锚点。'],
    background_mood: ['背景情绪行为组', 'AI 上文只影响语气和轻微情绪，不直接触发移动。'],
    curiosity: ['好奇心行为组', '无互动时，角色偶尔注意玩家或周围锚点，但不直接进入对话。'],
    wander: ['自由活动行为组', '无互动时的默认本地移动循环。'],
    idle_micro: ['微动作行为组', '没有更强目标时，角色做轻量停留，不打断玩家。']
  };
  commercialV2BehaviorBaseNodeIds.forEach((nodeId) => {
    const seedChildren = categoryChildren[nodeId] || [];
    const existingChildren = Array.isArray(nodes[nodeId]?.children_ids) ? nodes[nodeId].children_ids : [];
    const dynamicChildren = existingChildren.filter((id) => (
      id
      && !seedChildren.includes(id)
      && !oldCommercialSeedIds.has(id)
    ));
    const [title, summary] = baseNodeMeta[nodeId] || [fallback.nodes[nodeId]?.title, fallback.nodes[nodeId]?.summary];
    nodes[nodeId] = {
      ...fallback.nodes[nodeId],
      ...(nodes[nodeId] || {}),
      title,
      summary,
      branch_kind: 'base',
      children_ids: [...seedChildren, ...dynamicChildren].slice(0, 12)
    };
  });
  const roomAnchorSignature = roomPlaces
    .map((place, index) => normalizeRoomBehaviorPlace(place, index)?.id || '')
    .filter(Boolean)
    .join('|');
  return {
    ...fallback,
    ...currentTree,
    tree_id: 'room_runtime_single_character',
    root_id: 'street_character_root',
    nodes,
    memory: {
      ...(currentTree.memory && typeof currentTree.memory === 'object' ? currentTree.memory : {}),
      ...(roomAnchorSignature ? { room_anchor_signature: roomAnchorSignature } : {})
    },
    patch_history: Array.isArray(currentTree.patch_history) ? currentTree.patch_history.slice(0, commercialV2BehaviorPatchHistoryLimit) : []
  };
}

export {
  commercialV2BehaviorConfigStorageKey,
  commercialV2BehaviorTreeStorageKey,
  commercialV2BehaviorInteractionDistance,
  commercialV2BehaviorInteractionSessionIdleMs,
  commercialV2BehaviorAutonomousInitialDelayMs,
  commercialV2BehaviorAutonomousCooldownMs,
  commercialV2BehaviorNearbyCooldownMs,
  commercialV2BehaviorBaseWaitMs,
  commercialV2BehaviorBaseFallbackMs,
  commercialV2BehaviorGenerationTimeoutMs,
  commercialV2BehaviorBaseGenerationTimeoutMs,
  commercialV2BehaviorContextDefaultQ,
  commercialV2BehaviorContextDefaultP,
  commercialV2BehaviorContextMinQ,
  commercialV2BehaviorContextMaxQ,
  commercialV2BehaviorContextMinP,
  commercialV2BehaviorContextMaxP,
  commercialV2BehaviorPatchHistoryLimit,
  commercialV2BehaviorIterationRecordLimit,
  commercialV2BehaviorActions,
  commercialV2BehaviorActionIds,
  commercialV2BehaviorPrimaryActionIds,
  commercialV2BehaviorContextActionIds,
  commercialV2BehaviorImportantPlaceIds,
  commercialV2BehaviorMovementActions,
  commercialV2BehaviorSpecialNodeIds,
  commercialV2BehaviorTravelFailureTrigger,
  commercialV2BehaviorBaseNodeIds,
  commercialV2BehaviorRootNodeIds,
  commercialV2BehaviorAutonomousNodeIds,
  commercialV2BehaviorNearbyAutonomousNodeIds,
  commercialV2BehaviorDefaultBaseActionNodeIds,
  commercialV2BehaviorLastDemoBranch,
  createCommercialV2PresetInteractionBranch,
  commercialV2BehaviorDefaultConfig,
  fetchBehaviorJsonWithTimeout,
  formatBehaviorRequestError,
  getBehaviorAuthHeaders,
  formatBehaviorJson,
  normalizeBehaviorPlaceLookupText,
  resolveBehaviorChoicePlaceIdFromPlaces,
  resolveBehaviorChoiceTrigger,
  normalizeBehaviorDialogChoices,
  summarizeBehaviorPlaceForPayload,
  buildBehaviorTreePayloadSummary,
  normalizeCommercialBehaviorContextLimit,
  normalizeCommercialBehaviorConfig,
  readStoredCommercialBehaviorConfig,
  createCommercialV2BehaviorTreeState,
  createCommercialBehaviorTreeRebuildState,
  readStoredCommercialBehaviorTreeState,
  readStoredRoomBehaviorTreeState,
  normalizeCommercialBehaviorNodeId,
  isCommercialBehaviorAiSource,
  buildCommercialBehaviorOwnerMeta,
  buildCommercialBehaviorSourceOwnerMeta,
  mergeCommercialBehaviorOwnerMemoryDelta,
  commercialBehaviorBranchMatchesOwner,
  createCommercialBehaviorPatchFromBranch,
  normalizeCommercialBehaviorPatch,
  applyCommercialBehaviorTreePatch,
  mergeCommercialBehaviorTreePatchForRuntime,
  mergeCommercialBehaviorTreePatchesForRuntime,
  createCommercialBehaviorBranchFromNode,
  sortCommercialBehaviorBranchesByLiveliness,
  normalizeCommercialBehaviorIterationStep,
  buildCommercialBehaviorIterationRecords,
  buildCommercialBehaviorContextStats,
  readCommercialBehaviorIterationState,
  buildCommercialBehaviorContextConfig,
  mergeCommercialBehaviorIterationStateFromInput,
  behaviorBranchReferencesOnlyPlaces,
  getCommercialBehaviorTriggerText,
  commercialBehaviorBranchHasTrigger,
  commercialBehaviorBranchIsTravelRecovery,
  pickCommercialBehaviorBaseBranchByTrigger,
  pickGeneratedInteractionStarterBranch,
  normalizeRoomBehaviorPlace,
  pickRoomBehaviorPlace,
  createRoomDefaultBehaviorSeedNodes,
  adaptRoomBehaviorTreeStateForPlaces
};
