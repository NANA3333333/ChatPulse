const PACK_ROOT = "/assets/pixel-world/characters/rpg-hair-clothing-action-pack-v1";
const MANIFEST_URL = `${PACK_ROOT}/manifest.json`;
const VALIDATION_URL = `${PACK_ROOT}/validation-report.json`;

const actionLabels = {
  walk: "走路",
  combat: "战斗",
  crouch: "半蹲",
  run: "跑步",
  shy: "害羞",
  cry: "哭泣",
};

const actionIcons = {
  walk: "W",
  combat: "!",
  crouch: "C",
  run: "R",
  shy: "?",
  cry: "~",
};

const directionLabels = {
  front: "正面",
  left: "左侧",
  right: "右侧",
  back: "背面",
};

const state = {
  manifest: null,
  validation: null,
  hairStyleId: "",
  outfitId: "",
  eyeStyleId: "baked_default",
  actionId: "walk",
  direction: "front",
  frame: "pose_01",
  zoom: 1.75,
  speed: 150,
  playing: false,
};

let playTimer = null;

const els = {
  assetCount: document.getElementById("assetCount"),
  loadStatus: document.getElementById("loadStatus"),
  hairGrid: document.getElementById("hairGrid"),
  outfitGrid: document.getElementById("outfitGrid"),
  actionGrid: document.getElementById("actionGrid"),
  directionGroup: document.getElementById("directionGroup"),
  frameGroup: document.getElementById("frameGroup"),
  frameRangeLabel: document.getElementById("frameRangeLabel"),
  stageWrap: document.getElementById("stageWrap"),
  stage: document.getElementById("stage"),
  spriteLayer: document.getElementById("spriteLayer"),
  stageCaption: document.getElementById("stageCaption"),
  frameStrip: document.getElementById("frameStrip"),
  playButton: document.getElementById("playButton"),
  randomLookButton: document.getElementById("randomLookButton"),
  randomHairButton: document.getElementById("randomHairButton"),
  randomOutfitButton: document.getElementById("randomOutfitButton"),
  zoomInput: document.getElementById("zoomInput"),
  zoomValue: document.getElementById("zoomValue"),
  speedInput: document.getElementById("speedInput"),
  speedValue: document.getElementById("speedValue"),
  lookName: document.getElementById("lookName"),
  actionName: document.getElementById("actionName"),
  poseMatrix: document.getElementById("poseMatrix"),
  matrixRangeLabel: document.getElementById("matrixRangeLabel"),
  sheetImage: document.getElementById("sheetImage"),
  sheetLabel: document.getElementById("sheetLabel"),
};

function titleLabel(id) {
  return String(id || "")
    .replace(/^\d+_/, "")
    .replaceAll("_", " ");
}

function hairItems() {
  return state.manifest?.hairstyles || [];
}

function outfitItems() {
  return state.manifest?.outfits || [];
}

function actionItems() {
  return state.manifest?.actions || [];
}

function directionItems() {
  return state.manifest?.directions || ["front", "left", "right", "back"];
}

function frameItems(actionId = state.actionId) {
  return state.manifest?.frames_by_action?.[actionId] || state.manifest?.frames || ["pose_01", "pose_02", "pose_03", "pose_04"];
}

function frameLabel(frameId) {
  const number = String(frameId || "").replace("pose_", "");
  return number ? number.padStart(2, "0") : frameId;
}

function frameRangeLabel(actionId = state.actionId) {
  const frames = frameItems(actionId);
  const first = frames[0] || "pose_01";
  const last = frames[frames.length - 1] || first;
  return `pose ${frameLabel(first)}-${frameLabel(last)}`;
}

function frameSrc({
  hairStyleId = state.hairStyleId,
  outfitId = state.outfitId,
  actionId = state.actionId,
  direction = state.direction,
  frame = state.frame,
} = {}) {
  if (!hairStyleId || !outfitId || !actionId || !direction || !frame) return "";
  return `${PACK_ROOT}/hairstyles/${hairStyleId}/outfits/${outfitId}/frames/${actionId}/${direction}/${direction}_${actionId}_${frame}.png`;
}

function sheetSrc({
  hairStyleId = state.hairStyleId,
  outfitId = state.outfitId,
  actionId = state.actionId,
} = {}) {
  if (!hairStyleId || !outfitId || !actionId) return "";
  return `${PACK_ROOT}/hairstyles/${hairStyleId}/outfits/${outfitId}/sheets/${actionId}.png`;
}

function normalizeState() {
  if (!hairItems().includes(state.hairStyleId)) state.hairStyleId = hairItems()[0] || "";
  if (!outfitItems().includes(state.outfitId)) state.outfitId = outfitItems()[0] || "";
  if (!actionItems().includes(state.actionId)) state.actionId = actionItems()[0] || "walk";
  if (!directionItems().includes(state.direction)) state.direction = directionItems()[0] || "front";
  if (!frameItems().includes(state.frame)) state.frame = frameItems()[0] || "pose_01";
}

function sample(list) {
  return list[Math.floor(Math.random() * list.length)] || "";
}

function setPlaying(nextPlaying) {
  state.playing = nextPlaying;
  els.playButton.textContent = state.playing ? "暂停" : "播放";
  els.playButton.classList.toggle("is-playing", state.playing);
  window.clearInterval(playTimer);
  playTimer = null;

  if (!state.playing) return;
  playTimer = window.setInterval(() => {
    const ids = frameItems();
    const index = ids.indexOf(state.frame);
    state.frame = ids[(index + 1) % ids.length];
    renderDynamic();
  }, state.speed);
}

function selectedIdForKind(kind) {
  if (kind === "hair") return state.hairStyleId;
  if (kind === "outfit") return state.outfitId;
  if (kind === "action") return state.actionId;
  return "";
}

function makeChoiceCard({ id, index, kind, imageSrc, label, meta, onSelect }) {
  const button = document.createElement("button");
  button.className = `${kind}-card choice-card${id === selectedIdForKind(kind) ? " is-active" : ""}`;
  button.type = "button";
  button.title = label;

  const preview = document.createElement("span");
  preview.className = "choice-preview";

  const img = document.createElement("img");
  img.src = imageSrc;
  img.alt = "";
  img.loading = "lazy";
  preview.append(img);

  const copy = document.createElement("span");
  copy.className = "choice-copy";

  const name = document.createElement("strong");
  name.textContent = label;

  const sub = document.createElement("small");
  sub.textContent = `${String(index + 1).padStart(2, "0")} / ${meta}`;

  copy.append(name, sub);
  button.append(preview, copy);
  button.addEventListener("click", onSelect);
  return button;
}

function renderHairGrid() {
  els.hairGrid.innerHTML = "";
  hairItems().forEach((hairStyleId, index) => {
    els.hairGrid.append(
      makeChoiceCard({
        id: hairStyleId,
        index,
        kind: "hair",
        imageSrc: frameSrc({ hairStyleId, actionId: "walk", direction: "front", frame: "pose_01" }),
        label: titleLabel(hairStyleId),
        meta: "hair",
        onSelect: () => {
          state.hairStyleId = hairStyleId;
          renderAll();
        },
      }),
    );
  });
}

function renderOutfitGrid() {
  els.outfitGrid.innerHTML = "";
  outfitItems().forEach((outfitId, index) => {
    els.outfitGrid.append(
      makeChoiceCard({
        id: outfitId,
        index,
        kind: "outfit",
        imageSrc: frameSrc({ outfitId, actionId: "walk", direction: "front", frame: "pose_01" }),
        label: titleLabel(outfitId),
        meta: "outfit",
        onSelect: () => {
          state.outfitId = outfitId;
          renderAll();
        },
      }),
    );
  });
}

function renderActionGrid() {
  els.actionGrid.innerHTML = "";
  actionItems().forEach((actionId) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-chip${actionId === state.actionId ? " is-active" : ""}`;

    const icon = document.createElement("span");
    icon.textContent = actionIcons[actionId] || actionId.slice(0, 1).toUpperCase();

    const copy = document.createElement("strong");
    copy.textContent = actionLabels[actionId] || titleLabel(actionId);

    const img = document.createElement("img");
    img.src = frameSrc({ actionId, direction: "front", frame: frameItems(actionId)[0] || "pose_01" });
    img.alt = "";
    img.loading = "lazy";

    button.append(icon, copy, img);
    button.addEventListener("click", () => {
      state.actionId = actionId;
      state.frame = frameItems()[0] || "pose_01";
      renderAll();
    });
    els.actionGrid.append(button);
  });
}

function renderDirectionDock() {
  els.directionGroup.innerHTML = "";
  directionItems().forEach((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `direction-button${direction === state.direction ? " is-active" : ""}`;

    const img = document.createElement("img");
    img.src = frameSrc({ direction, frame: state.frame });
    img.alt = "";
    img.loading = "lazy";

    const text = document.createElement("span");
    text.textContent = directionLabels[direction] || direction;

    button.append(img, text);
    button.addEventListener("click", () => {
      state.direction = direction;
      renderAll();
    });
    els.directionGroup.append(button);
  });
}

function renderFrameTabs() {
  els.frameRangeLabel.textContent = frameRangeLabel();
  els.frameGroup.innerHTML = "";
  frameItems().forEach((frame) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = frameLabel(frame);
    button.className = frame === state.frame ? "is-active" : "";
    button.addEventListener("click", () => {
      state.frame = frame;
      renderDynamic();
    });
    els.frameGroup.append(button);
  });
}

function renderStage() {
  els.spriteLayer.onload = () => {
    els.loadStatus.textContent = "Ready";
    els.loadStatus.dataset.state = "ready";
  };
  els.spriteLayer.onerror = () => {
    els.loadStatus.textContent = "Missing";
    els.loadStatus.dataset.state = "missing";
  };
  els.spriteLayer.src = frameSrc();

  els.stage.style.transform = `scale(${state.zoom})`;
  els.stageWrap.style.minHeight = `${314 * state.zoom + 150}px`;
  els.lookName.textContent = `${titleLabel(state.hairStyleId)} / ${titleLabel(state.outfitId)}`;
  els.actionName.textContent = `${actionLabels[state.actionId] || state.actionId} · ${directionLabels[state.direction] || state.direction} · ${frameLabel(state.frame)}`;
  els.stageCaption.textContent = `${state.direction}_${state.actionId}_${state.frame}.png`;
}

function renderFrameStrip() {
  els.frameStrip.innerHTML = "";
  frameItems().forEach((frame) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `frame-card${frame === state.frame ? " is-active" : ""}`;

    const img = document.createElement("img");
    img.src = frameSrc({ frame });
    img.alt = "";
    img.loading = "lazy";

    const label = document.createElement("span");
    label.textContent = `pose ${frameLabel(frame)}`;

    button.append(img, label);
    button.addEventListener("click", () => {
      state.frame = frame;
      renderDynamic();
    });
    els.frameStrip.append(button);
  });
}

function renderPoseMatrix() {
  els.matrixRangeLabel.textContent = `${directionItems().length} 方向 × ${frameItems().length} 帧`;
  els.poseMatrix.innerHTML = "";
  directionItems().forEach((direction) => {
    frameItems().forEach((frame) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `matrix-cell${direction === state.direction && frame === state.frame ? " is-active" : ""}`;

      const img = document.createElement("img");
      img.src = frameSrc({ direction, frame });
      img.alt = "";
      img.loading = "lazy";

      const label = document.createElement("span");
      label.textContent = `${directionLabels[direction] || direction} ${frameLabel(frame)}`;

      button.append(img, label);
      button.addEventListener("click", () => {
        state.direction = direction;
        state.frame = frame;
        renderDynamic();
      });
      els.poseMatrix.append(button);
    });
  });
}

function renderSheet() {
  els.sheetImage.src = sheetSrc();
  els.sheetLabel.textContent = `${state.actionId}.png`;
}

function renderControls() {
  els.zoomInput.value = String(state.zoom);
  els.zoomValue.value = `${state.zoom.toFixed(2)}x`;
  els.speedInput.value = String(state.speed);
  els.speedValue.value = `${state.speed}ms`;
}

function renderDynamic() {
  normalizeState();
  renderFrameTabs();
  renderStage();
  renderDirectionDock();
  renderFrameStrip();
  renderPoseMatrix();
  renderSheet();
}

function renderAll() {
  normalizeState();
  const frameCount = state.validation?.actual_frames || state.manifest.frame_count || 0;
  const sheetCount = state.validation?.actual_sheets || state.manifest.sheet_count || 0;
  els.assetCount.textContent = `${hairItems().length} 发型 · ${outfitItems().length} 服装 · ${actionItems().length} 动作 · ${frameCount} 帧 · ${sheetCount} 表`;
  renderHairGrid();
  renderOutfitGrid();
  renderActionGrid();
  renderFrameTabs();
  renderStage();
  renderDirectionDock();
  renderFrameStrip();
  renderPoseMatrix();
  renderSheet();
  renderControls();
}

function bindControls() {
  els.zoomInput.addEventListener("input", () => {
    state.zoom = Number(els.zoomInput.value);
    renderStage();
    renderControls();
  });

  els.speedInput.addEventListener("input", () => {
    state.speed = Number(els.speedInput.value);
    renderControls();
    if (state.playing) setPlaying(true);
  });

  els.playButton.addEventListener("click", () => {
    setPlaying(!state.playing);
  });

  els.randomHairButton.addEventListener("click", () => {
    state.hairStyleId = sample(hairItems());
    renderAll();
  });

  els.randomOutfitButton.addEventListener("click", () => {
    state.outfitId = sample(outfitItems());
    renderAll();
  });

  els.randomLookButton.addEventListener("click", () => {
    state.hairStyleId = sample(hairItems());
    state.outfitId = sample(outfitItems());
    state.actionId = sample(actionItems());
    state.direction = sample(directionItems());
    state.frame = sample(frameItems());
    renderAll();
  });
}

async function loadJson(url, fallback = null) {
  const response = await fetch(url);
  if (!response.ok) return fallback;
  return response.json();
}

async function init() {
  state.manifest = await loadJson(MANIFEST_URL);
  if (!state.manifest) throw new Error(`Failed to load ${MANIFEST_URL}`);
  state.validation = await loadJson(VALIDATION_URL, null);
  state.hairStyleId = hairItems()[0] || "";
  state.outfitId = outfitItems()[0] || "";
  state.actionId = "shy";
  state.direction = "front";
  state.frame = "pose_01";
  state.zoom = window.innerWidth < 820 ? 1.25 : 1.75;
  els.loadStatus.textContent = "Ready";
  els.loadStatus.dataset.state = "ready";
  bindControls();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<pre>${String(error.stack || error)}</pre>`;
});
