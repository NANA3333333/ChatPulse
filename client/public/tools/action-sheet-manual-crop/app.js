const PACK_ROOT = "/assets/pixel-world/characters/rpg-hair-clothing-action-pack-v1";
const MANIFEST_URL = `${PACK_ROOT}/manifest.json`;
const STORAGE_KEY = "rpg-action-sheet-manual-crop-v3";
const FRAME_SIZE = 314;
const DEFAULT_SHEET_SIZE = 1254;

const actionLabels = {
  walk: "走路",
  combat: "战斗",
  crouch: "蹲下",
  run: "跑步",
  shy: "害羞",
  cry: "哭泣",
};

const directionLabels = {
  front: "正面",
  left: "左侧",
  right: "右侧",
  back: "背面",
};

const landmarkLabels = {
  headTop: "头顶",
  feet: "脚底",
};

const landmarkOrder = ["headTop", "feet"];

const state = {
  manifest: null,
  sheets: [],
  filteredSheets: [],
  selectedIndex: 0,
  sourceMode: "pack",
  localSources: [],
  selectedLocalIndex: 0,
  currentImage: null,
  currentSourceSize: {
    width: DEFAULT_SHEET_SIZE,
    height: DEFAULT_SHEET_SIZE,
  },
  saved: {},
  filters: {
    hair: "all",
    outfit: "all",
    action: "walk",
  },
  edges: {
    x: [0, 314, 627, 940, 1254],
    y: [0, 314, 627, 940, 1254],
  },
  landmarkLines: {
    headTop: 34,
    feet: 292,
  },
  selectedCell: {
    row: 0,
    col: 0,
  },
  zoom: 0.62,
  previewBackground: "checker",
  chromaKey: {
    enabled: true,
    greenMin: 235,
    redBlueMax: 36,
    greenGap: 170,
  },
  dragging: null,
  status: "unchecked",
  issues: [],
  frameMarks: [],
  note: "",
};

const els = {
  assetCount: document.getElementById("assetCount"),
  hairFilter: document.getElementById("hairFilter"),
  outfitFilter: document.getElementById("outfitFilter"),
  actionFilter: document.getElementById("actionFilter"),
  localFileInput: document.getElementById("localFileInput"),
  localSourceList: document.getElementById("localSourceList"),
  sheetList: document.getElementById("sheetList"),
  currentTitle: document.getElementById("currentTitle"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  nextUncheckedButton: document.getElementById("nextUncheckedButton"),
  quickFrameGroup: document.getElementById("quickFrameGroup"),
  zoomInput: document.getElementById("zoomInput"),
  zoomValue: document.getElementById("zoomValue"),
  previewBgSelect: document.getElementById("previewBgSelect"),
  sheetCanvas: document.getElementById("sheetCanvas"),
  focusCanvas: document.getElementById("focusCanvas"),
  focusTitle: document.getElementById("focusTitle"),
  focusCropText: document.getElementById("focusCropText"),
  previewGrid: document.getElementById("previewGrid"),
  xEdgeGrid: document.getElementById("xEdgeGrid"),
  yEdgeGrid: document.getElementById("yEdgeGrid"),
  landmarkGrid: document.getElementById("landmarkGrid"),
  greenKeyToggle: document.getElementById("greenKeyToggle"),
  greenMinInput: document.getElementById("greenMinInput"),
  redBlueMaxInput: document.getElementById("redBlueMaxInput"),
  greenGapInput: document.getElementById("greenGapInput"),
  equalPresetButton: document.getElementById("equalPresetButton"),
  round314PresetButton: document.getElementById("round314PresetButton"),
  resetLandmarkButton: document.getElementById("resetLandmarkButton"),
  resetButton: document.getElementById("resetButton"),
  statusSelect: document.getElementById("statusSelect"),
  issueInputs: Array.from(document.querySelectorAll("[data-issue]")),
  frameMarkSummary: document.getElementById("frameMarkSummary"),
  noteInput: document.getElementById("noteInput"),
  saveButton: document.getElementById("saveButton"),
  downloadFrameButton: document.getElementById("downloadFrameButton"),
  downloadZipButton: document.getElementById("downloadZipButton"),
  markRegenButton: document.getElementById("markRegenButton"),
  clearFrameMarksButton: document.getElementById("clearFrameMarksButton"),
  copyCurrentButton: document.getElementById("copyCurrentButton"),
  copyAllButton: document.getElementById("copyAllButton"),
  copyIssuesButton: document.getElementById("copyIssuesButton"),
  saveState: document.getElementById("saveState"),
  jsonOutput: document.getElementById("jsonOutput"),
};

let autoSaveTimer = null;
let imageRequestId = 0;

function label(id) {
  return String(id || "")
    .replace(/^\d+_/, "")
    .replaceAll("_", " ");
}

function sanitizePathPart(value) {
  return String(value || "asset")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 90);
}

function sheetKey(sheet) {
  return `${sheet.hair}/${sheet.outfit}/${sheet.action}`;
}

function sheetPath(sheet) {
  return `${PACK_ROOT}/hairstyles/${sheet.hair}/outfits/${sheet.outfit}/sheets/${sheet.action}.png`;
}

function currentSheet() {
  return state.filteredSheets[state.selectedIndex] || state.filteredSheets[0] || null;
}

function currentLocalSource() {
  return state.localSources[state.selectedLocalIndex] || null;
}

function currentKey() {
  if (state.sourceMode === "local") return currentLocalSource()?.key || "";
  const sheet = currentSheet();
  return sheet ? sheetKey(sheet) : "";
}

function currentSourcePath() {
  if (state.sourceMode === "local") return currentLocalSource()?.name || "";
  const sheet = currentSheet();
  return sheet ? sheetPath(sheet) : "";
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

function frameItems() {
  return state.manifest?.frames || ["pose_01", "pose_02", "pose_03", "pose_04"];
}

function directionItems() {
  return state.manifest?.directions || ["front", "left", "right", "back"];
}

function cellMeta(row, col) {
  return {
    row,
    col,
    direction: directionItems()[row] || `row_${row + 1}`,
    frame: frameItems()[col] || `pose_${String(col + 1).padStart(2, "0")}`,
    crop: cropPreview(row, col),
  };
}

function markedCellKeys() {
  return new Set(state.frameMarks.map((mark) => cellKey(mark.row, mark.col)));
}

function oldMethodEdgesForExtent(extent) {
  if (extent === 1254) return [0, 314, 627, 940, 1254];
  if (extent === 1256) return [0, 314, 628, 942, 1256];
  return [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(extent * ratio));
}

function defaultEdges() {
  return {
    x: oldMethodEdgesForExtent(state.currentSourceSize.width),
    y: oldMethodEdgesForExtent(state.currentSourceSize.height),
  };
}

function round314Edges() {
  const width = state.currentSourceSize.width;
  const height = state.currentSourceSize.height;
  const axis = (extent) => [
    0,
    Math.min(FRAME_SIZE, extent),
    Math.min(FRAME_SIZE * 2, extent),
    Math.min(FRAME_SIZE * 3, extent),
    extent,
  ];
  return {
    x: axis(width),
    y: axis(height),
  };
}

function defaultLandmarkLines() {
  return {
    headTop: 34,
    feet: 292,
  };
}

function normalizeLandmarkLines(savedLines) {
  const defaults = defaultLandmarkLines();
  const source = savedLines || {};
  return Object.fromEntries(
    landmarkOrder.map((key) => [key, Number.isFinite(Number(source[key])) ? Number(source[key]) : defaults[key]]),
  );
}

function normalizeEdgeList(values, extent) {
  const fallback = oldMethodEdgesForExtent(extent);
  if (!Array.isArray(values) || values.length !== 5) return fallback;
  const normalized = values.map((value, index) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : fallback[index];
  });
  normalized[0] = Math.max(0, Math.min(extent - 4, normalized[0]));
  for (let index = 1; index < normalized.length; index += 1) {
    normalized[index] = Math.max(normalized[index - 1] + 1, Math.min(extent - (4 - index), normalized[index]));
  }
  normalized[4] = Math.max(normalized[3] + 1, Math.min(extent, normalized[4]));
  return normalized;
}

function normalizeEdges(savedEdges) {
  return {
    x: normalizeEdgeList(savedEdges?.x, state.currentSourceSize.width),
    y: normalizeEdgeList(savedEdges?.y, state.currentSourceSize.height),
  };
}

function loadSaved() {
  try {
    state.saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    state.saved = {};
  }
}

function writeSaved() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
}

function buildSheets() {
  const sheets = [];
  state.manifest.hairstyles.forEach((hair) => {
    state.manifest.outfits.forEach((outfit) => {
      state.manifest.actions.forEach((action) => {
        sheets.push({ hair, outfit, action });
      });
    });
  });
  state.sheets = sheets;
}

function fillSelect(select, items, allLabel) {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  select.append(all);
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = label(item);
    select.append(option);
  });
}

function renderFilters() {
  fillSelect(els.hairFilter, state.manifest.hairstyles, "全部发型");
  fillSelect(els.outfitFilter, state.manifest.outfits, "全部衣服");
  fillSelect(els.actionFilter, state.manifest.actions, "全部动作");
  els.hairFilter.value = state.filters.hair;
  els.outfitFilter.value = state.filters.outfit;
  els.actionFilter.value = state.filters.action;
}

function applyFilters() {
  state.filteredSheets = state.sheets.filter((sheet) => {
    return (
      (state.filters.hair === "all" || sheet.hair === state.filters.hair) &&
      (state.filters.outfit === "all" || sheet.outfit === state.filters.outfit) &&
      (state.filters.action === "all" || sheet.action === state.filters.action)
    );
  });
  if (state.selectedIndex >= state.filteredSheets.length) state.selectedIndex = 0;
}

function applySavedForCurrent() {
  const saved = state.saved[currentKey()];
  state.edges = normalizeEdges(saved?.edges);
  state.landmarkLines = normalizeLandmarkLines(saved?.landmarkLines);
  state.status = saved?.status || "unchecked";
  state.issues = Array.isArray(saved?.issues) ? [...saved.issues] : [];
  state.frameMarks = Array.isArray(saved?.frameMarks) ? saved.frameMarks.map((mark) => ({ ...mark })) : [];
  state.note = saved?.note || "";
  state.selectedCell = saved?.selectedCell || state.selectedCell || { row: 0, col: 0 };
  clampSelectedCell();
}

function clampSelectedCell() {
  state.selectedCell = {
    row: Math.max(0, Math.min(3, Number(state.selectedCell?.row) || 0)),
    col: Math.max(0, Math.min(3, Number(state.selectedCell?.col) || 0)),
  };
}

function currentPayload() {
  const key = currentKey();
  if (!key) return null;
  const packSheet = state.sourceMode === "pack" ? currentSheet() : null;
  const localSource = state.sourceMode === "local" ? currentLocalSource() : null;
  return {
    key,
    sourceMode: state.sourceMode,
    hairStyleId: packSheet?.hair || null,
    outfitStyleId: packSheet?.outfit || null,
    actionId: packSheet?.action || null,
    sourceName: localSource?.name || null,
    sheetPath: currentSourcePath(),
    sourceSize: [state.currentSourceSize.width, state.currentSourceSize.height],
    status: state.status,
    issues: state.issues,
    frameMarks: state.frameMarks.map((mark) => ({
      ...cellMeta(mark.row, mark.col),
      reason: mark.reason || "manual_frame_mark",
    })),
    note: state.note,
    edges: state.edges,
    landmarkLines: normalizeLandmarkLines(state.landmarkLines),
    chromaKey: { ...state.chromaKey },
    selectedCell: { ...state.selectedCell },
    outputFrameSize: [FRAME_SIZE, FRAME_SIZE],
    mode: "manual-red-line-crop-with-conservative-green-key",
  };
}

function renderSheetList() {
  els.sheetList.innerHTML = "";
  state.filteredSheets.forEach((sheet, index) => {
    const key = sheetKey(sheet);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sheet-row${state.sourceMode === "pack" && index === state.selectedIndex ? " is-active" : ""}`;
    button.dataset.status = state.saved[key]?.status || "unchecked";
    button.dataset.hasIssues = state.saved[key]?.issues?.length || state.saved[key]?.frameMarks?.length ? "true" : "false";

    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(3, "0")} ${label(sheet.hair)}`;

    const meta = document.createElement("span");
    const issueCount = (state.saved[key]?.issues?.length || 0) + (state.saved[key]?.frameMarks?.length || 0);
    const issueText = issueCount ? ` / ${issueCount} 标记` : "";
    meta.textContent = `${label(sheet.outfit)} / ${actionLabels[sheet.action] || sheet.action}${issueText}`;

    button.append(title, meta);
    button.addEventListener("click", () => {
      state.sourceMode = "pack";
      state.selectedIndex = index;
      selectCurrentSource();
    });
    els.sheetList.append(button);
  });
}

function renderLocalSourceList() {
  els.localSourceList.innerHTML = "";
  state.localSources.forEach((source, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `local-source-row${state.sourceMode === "local" && index === state.selectedLocalIndex ? " is-active" : ""}`;
    button.textContent = source.name;
    button.addEventListener("click", () => {
      state.sourceMode = "local";
      state.selectedLocalIndex = index;
      selectCurrentSource();
    });
    els.localSourceList.append(button);
  });
}

function drawChecker(ctx, width, height, size = 24) {
  ctx.clearRect(0, 0, width, height);
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#f7fafc" : "#d9e2ec";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawBackground(ctx, width, height, mode = state.previewBackground, checkerSize = 24) {
  if (mode === "black") {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (mode === "green") {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (mode === "white") {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  drawChecker(ctx, width, height, checkerSize);
}

function resizeSheetCanvasForCurrentImage() {
  const width = state.currentSourceSize.width;
  const height = state.currentSourceSize.height;
  if (els.sheetCanvas.width !== width) els.sheetCanvas.width = width;
  if (els.sheetCanvas.height !== height) els.sheetCanvas.height = height;
  els.sheetCanvas.style.width = `${Math.max(280, Math.round(width * state.zoom))}px`;
  els.sheetCanvas.style.height = "auto";
}

function drawSheetCanvas() {
  resizeSheetCanvasForCurrentImage();
  const canvas = els.sheetCanvas;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.width, canvas.height, state.previewBackground, 24);
  if (state.currentImage) {
    ctx.drawImage(state.currentImage, 0, 0);
  }

  const selected = cropPreview(state.selectedCell.row, state.selectedCell.col);
  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
  ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
  ctx.lineWidth = 5;
  ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
  ctx.strokeRect(selected.x + 2.5, selected.y + 2.5, selected.width - 5, selected.height - 5);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(239, 68, 68, 0.96)";
  ctx.fillStyle = "rgba(239, 68, 68, 0.96)";
  ctx.lineWidth = 4;
  state.edges.x.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
    ctx.fillRect(x - 7, 0, 14, 24);
  });
  state.edges.y.forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
    ctx.fillRect(0, y - 7, 24, 14);
  });
  ctx.restore();

  drawSheetLandmarks(ctx);

  ctx.save();
  ctx.strokeStyle = "rgba(220, 38, 38, 1)";
  ctx.fillStyle = "rgba(220, 38, 38, 0.14)";
  ctx.lineWidth = 10;
  state.frameMarks.forEach((mark) => {
    const crop = cropPreview(mark.row, mark.col);
    ctx.fillRect(crop.x, crop.y, crop.width, crop.height);
    ctx.strokeRect(crop.x + 5, crop.y + 5, crop.width - 10, crop.height - 10);
  });
  ctx.restore();
}

function cropPreview(row, col) {
  const x0 = state.edges.x[col];
  const x1 = state.edges.x[col + 1];
  const y0 = state.edges.y[row];
  const y1 = state.edges.y[row + 1];
  return {
    x: Math.max(0, Math.min(x0, x1)),
    y: Math.max(0, Math.min(y0, y1)),
    width: Math.max(1, Math.abs(x1 - x0)),
    height: Math.max(1, Math.abs(y1 - y0)),
  };
}

function cropOutputOffset(crop) {
  return {
    dx: Math.floor((FRAME_SIZE - crop.width) / 2),
    dy: Math.floor((FRAME_SIZE - crop.height) / 2),
  };
}

function drawLandmarkGuide(ctx, x0, x1, y, labelText, scale = 1) {
  ctx.save();
  ctx.strokeStyle = "rgba(220, 38, 38, 0.95)";
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.setLineDash([8 * scale, 5 * scale]);
  ctx.beginPath();
  ctx.moveTo(x0, y + 0.5);
  ctx.lineTo(x1, y + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(185, 28, 28, 0.94)";
  ctx.font = `${Math.max(10, 11 * scale)}px sans-serif`;
  ctx.fillText(labelText, x0 + 4 * scale, Math.max(12 * scale, y - 3 * scale));
  ctx.restore();
}

function drawSheetLandmarks(ctx) {
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const crop = cropPreview(row, col);
      const { dy } = cropOutputOffset(crop);
      landmarkOrder.forEach((key) => {
        const outputY = Number(state.landmarkLines[key]);
        const sourceY = crop.y + outputY - dy;
        if (sourceY >= crop.y && sourceY <= crop.y + crop.height) {
          drawLandmarkGuide(ctx, crop.x + 2, crop.x + crop.width - 2, sourceY, landmarkLabels[key]);
        }
      });
    }
  }
}

function drawPreviewLandmarks(ctx) {
  landmarkOrder.forEach((key) => {
    drawLandmarkGuide(ctx, 0, FRAME_SIZE, Number(state.landmarkLines[key]), landmarkLabels[key], 1);
  });
}

function applyConservativeGreenKey(ctx, width, height) {
  if (!state.chromaKey.enabled) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const greenMin = Number(state.chromaKey.greenMin);
  const redBlueMax = Number(state.chromaKey.redBlueMax);
  const greenGap = Number(state.chromaKey.greenGap);
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a === 0) continue;
    if (g >= greenMin && r <= redBlueMax && b <= redBlueMax && g - Math.max(r, b) >= greenGap) {
      data[index + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function buildOutputFrameCanvas(row, col) {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
  if (state.currentImage) {
    const crop = cropPreview(row, col);
    const { dx, dy } = cropOutputOffset(crop);
    ctx.drawImage(state.currentImage, crop.x, crop.y, crop.width, crop.height, dx, dy, crop.width, crop.height);
    applyConservativeGreenKey(ctx, FRAME_SIZE, FRAME_SIZE);
  }
  return canvas;
}

function renderFocusFrame() {
  const { row, col } = state.selectedCell;
  const meta = cellMeta(row, col);
  const crop = meta.crop;
  const out = buildOutputFrameCanvas(row, col);
  const ctx = els.focusCanvas.getContext("2d");
  drawBackground(ctx, FRAME_SIZE, FRAME_SIZE, state.previewBackground, 16);
  ctx.drawImage(out, 0, 0);
  drawPreviewLandmarks(ctx);
  els.focusTitle.textContent = `${directionLabels[meta.direction] || meta.direction} / ${meta.frame}`;
  const { dx, dy } = cropOutputOffset(crop);
  els.focusCropText.textContent = `源 ${crop.width}x${crop.height} / 偏移 ${dx}, ${dy}`;
}

function renderPreviewGrid() {
  els.previewGrid.innerHTML = "";
  const marked = markedCellKeys();
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const key = cellKey(row, col);
      const meta = cellMeta(row, col);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `preview-card${marked.has(key) ? " is-marked" : ""}${
        state.selectedCell.row === row && state.selectedCell.col === col ? " is-selected" : ""
      }`;
      const canvas = document.createElement("canvas");
      canvas.width = FRAME_SIZE;
      canvas.height = FRAME_SIZE;
      const ctx = canvas.getContext("2d");
      drawBackground(ctx, canvas.width, canvas.height, state.previewBackground, 16);
      ctx.drawImage(buildOutputFrameCanvas(row, col), 0, 0);
      drawPreviewLandmarks(ctx);
      const labelNode = document.createElement("span");
      const crop = cropPreview(row, col);
      labelNode.textContent = `${meta.direction} / ${meta.frame} / ${crop.width}x${crop.height}`;
      const markNode = document.createElement("strong");
      markNode.textContent = marked.has(key) ? "已标记问题" : "双击标记";
      card.append(canvas, labelNode, markNode);
      card.addEventListener("click", () => {
        state.selectedCell = { row, col };
        renderManualState();
        autoSaveCurrent("当前单帧已自动保存");
      });
      card.addEventListener("dblclick", () => {
        toggleFrameMark(row, col);
      });
      els.previewGrid.append(card);
    }
  }
}

function toggleFrameMark(row, col) {
  const key = cellKey(row, col);
  const index = state.frameMarks.findIndex((mark) => cellKey(mark.row, mark.col) === key);
  if (index >= 0) {
    state.frameMarks.splice(index, 1);
  } else {
    state.frameMarks.push({
      row,
      col,
      reason: "manual_frame_mark",
    });
    if (state.status === "unchecked") state.status = "needs_fix";
  }
  renderManualState();
  autoSaveCurrent("单帧标记已自动保存");
}

function renderEdges() {
  renderEdgeGrid("x", els.xEdgeGrid);
  renderEdgeGrid("y", els.yEdgeGrid);
}

function renderLandmarks() {
  els.landmarkGrid.innerHTML = "";
  landmarkOrder.forEach((key) => {
    const labelNode = document.createElement("label");
    labelNode.className = "landmark-input";

    const span = document.createElement("span");
    span.textContent = landmarkLabels[key];

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(FRAME_SIZE);
    input.step = "1";
    input.value = String(state.landmarkLines[key]);
    input.addEventListener("input", () => {
      state.landmarkLines[key] = Number(input.value);
      renderManualState();
      autoSaveCurrent("人体比例线已自动保存");
    });

    labelNode.append(span, input);
    els.landmarkGrid.append(labelNode);
  });
}

function renderEdgeGrid(axis, container) {
  container.innerHTML = "";
  state.edges[axis].forEach((value, index) => {
    const labelNode = document.createElement("label");
    labelNode.className = "edge-input";

    const span = document.createElement("span");
    span.textContent = `${axis.toUpperCase()}${index}`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(axis === "x" ? state.currentSourceSize.width : state.currentSourceSize.height);
    input.step = "1";
    input.value = String(value);
    input.dataset.edgeAxis = axis;
    input.dataset.edgeIndex = String(index);
    input.addEventListener("input", () => {
      setEdge(axis, index, Number(input.value));
      renderManualState();
      autoSaveCurrent("红线已自动保存");
    });

    labelNode.append(span, input);
    container.append(labelNode);
  });
}

function syncEdgeInputs() {
  document.querySelectorAll("[data-edge-axis]").forEach((input) => {
    const axis = input.dataset.edgeAxis;
    const index = Number(input.dataset.edgeIndex);
    input.value = String(state.edges[axis][index]);
  });
}

function renderQuickFrameGroup() {
  const shortcuts = [
    { direction: "front", col: 1, label: "正2" },
    { direction: "front", col: 3, label: "正4" },
    { direction: "back", col: 1, label: "背2" },
    { direction: "back", col: 3, label: "背4" },
  ];
  els.quickFrameGroup.innerHTML = "";
  shortcuts.forEach((item) => {
    const row = directionItems().indexOf(item.direction);
    if (row < 0) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedCell.row === row && state.selectedCell.col === item.col ? "is-active" : "";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      state.selectedCell = { row, col: item.col };
      renderManualState();
      autoSaveCurrent("当前单帧已自动保存");
    });
    els.quickFrameGroup.append(button);
  });
}

function renderManualState() {
  els.statusSelect.value = state.status;
  els.issueInputs.forEach((input) => {
    input.checked = state.issues.includes(input.value);
  });
  els.frameMarkSummary.value = `已标记 ${state.frameMarks.length} 帧`;
  els.noteInput.value = state.note;
  els.zoomInput.value = String(state.zoom);
  els.zoomValue.value = `${state.zoom.toFixed(2)}x`;
  els.previewBgSelect.value = state.previewBackground;
  els.greenKeyToggle.checked = state.chromaKey.enabled;
  els.greenMinInput.value = String(state.chromaKey.greenMin);
  els.redBlueMaxInput.value = String(state.chromaKey.redBlueMax);
  els.greenGapInput.value = String(state.chromaKey.greenGap);
  const payload = currentPayload();
  els.jsonOutput.value = payload ? JSON.stringify(payload, null, 2) : "";
  renderQuickFrameGroup();
  drawSheetCanvas();
  renderFocusFrame();
  renderPreviewGrid();
  syncEdgeInputs();
}

function renderCurrentMeta(message = "") {
  const key = currentKey();
  const savedCount = Object.keys(state.saved).length;
  const issueCount = issueEntries().length;
  const localCount = state.localSources.length ? ` / 本地 ${state.localSources.length}` : "";
  els.assetCount.textContent = `${state.sheets.length} 张动作表${localCount} / 已保存 ${savedCount}`;
  if (state.sourceMode === "local") {
    const source = currentLocalSource();
    els.currentTitle.textContent = source ? `本地 / ${source.name}` : "本地";
  } else {
    const sheet = currentSheet();
    els.currentTitle.textContent = sheet ? `${sheetKey(sheet)} (${state.selectedIndex + 1}/${state.filteredSheets.length})` : "";
  }
  const baseMessage = message || (state.saved[key] ? "已保存本张参数" : "本张未保存");
  els.saveState.value = `${baseMessage} / 问题 ${issueCount}`;
  els.saveState.dataset.state = state.saved[key]?.status || "unchecked";
}

function issueEntries() {
  return Object.entries(state.saved)
    .filter(([, value]) => value.status === "needs_fix" || value.status === "regen" || value.issues?.length || value.frameMarks?.length)
    .map(([key, value]) => ({ key, ...value }));
}

function updateCurrentSourceSizeFromImage(image) {
  state.currentSourceSize = {
    width: image.naturalWidth || image.width || DEFAULT_SHEET_SIZE,
    height: image.naturalHeight || image.height || DEFAULT_SHEET_SIZE,
  };
}

function prepareCurrentLoadedImage(image, message = "") {
  state.currentImage = image;
  updateCurrentSourceSizeFromImage(image);
  applySavedForCurrent();
  renderSheetList();
  renderLocalSourceList();
  renderCurrentMeta(message);
  renderEdges();
  renderLandmarks();
  renderManualState();
}

function selectCurrentSource() {
  const requestId = (imageRequestId += 1);
  if (state.sourceMode === "local") {
    const source = currentLocalSource();
    if (!source) return;
    prepareCurrentLoadedImage(source.image);
    return;
  }
  const sheet = currentSheet();
  if (!sheet) return;
  renderSheetList();
  renderLocalSourceList();
  const image = new Image();
  image.onload = () => {
    if (requestId !== imageRequestId) return;
    prepareCurrentLoadedImage(image);
  };
  image.onerror = () => {
    els.saveState.value = `读取失败：${sheetPath(sheet)}`;
    els.saveState.dataset.state = "regen";
  };
  image.src = sheetPath(sheet);
}

function saveCurrent(message = "已保存本张参数") {
  const payload = currentPayload();
  if (!payload) return;
  state.saved[payload.key] = payload;
  writeSaved();
  renderSheetList();
  renderLocalSourceList();
  renderCurrentMeta(message);
  renderManualState();
}

function autoSaveCurrent(message = "已自动保存") {
  const payload = currentPayload();
  if (!payload) return;
  state.saved[payload.key] = payload;
  writeSaved();
  renderSheetList();
  renderLocalSourceList();
  renderCurrentMeta(message);
}

function scheduleAutoSaveCurrent(message = "已自动保存") {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    autoSaveCurrent(message);
  }, 250);
}

async function copyText(text, button, labelText) {
  await navigator.clipboard.writeText(text);
  button.textContent = "已复制";
  window.setTimeout(() => {
    button.textContent = labelText;
  }, 900);
}

function setEdge(axis, index, rawValue) {
  const extent = axis === "x" ? state.currentSourceSize.width : state.currentSourceSize.height;
  const values = state.edges[axis];
  const previous = index > 0 ? values[index - 1] + 1 : 0;
  const next = index < values.length - 1 ? values[index + 1] - 1 : extent;
  const value = Number.isFinite(rawValue) ? Math.round(rawValue) : values[index];
  values[index] = Math.max(previous, Math.min(next, value));
}

function canvasPointFromEvent(event) {
  const rect = els.sheetCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * els.sheetCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * els.sheetCanvas.height;
  return { x, y, rect };
}

function hitTestLine(event) {
  const point = canvasPointFromEvent(event);
  const threshold = Math.max(7, (12 * els.sheetCanvas.width) / point.rect.width);
  let hit = null;
  state.edges.x.forEach((value, index) => {
    const distance = Math.abs(point.x - value);
    if (distance <= threshold && (!hit || distance < hit.distance)) {
      hit = { axis: "x", index, distance };
    }
  });
  state.edges.y.forEach((value, index) => {
    const distance = Math.abs(point.y - value);
    if (distance <= threshold && (!hit || distance < hit.distance)) {
      hit = { axis: "y", index, distance };
    }
  });
  return hit;
}

function bindCanvasDrag() {
  els.sheetCanvas.addEventListener("pointerdown", (event) => {
    const hit = hitTestLine(event);
    if (!hit) return;
    event.preventDefault();
    state.dragging = hit;
    els.sheetCanvas.setPointerCapture(event.pointerId);
  });

  els.sheetCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      const hit = hitTestLine(event);
      els.sheetCanvas.style.cursor = hit?.axis === "x" ? "col-resize" : hit?.axis === "y" ? "row-resize" : "crosshair";
      return;
    }
    event.preventDefault();
    const point = canvasPointFromEvent(event);
    setEdge(state.dragging.axis, state.dragging.index, state.dragging.axis === "x" ? point.x : point.y);
    renderManualState();
    scheduleAutoSaveCurrent("红线已自动保存");
  });

  const stopDrag = (event) => {
    if (!state.dragging) return;
    state.dragging = null;
    try {
      els.sheetCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    autoSaveCurrent("红线已自动保存");
  };
  els.sheetCanvas.addEventListener("pointerup", stopDrag);
  els.sheetCanvas.addEventListener("pointercancel", stopDrag);

  els.sheetCanvas.addEventListener("click", (event) => {
    if (hitTestLine(event)) return;
    const point = canvasPointFromEvent(event);
    const col = Math.max(0, Math.min(3, state.edges.x.findIndex((edge, index) => index < 4 && point.x >= edge && point.x <= state.edges.x[index + 1])));
    const row = Math.max(0, Math.min(3, state.edges.y.findIndex((edge, index) => index < 4 && point.y >= edge && point.y <= state.edges.y[index + 1])));
    if (row >= 0 && col >= 0) {
      state.selectedCell = { row, col };
      renderManualState();
      autoSaveCurrent("当前单帧已自动保存");
    }
  });
}

function frameOutputName(row, col, forZip = false) {
  const meta = cellMeta(row, col);
  if (state.sourceMode === "pack") {
    const sheet = currentSheet();
    const path = `hairstyles/${sheet.hair}/outfits/${sheet.outfit}/frames/${sheet.action}/${meta.direction}/${meta.direction}_${sheet.action}_${meta.frame}.png`;
    return forZip ? path : `${sheet.hair}__${sheet.outfit}__${sheet.action}__${meta.direction}__${meta.frame}.png`;
  }
  const base = sanitizePathPart(currentLocalSource()?.name || "local-sheet");
  return forZip ? `${base}/${meta.direction}_${meta.frame}.png` : `${base}__${meta.direction}__${meta.frame}.png`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 导出失败"));
    }, "image/png");
  });
}

async function blobToUint8Array(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function downloadCurrentFrame() {
  const { row, col } = state.selectedCell;
  const canvas = buildOutputFrameCanvas(row, col);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, frameOutputName(row, col));
}

async function downloadCurrentZip() {
  const files = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const canvas = buildOutputFrameCanvas(row, col);
      const blob = await canvasToBlob(canvas);
      files.push({
        name: frameOutputName(row, col, true),
        data: await blobToUint8Array(blob),
      });
    }
  }
  const key = sanitizePathPart(currentKey() || "manual-crop");
  downloadBlob(createZipBlob(files), `${key}_manual_314_frames.zip`);
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(data) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = crcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
  const day = date.getDate() & 0x1f;
  const month = (date.getMonth() + 1) & 0x0f;
  const year = Math.max(0, date.getFullYear() - 1980) & 0x7f;
  return {
    time,
    date: (year << 9) | (month << 5) | day,
  };
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    localParts.push(local, file.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + file.data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`读取图片失败：${url}`));
    image.src = url;
  });
}

async function handleLocalFiles(files) {
  const fileList = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
  if (!fileList.length) return;
  const loaded = [];
  for (const file of fileList) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImageFromUrl(url);
      loaded.push({
        key: `local/${file.name}/${file.size}/${file.lastModified}`,
        name: file.name,
        url,
        image,
      });
    } catch (error) {
      URL.revokeObjectURL(url);
      els.saveState.value = String(error.message || error);
    }
  }
  state.localSources.push(...loaded);
  if (loaded.length) {
    state.sourceMode = "local";
    state.selectedLocalIndex = state.localSources.length - loaded.length;
    renderLocalSourceList();
    selectCurrentSource();
  }
}

async function runButtonTask(button, busyText, doneText, task) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    await task();
    button.textContent = doneText;
  } catch (error) {
    button.textContent = "失败";
    els.saveState.value = String(error.message || error);
    els.saveState.dataset.state = "regen";
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, 900);
  }
}

function bindControls() {
  els.hairFilter.addEventListener("change", () => {
    state.filters.hair = els.hairFilter.value;
    state.selectedIndex = 0;
    state.sourceMode = "pack";
    applyFilters();
    selectCurrentSource();
  });
  els.outfitFilter.addEventListener("change", () => {
    state.filters.outfit = els.outfitFilter.value;
    state.selectedIndex = 0;
    state.sourceMode = "pack";
    applyFilters();
    selectCurrentSource();
  });
  els.actionFilter.addEventListener("change", () => {
    state.filters.action = els.actionFilter.value;
    state.selectedIndex = 0;
    state.sourceMode = "pack";
    applyFilters();
    selectCurrentSource();
  });

  els.localFileInput.addEventListener("change", () => {
    void handleLocalFiles(els.localFileInput.files);
  });

  els.prevButton.addEventListener("click", () => {
    if (state.sourceMode === "local") {
      state.selectedLocalIndex = Math.max(0, state.selectedLocalIndex - 1);
    } else {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
    }
    selectCurrentSource();
  });
  els.nextButton.addEventListener("click", () => {
    if (state.sourceMode === "local") {
      state.selectedLocalIndex = Math.min(state.localSources.length - 1, state.selectedLocalIndex + 1);
    } else {
      state.selectedIndex = Math.min(state.filteredSheets.length - 1, state.selectedIndex + 1);
    }
    selectCurrentSource();
  });
  els.nextUncheckedButton.addEventListener("click", () => {
    if (state.sourceMode === "local") {
      const start = state.selectedLocalIndex + 1;
      const found = state.localSources.findIndex((source, index) => index >= start && (!state.saved[source.key] || state.saved[source.key].status === "unchecked"));
      if (found >= 0) {
        state.selectedLocalIndex = found;
        selectCurrentSource();
      }
      return;
    }
    const start = state.selectedIndex + 1;
    const found = state.filteredSheets.findIndex((sheet, index) => {
      const saved = state.saved[sheetKey(sheet)];
      return index >= start && (!saved || saved.status === "unchecked");
    });
    if (found >= 0) {
      state.selectedIndex = found;
      selectCurrentSource();
    }
  });

  els.zoomInput.addEventListener("input", () => {
    state.zoom = Number(els.zoomInput.value);
    renderManualState();
    autoSaveCurrent("缩放已自动保存");
  });

  els.previewBgSelect.addEventListener("change", () => {
    state.previewBackground = els.previewBgSelect.value;
    renderManualState();
  });

  els.greenKeyToggle.addEventListener("change", () => {
    state.chromaKey.enabled = els.greenKeyToggle.checked;
    renderManualState();
    autoSaveCurrent("抠图参数已自动保存");
  });
  els.greenMinInput.addEventListener("input", () => {
    state.chromaKey.greenMin = Number(els.greenMinInput.value);
    renderManualState();
    scheduleAutoSaveCurrent("抠图参数已自动保存");
  });
  els.redBlueMaxInput.addEventListener("input", () => {
    state.chromaKey.redBlueMax = Number(els.redBlueMaxInput.value);
    renderManualState();
    scheduleAutoSaveCurrent("抠图参数已自动保存");
  });
  els.greenGapInput.addEventListener("input", () => {
    state.chromaKey.greenGap = Number(els.greenGapInput.value);
    renderManualState();
    scheduleAutoSaveCurrent("抠图参数已自动保存");
  });

  els.equalPresetButton.addEventListener("click", () => {
    state.edges = defaultEdges();
    renderEdges();
    renderManualState();
    autoSaveCurrent("红线已自动保存");
  });
  els.round314PresetButton.addEventListener("click", () => {
    state.edges = round314Edges();
    renderEdges();
    renderManualState();
    autoSaveCurrent("红线已自动保存");
  });
  els.resetButton.addEventListener("click", () => {
    const key = currentKey();
    if (key) delete state.saved[key];
    state.edges = defaultEdges();
    state.landmarkLines = defaultLandmarkLines();
    state.status = "unchecked";
    state.issues = [];
    state.frameMarks = [];
    state.note = "";
    writeSaved();
    renderSheetList();
    renderLocalSourceList();
    renderCurrentMeta();
    renderEdges();
    renderLandmarks();
    renderManualState();
  });

  els.resetLandmarkButton.addEventListener("click", () => {
    state.landmarkLines = defaultLandmarkLines();
    renderLandmarks();
    renderManualState();
    autoSaveCurrent("人体比例线已自动保存");
  });

  els.statusSelect.addEventListener("change", () => {
    state.status = els.statusSelect.value;
    renderManualState();
    autoSaveCurrent("状态已自动保存");
  });
  els.issueInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.issues = els.issueInputs.filter((item) => item.checked).map((item) => item.value);
      if (state.issues.length && state.status === "unchecked") {
        state.status = "needs_fix";
      }
      renderManualState();
      autoSaveCurrent("问题标记已自动保存");
    });
  });
  els.noteInput.addEventListener("input", () => {
    state.note = els.noteInput.value;
    scheduleAutoSaveCurrent("备注已自动保存");
  });
  els.saveButton.addEventListener("click", () => saveCurrent());
  els.downloadFrameButton.addEventListener("click", () => {
    void runButtonTask(els.downloadFrameButton, "导出中", "已下载", downloadCurrentFrame);
  });
  els.downloadZipButton.addEventListener("click", () => {
    void runButtonTask(els.downloadZipButton, "打包中", "已下载", downloadCurrentZip);
  });
  els.markRegenButton.addEventListener("click", () => {
    state.status = "regen";
    if (!state.issues.includes("needs_regeneration")) {
      state.issues = [...state.issues, "needs_regeneration"];
    }
    saveCurrent();
  });
  els.clearFrameMarksButton.addEventListener("click", () => {
    state.frameMarks = [];
    renderManualState();
    autoSaveCurrent("单帧标记已清除并保存");
  });
  els.copyCurrentButton.addEventListener("click", () => copyText(els.jsonOutput.value, els.copyCurrentButton, "复制本张 JSON"));
  els.copyAllButton.addEventListener("click", () => copyText(JSON.stringify(state.saved, null, 2), els.copyAllButton, "复制全部已保存"));
  els.copyIssuesButton.addEventListener("click", () => copyText(JSON.stringify(issueEntries(), null, 2), els.copyIssuesButton, "复制问题清单"));

  bindCanvasDrag();
}

async function init() {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) throw new Error(`Failed to load ${MANIFEST_URL}`);
  state.manifest = await response.json();
  if (!state.manifest.actions.includes(state.filters.action)) {
    state.filters.action = "all";
  }
  loadSaved();
  buildSheets();
  applyFilters();
  renderFilters();
  bindControls();
  selectCurrentSource();
}

init().catch((error) => {
  document.body.innerHTML = `<pre>${String(error.stack || error)}</pre>`;
});
