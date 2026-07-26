const ACTION_ORDER = ["shy", "cry", "run", "crouch", "combat", "walk"];
const DEFAULT_HAIR = "03_high_ponytail";
const DEFAULT_OUTFIT = "04_winter_jacket";

const els = {
  meta: document.getElementById("meta"),
  hairSelect: document.getElementById("hairSelect"),
  outfitSelect: document.getElementById("outfitSelect"),
  includeWalk: document.getElementById("includeWalk"),
  copyUrlButton: document.getElementById("copyUrlButton"),
  comboName: document.getElementById("comboName"),
  actionList: document.getElementById("actionList"),
  grid: document.getElementById("grid"),
};

let manifest = null;

function params() {
  return new URLSearchParams(window.location.search);
}

function labelName(value) {
  return value.replace(/_/g, " ");
}

function option(select, value) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = labelName(value);
  select.append(element);
}

function sortedActions(items) {
  return [...new Set(items.map((item) => item.action))].sort((a, b) => {
    const ai = ACTION_ORDER.indexOf(a);
    const bi = ACTION_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
}

function sortedPoses(items) {
  return [...items].sort((a, b) => {
    const ap = Number(a.pose);
    const bp = Number(b.pose);
    if (Number.isFinite(ap) && Number.isFinite(bp)) return ap - bp;
    return String(a.pose).localeCompare(String(b.pose));
  });
}

function currentUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("hair", els.hairSelect.value);
  url.searchParams.set("outfit", els.outfitSelect.value);
  if (els.includeWalk.checked) {
    url.searchParams.set("walk", "1");
  } else {
    url.searchParams.delete("walk");
  }
  return url;
}

function syncUrl() {
  window.history.replaceState(null, "", currentUrl());
}

function renderSelects() {
  els.hairSelect.innerHTML = "";
  els.outfitSelect.innerHTML = "";
  manifest.hairs.forEach((hair) => option(els.hairSelect, hair));
  manifest.outfits.forEach((outfit) => option(els.outfitSelect, outfit));

  const urlParams = params();
  const hair = urlParams.get("hair") || DEFAULT_HAIR;
  const outfit = urlParams.get("outfit") || DEFAULT_OUTFIT;
  els.hairSelect.value = manifest.hairs.includes(hair) ? hair : manifest.hairs[0];
  els.outfitSelect.value = manifest.outfits.includes(outfit) ? outfit : manifest.outfits[0];
  els.includeWalk.checked = urlParams.get("walk") === "1";
}

function render() {
  const hair = els.hairSelect.value;
  const outfit = els.outfitSelect.value;
  const includeWalk = els.includeWalk.checked;
  const allItems = manifest.items.filter((item) => item.hair === hair && item.outfit === outfit);
  const items = allItems.filter((item) => includeWalk || item.action !== "walk");
  const actions = sortedActions(items);

  els.meta.value = `${manifest.items.length} 张正视图 / 当前 ${items.length} 张`;
  els.comboName.value = `${labelName(hair)} / ${labelName(outfit)}`;
  els.actionList.value = actions.join(" / ");
  els.grid.innerHTML = "";

  actions.forEach((action) => {
    const actionItems = sortedPoses(items.filter((item) => item.action === action));
    const row = document.createElement("section");
    row.className = "action-row";

    const title = document.createElement("div");
    title.className = "action-title";
    const strong = document.createElement("strong");
    strong.textContent = action;
    const count = document.createElement("small");
    count.textContent = `${actionItems.length} 帧`;
    title.append(strong, count);

    const frameRow = document.createElement("div");
    frameRow.className = "frame-row";
    actionItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card";
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.name;
      const caption = document.createElement("small");
      caption.textContent = `${item.action} / pose ${item.pose}`;
      card.append(image, caption);
      frameRow.append(card);
    });

    row.append(title, frameRow);
    els.grid.append(row);
  });

  syncUrl();
}

async function copyUrl() {
  await navigator.clipboard.writeText(currentUrl().href);
  els.copyUrlButton.textContent = "已复制";
  window.setTimeout(() => {
    els.copyUrlButton.textContent = "复制当前链接";
  }, 900);
}

async function init() {
  const response = await fetch("./manifest.json");
  if (!response.ok) throw new Error("manifest 读取失败");
  manifest = await response.json();
  renderSelects();
  render();

  els.hairSelect.addEventListener("change", render);
  els.outfitSelect.addEventListener("change", render);
  els.includeWalk.addEventListener("change", render);
  els.copyUrlButton.addEventListener("click", () => {
    void copyUrl();
  });
}

init().catch((error) => {
  document.body.innerHTML = `<pre>${String(error.stack || error)}</pre>`;
});
