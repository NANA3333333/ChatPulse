const MANIFEST_URL = "./sources/manifest.json";
const DEFAULT_SRC = "./sources/codex-clipboard-f004766a-8854-4e05-b2e1-0d4fcb5a7884.png";
const STORAGE_KEY = "large-image-manual-red-lines-v2";
const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 4;

const state = {
  image: null,
  keyedCanvas: null,
  sourceItems: [],
  sourceIndex: 0,
  sourceUrl: "",
  sourceName: "",
  width: 1254,
  height: 1254,
  rows: 5,
  cols: 4,
  zoom: 0.72,
  background: "checker",
  chromaKey: {
    enabled: true,
    greenMin: 120,
    redBlueMax: 180,
    greenGap: 45,
    spillPasses: 5,
    spillGap: 6,
  },
  edges: {
    x: [],
    y: [],
  },
  selected: {
    row: 0,
    col: 0,
  },
  saved: {},
  dragging: null,
};

const els = {
  imageMeta: document.getElementById("imageMeta"),
  sourceList: document.getElementById("sourceList"),
  prevImageButton: document.getElementById("prevImageButton"),
  nextImageButton: document.getElementById("nextImageButton"),
  fileInput: document.getElementById("fileInput"),
  sourceName: document.getElementById("sourceName"),
  colsInput: document.getElementById("colsInput"),
  rowsInput: document.getElementById("rowsInput"),
  zoomInput: document.getElementById("zoomInput"),
  backgroundSelect: document.getElementById("backgroundSelect"),
  keyToggle: document.getElementById("keyToggle"),
  greenMinInput: document.getElementById("greenMinInput"),
  redBlueMaxInput: document.getElementById("redBlueMaxInput"),
  greenGapInput: document.getElementById("greenGapInput"),
  spillPassesInput: document.getElementById("spillPassesInput"),
  spillGapInput: document.getElementById("spillGapInput"),
  equalButton: document.getElementById("equalButton"),
  resetButton: document.getElementById("resetButton"),
  focusCanvas: document.getElementById("focusCanvas"),
  focusMeta: document.getElementById("focusMeta"),
  downloadCellButton: document.getElementById("downloadCellButton"),
  xEdgeGrid: document.getElementById("xEdgeGrid"),
  yEdgeGrid: document.getElementById("yEdgeGrid"),
  saveButton: document.getElementById("saveButton"),
  copyJsonButton: document.getElementById("copyJsonButton"),
  saveState: document.getElementById("saveState"),
  jsonOutput: document.getElementById("jsonOutput"),
  prevCellButton: document.getElementById("prevCellButton"),
  nextCellButton: document.getElementById("nextCellButton"),
  activeCellTitle: document.getElementById("activeCellTitle"),
  imageCanvas: document.getElementById("imageCanvas"),
  previewGrid: document.getElementById("previewGrid"),
};

let autoSaveTimer = null;

function params() {
  return new URLSearchParams(window.location.search);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sourceRows(item) {
  return clamp(Number(item?.rows) || DEFAULT_ROWS, 1, 12);
}

function sourceCols(item) {
  return clamp(Number(item?.cols) || DEFAULT_COLS, 1, 12);
}

function splitEdges(extent, count) {
  return Array.from({ length: count + 1 }, (_, index) => (index === count ? extent : Math.round((extent * index) / count)));
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

function sourceKey() {
  return `${state.sourceName}|${state.width}x${state.height}|${state.rows}x${state.cols}`;
}

function normalizeEdges(values, extent, count) {
  const fallback = splitEdges(extent, count);
  if (!Array.isArray(values) || values.length !== count + 1) return fallback;
  const edges = values.map((value, index) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : fallback[index];
  });
  edges[0] = clamp(edges[0], 0, Math.max(0, extent - count));
  for (let index = 1; index < edges.length; index += 1) {
    edges[index] = clamp(edges[index], edges[index - 1] + 1, extent - (count - index));
  }
  edges[count] = clamp(edges[count], edges[count - 1] + 1, extent);
  return edges;
}

function resetEqualEdges() {
  state.edges = {
    x: splitEdges(state.width, state.cols),
    y: splitEdges(state.height, state.rows),
  };
}

function applySavedOrDefault() {
  const saved = state.saved[sourceKey()];
  state.edges = {
    x: normalizeEdges(saved?.edges?.x, state.width, state.cols),
    y: normalizeEdges(saved?.edges?.y, state.height, state.rows),
  };
  state.selected = saved?.selected || { row: 0, col: 0 };
  clampSelected();
}

function clampSelected() {
  state.selected = {
    row: clamp(Number(state.selected.row) || 0, 0, state.rows - 1),
    col: clamp(Number(state.selected.col) || 0, 0, state.cols - 1),
  };
}

function crop(row, col) {
  const x0 = state.edges.x[col];
  const x1 = state.edges.x[col + 1];
  const y0 = state.edges.y[row];
  const y1 = state.edges.y[row + 1];
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.max(1, Math.abs(x1 - x0)),
    height: Math.max(1, Math.abs(y1 - y0)),
  };
}

function payload() {
  return {
    sourceName: state.sourceName,
    sourceUrl: state.sourceUrl,
    sourceSize: [state.width, state.height],
    grid: {
      rows: state.rows,
      cols: state.cols,
    },
    selected: state.selected,
    chromaKey: { ...state.chromaKey },
    edges: state.edges,
    cells: Array.from({ length: state.rows }, (_, row) =>
      Array.from({ length: state.cols }, (_, col) => ({
        row,
        col,
        name: `row_${String(row + 1).padStart(2, "0")}__col_${String(col + 1).padStart(2, "0")}`,
        crop: crop(row, col),
      })),
    ).flat(),
  };
}

function drawChecker(ctx, width, height, size = 24) {
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#f7fafc" : "#d9e2ec";
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawBackground(ctx, width, height, mode) {
  ctx.clearRect(0, 0, width, height);
  if (mode === "checker" || mode === "raw") {
    drawChecker(ctx, width, height);
  } else if (mode === "green") {
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, width, height);
  } else if (mode === "black") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
  } else if (mode === "white") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
  }
}

function refreshKeyedCanvas() {
  if (!state.image) return;
  const canvas = document.createElement("canvas");
  canvas.width = state.width;
  canvas.height = state.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.image, 0, 0);
  if (state.chromaKey.enabled) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const greenMin = Number(state.chromaKey.greenMin);
    const redBlueMax = Number(state.chromaKey.redBlueMax);
    const greenGap = Number(state.chromaKey.greenGap);
    const width = canvas.width;
    const height = canvas.height;
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    const isGreenBackground = (pixelIndex) => {
      const offset = pixelIndex * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a === 0) return false;
      return g >= greenMin && r <= redBlueMax && b <= redBlueMax && g - Math.max(r, b) >= greenGap;
    };
    const enqueue = (pixelIndex) => {
      if (visited[pixelIndex] || !isGreenBackground(pixelIndex)) return;
      visited[pixelIndex] = 1;
      queue[tail] = pixelIndex;
      tail += 1;
    };
    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }
    while (head < tail) {
      const pixelIndex = queue[head];
      head += 1;
      data[pixelIndex * 4 + 3] = 0;
      const x = pixelIndex % width;
      const canLeft = x > 0;
      const canRight = x < width - 1;
      const canUp = pixelIndex >= width;
      const canDown = pixelIndex < width * (height - 1);
      if (canLeft) enqueue(pixelIndex - 1);
      if (canRight) enqueue(pixelIndex + 1);
      if (canUp) enqueue(pixelIndex - width);
      if (canDown) enqueue(pixelIndex + width);
      if (canLeft && canUp) enqueue(pixelIndex - width - 1);
      if (canRight && canUp) enqueue(pixelIndex - width + 1);
      if (canLeft && canDown) enqueue(pixelIndex + width - 1);
      if (canRight && canDown) enqueue(pixelIndex + width + 1);
    }
    peelGreenSpill(data, width, height);
    removeRemainingGreen(data);
    ctx.putImageData(imageData, 0, 0);
  }
  state.keyedCanvas = canvas;
}

function removeRemainingGreen(data) {
  const spillGap = clamp(Number(state.chromaKey.spillGap) || 6, 0, 80);
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a === 0) continue;
    if (g >= 35 && g - Math.max(r, b) >= spillGap) {
      data[index + 3] = 0;
    }
  }
}

function peelGreenSpill(data, width, height) {
  const passes = clamp(Number(state.chromaKey.spillPasses) || 0, 0, 8);
  const spillGap = clamp(Number(state.chromaKey.spillGap) || 0, 0, 80);
  if (!passes || !spillGap) return;
  const pixelCount = width * height;
  const remove = new Uint8Array(pixelCount);
  const hasTransparentNeighbor = (pixelIndex) => {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
        if (nx === x && ny === y) continue;
        if (data[(ny * width + nx) * 4 + 3] === 0) return true;
      }
    }
    return false;
  };
  const isGreenSpill = (pixelIndex) => {
    const offset = pixelIndex * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    if (a === 0) return false;
    const maxOther = Math.max(r, b);
    return g >= 42 && g - maxOther >= spillGap;
  };
  for (let pass = 0; pass < passes; pass += 1) {
    remove.fill(0);
    let changed = false;
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      if (!isGreenSpill(pixelIndex) || !hasTransparentNeighbor(pixelIndex)) continue;
      remove[pixelIndex] = 1;
      changed = true;
    }
    if (!changed) break;
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      if (remove[pixelIndex]) data[pixelIndex * 4 + 3] = 0;
    }
  }
}

function displayImageSource() {
  if (state.background === "raw" || !state.chromaKey.enabled) return state.image;
  return state.keyedCanvas || state.image;
}

function resizeCanvas() {
  els.imageCanvas.width = state.width;
  els.imageCanvas.height = state.height;
  els.imageCanvas.style.width = `${Math.round(state.width * state.zoom)}px`;
  els.imageCanvas.style.height = "auto";
}

function drawMainCanvas() {
  resizeCanvas();
  const canvas = els.imageCanvas;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.width, canvas.height, state.background);
  const source = displayImageSource();
  if (source) ctx.drawImage(source, 0, 0);

  const selectedCrop = crop(state.selected.row, state.selected.col);
  ctx.save();
  ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
  ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
  ctx.lineWidth = 5;
  ctx.fillRect(selectedCrop.x, selectedCrop.y, selectedCrop.width, selectedCrop.height);
  ctx.strokeRect(selectedCrop.x + 2.5, selectedCrop.y + 2.5, selectedCrop.width - 5, selectedCrop.height - 5);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(239, 68, 68, 0.98)";
  ctx.fillStyle = "rgba(239, 68, 68, 0.98)";
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
}

function drawCropToCanvas(targetCanvas, row, col, fit = true) {
  const c = crop(row, col);
  const ctx = targetCanvas.getContext("2d");
  drawChecker(ctx, targetCanvas.width, targetCanvas.height, 16);
  const source = displayImageSource();
  if (!source) return;
  if (!fit) {
    ctx.drawImage(source, c.x, c.y, c.width, c.height, 0, 0, targetCanvas.width, targetCanvas.height);
    return;
  }
  const scale = Math.min(targetCanvas.width / c.width, targetCanvas.height / c.height);
  const dw = Math.round(c.width * scale);
  const dh = Math.round(c.height * scale);
  const dx = Math.floor((targetCanvas.width - dw) / 2);
  const dy = Math.floor((targetCanvas.height - dh) / 2);
  ctx.drawImage(source, c.x, c.y, c.width, c.height, dx, dy, dw, dh);
}

function renderFocus() {
  drawCropToCanvas(els.focusCanvas, state.selected.row, state.selected.col);
  const c = crop(state.selected.row, state.selected.col);
  const title = `row ${String(state.selected.row + 1).padStart(2, "0")} / col ${String(state.selected.col + 1).padStart(2, "0")}`;
  els.activeCellTitle.textContent = title;
  els.focusMeta.value = `${title} / x:${c.x}-${c.x + c.width} y:${c.y}-${c.y + c.height} / ${c.width}x${c.height}`;
}

function renderPreviews() {
  els.previewGrid.innerHTML = "";
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `preview-card${row === state.selected.row && col === state.selected.col ? " is-active" : ""}`;
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 180;
      drawCropToCanvas(canvas, row, col);
      const label = document.createElement("span");
      const c = crop(row, col);
      label.textContent = `${String(row + 1).padStart(2, "0")} / ${String(col + 1).padStart(2, "0")} / ${c.width}x${c.height}`;
      button.append(canvas, label);
      button.addEventListener("click", () => {
        state.selected = { row, col };
        renderAll();
        scheduleSave("已自动保存当前块");
      });
      els.previewGrid.append(button);
    }
  }
}

function renderSourceList() {
  els.sourceList.innerHTML = "";
  state.sourceItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `source-row${index === state.sourceIndex ? " is-active" : ""}`;
    const order = document.createElement("strong");
    order.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.textContent = `${item.name} / ${sourceRows(item)}x${sourceCols(item)}`;
    button.append(order, name);
    button.addEventListener("click", () => {
      void selectSource(index);
    });
    els.sourceList.append(button);
  });
}

function renderEdgeInputs() {
  renderEdgeGrid("x", els.xEdgeGrid);
  renderEdgeGrid("y", els.yEdgeGrid);
}

function renderEdgeGrid(axis, container) {
  container.innerHTML = "";
  state.edges[axis].forEach((value, index) => {
    const label = document.createElement("label");
    label.className = "edge-input";
    const span = document.createElement("span");
    span.textContent = `${axis.toUpperCase()}${index}`;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.min = "0";
    input.max = String(axis === "x" ? state.width : state.height);
    input.value = String(value);
    input.addEventListener("input", () => {
      setEdge(axis, index, Number(input.value));
      renderAll(false);
      scheduleSave("红线已自动保存");
    });
    label.append(span, input);
    container.append(label);
  });
}

function renderMeta() {
  els.imageMeta.textContent = `${state.sourceIndex + 1}/${state.sourceItems.length || 1} / ${state.width}x${state.height} / ${state.rows} 行 x ${state.cols} 列`;
  els.sourceName.value = state.sourceName;
  els.rowsInput.value = String(state.rows);
  els.colsInput.value = String(state.cols);
  els.zoomInput.value = String(state.zoom);
  els.backgroundSelect.value = state.background;
  els.keyToggle.checked = state.chromaKey.enabled;
  els.greenMinInput.value = String(state.chromaKey.greenMin);
  els.redBlueMaxInput.value = String(state.chromaKey.redBlueMax);
  els.greenGapInput.value = String(state.chromaKey.greenGap);
  els.spillPassesInput.value = String(state.chromaKey.spillPasses);
  els.spillGapInput.value = String(state.chromaKey.spillGap);
  els.jsonOutput.value = JSON.stringify(payload(), null, 2);
}

function renderAll(renderInputs = true) {
  clampSelected();
  renderMeta();
  renderSourceList();
  drawMainCanvas();
  renderFocus();
  renderPreviews();
  if (renderInputs) renderEdgeInputs();
}

function setEdge(axis, index, rawValue) {
  const count = axis === "x" ? state.cols : state.rows;
  const extent = axis === "x" ? state.width : state.height;
  const edges = state.edges[axis];
  const min = index === 0 ? 0 : edges[index - 1] + 1;
  const max = index === count ? extent : edges[index + 1] - 1;
  const value = Number.isFinite(rawValue) ? Math.round(rawValue) : edges[index];
  edges[index] = clamp(value, min, max);
}

function canvasPoint(event) {
  const rect = els.imageCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * els.imageCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * els.imageCanvas.height,
    rect,
  };
}

function hitTest(event) {
  const point = canvasPoint(event);
  const threshold = Math.max(7, (12 * els.imageCanvas.width) / point.rect.width);
  let hit = null;
  state.edges.x.forEach((value, index) => {
    const distance = Math.abs(point.x - value);
    if (distance <= threshold && (!hit || distance < hit.distance)) hit = { axis: "x", index, distance };
  });
  state.edges.y.forEach((value, index) => {
    const distance = Math.abs(point.y - value);
    if (distance <= threshold && (!hit || distance < hit.distance)) hit = { axis: "y", index, distance };
  });
  return hit;
}

function selectCellFromPoint(point) {
  const col = state.edges.x.findIndex((edge, index) => index < state.cols && point.x >= edge && point.x <= state.edges.x[index + 1]);
  const row = state.edges.y.findIndex((edge, index) => index < state.rows && point.y >= edge && point.y <= state.edges.y[index + 1]);
  if (row >= 0 && col >= 0) state.selected = { row, col };
}

function bindCanvas() {
  els.imageCanvas.addEventListener("pointerdown", (event) => {
    const hit = hitTest(event);
    if (!hit) return;
    event.preventDefault();
    state.dragging = hit;
    els.imageCanvas.setPointerCapture(event.pointerId);
  });
  els.imageCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      const hit = hitTest(event);
      els.imageCanvas.style.cursor = hit?.axis === "x" ? "col-resize" : hit?.axis === "y" ? "row-resize" : "crosshair";
      return;
    }
    event.preventDefault();
    const point = canvasPoint(event);
    setEdge(state.dragging.axis, state.dragging.index, state.dragging.axis === "x" ? point.x : point.y);
    renderAll(false);
    scheduleSave("红线已自动保存");
  });
  const stopDrag = (event) => {
    if (!state.dragging) return;
    state.dragging = null;
    try {
      els.imageCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // Browser may release capture first.
    }
    save("红线已保存");
  };
  els.imageCanvas.addEventListener("pointerup", stopDrag);
  els.imageCanvas.addEventListener("pointercancel", stopDrag);
  els.imageCanvas.addEventListener("click", (event) => {
    if (hitTest(event)) return;
    selectCellFromPoint(canvasPoint(event));
    renderAll();
    scheduleSave("已自动保存当前块");
  });
}

function loadImage(url, name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片读取失败：${name || url}`));
    image.src = url;
  });
}

async function selectSource(index) {
  if (!state.sourceItems.length) return;
  state.sourceIndex = clamp(index, 0, state.sourceItems.length - 1);
  const item = state.sourceItems[state.sourceIndex];
  await setImage(item);
}

async function setImage(itemOrUrl, name) {
  const item = typeof itemOrUrl === "string" ? { src: itemOrUrl, name } : itemOrUrl;
  state.sourceUrl = item.src;
  state.sourceName = item.name || item.src.split("/").pop() || "image";
  state.rows = sourceRows(item);
  state.cols = sourceCols(item);
  state.image = await loadImage(item.src, state.sourceName);
  state.width = state.image.naturalWidth || state.image.width;
  state.height = state.image.naturalHeight || state.image.height;
  refreshKeyedCanvas();
  applySavedOrDefault();
  renderAll();
  els.saveState.value = "已载入并抠绿";
}

function save(message = "已保存红线") {
  state.saved[sourceKey()] = payload();
  writeSaved();
  els.saveState.value = message;
  els.jsonOutput.value = JSON.stringify(payload(), null, 2);
}

function scheduleSave(message) {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => save(message), 250);
}

async function copyJson() {
  await navigator.clipboard.writeText(els.jsonOutput.value);
  els.copyJsonButton.textContent = "已复制";
  window.setTimeout(() => {
    els.copyJsonButton.textContent = "复制 JSON";
  }, 900);
}

function downloadCurrentCell() {
  const c = crop(state.selected.row, state.selected.col);
  const source = displayImageSource();
  const canvas = document.createElement("canvas");
  canvas.width = c.width;
  canvas.height = c.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(source, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.sourceName.replace(/\.[^.]+$/, "")}__row_${String(state.selected.row + 1).padStart(2, "0")}__col_${String(state.selected.col + 1).padStart(2, "0")}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function updateGridFromInputs() {
  state.cols = clamp(Number(els.colsInput.value) || DEFAULT_COLS, 1, 12);
  state.rows = clamp(Number(els.rowsInput.value) || DEFAULT_ROWS, 1, 12);
  const item = state.sourceItems[state.sourceIndex];
  if (item) {
    item.rows = state.rows;
    item.cols = state.cols;
    renderSourceList();
  }
  resetEqualEdges();
  clampSelected();
  renderAll();
  save("行列已更新，红线已等分");
}

function updateKeySettings() {
  state.chromaKey = {
    enabled: els.keyToggle.checked,
    greenMin: clamp(Number(els.greenMinInput.value) || 120, 0, 255),
    redBlueMax: clamp(Number(els.redBlueMaxInput.value) || 180, 0, 255),
    greenGap: clamp(Number(els.greenGapInput.value) || 45, 0, 255),
    spillPasses: clamp(Number(els.spillPassesInput.value) || 0, 0, 8),
    spillGap: clamp(Number(els.spillGapInput.value) || 6, 0, 80),
  };
  refreshKeyedCanvas();
  renderAll(false);
  scheduleSave("抠图参数已保存");
}

function bindControls() {
  els.prevImageButton.addEventListener("click", () => {
    void selectSource(state.sourceIndex - 1);
  });
  els.nextImageButton.addEventListener("click", () => {
    void selectSource(state.sourceIndex + 1);
  });
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    state.sourceItems.push({ name: file.name, src, local: true, rows: state.rows, cols: state.cols });
    void selectSource(state.sourceItems.length - 1);
  });
  els.colsInput.addEventListener("change", updateGridFromInputs);
  els.rowsInput.addEventListener("change", updateGridFromInputs);
  els.zoomInput.addEventListener("input", () => {
    state.zoom = Number(els.zoomInput.value);
    renderAll(false);
  });
  els.backgroundSelect.addEventListener("change", () => {
    state.background = els.backgroundSelect.value;
    renderAll(false);
  });
  els.keyToggle.addEventListener("change", updateKeySettings);
  els.greenMinInput.addEventListener("input", updateKeySettings);
  els.redBlueMaxInput.addEventListener("input", updateKeySettings);
  els.greenGapInput.addEventListener("input", updateKeySettings);
  els.spillPassesInput.addEventListener("input", updateKeySettings);
  els.spillGapInput.addEventListener("input", updateKeySettings);
  els.equalButton.addEventListener("click", () => {
    resetEqualEdges();
    renderAll();
    save("红线已等分");
  });
  els.resetButton.addEventListener("click", () => {
    applySavedOrDefault();
    renderAll();
    els.saveState.value = "已恢复保存值";
  });
  els.saveButton.addEventListener("click", () => save());
  els.copyJsonButton.addEventListener("click", () => {
    void copyJson();
  });
  els.downloadCellButton.addEventListener("click", downloadCurrentCell);
  els.prevCellButton.addEventListener("click", () => {
    const index = state.selected.row * state.cols + state.selected.col;
    const next = clamp(index - 1, 0, state.rows * state.cols - 1);
    state.selected = { row: Math.floor(next / state.cols), col: next % state.cols };
    renderAll();
    scheduleSave("已自动保存当前块");
  });
  els.nextCellButton.addEventListener("click", () => {
    const index = state.selected.row * state.cols + state.selected.col;
    const next = clamp(index + 1, 0, state.rows * state.cols - 1);
    state.selected = { row: Math.floor(next / state.cols), col: next % state.cols };
    renderAll();
    scheduleSave("已自动保存当前块");
  });
  bindCanvas();
}

async function loadSourceItems() {
  const urlParams = params();
  const explicitSrc = urlParams.get("src");
  if (explicitSrc) {
    return [{
      name: urlParams.get("name") || explicitSrc.split("/").pop() || "image",
      src: explicitSrc,
      rows: Number(urlParams.get("rows")) || DEFAULT_ROWS,
      cols: Number(urlParams.get("cols")) || DEFAULT_COLS,
    }];
  }
  try {
    const response = await fetch(MANIFEST_URL);
    if (response.ok) return response.json();
  } catch {
    // Fall back below.
  }
  return [{ name: "codex-clipboard-062b72e0-82b1-4669-aad7-8b3fe69b1aaf.png", src: DEFAULT_SRC }];
}

function requestedSourceIndex(items, urlParams) {
  const source = urlParams.get("source");
  if (source) {
    const byName = items.findIndex((item) => item.name === source || item.src.includes(source));
    if (byName >= 0) return byName;
  }
  const index = Number(urlParams.get("index"));
  if (Number.isFinite(index)) return clamp(Math.round(index), 0, Math.max(0, items.length - 1));
  return 0;
}

async function init() {
  loadSaved();
  const urlParams = params();
  state.rows = clamp(Number(urlParams.get("rows")) || DEFAULT_ROWS, 1, 12);
  state.cols = clamp(Number(urlParams.get("cols")) || DEFAULT_COLS, 1, 12);
  state.zoom = Number(urlParams.get("zoom")) || state.zoom;
  bindControls();
  state.sourceItems = await loadSourceItems();
  renderSourceList();
  await selectSource(requestedSourceIndex(state.sourceItems, urlParams));
}

init().catch((error) => {
  document.body.innerHTML = `<pre>${String(error.stack || error)}</pre>`;
});
