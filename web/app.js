const SETS = {
  SOS: { name: "SOS", url: "data/cards.json", scoreKey: "avgNorm", metric: "Avg Norm" },
  DFT: { name: "Aetherdrift", url: "data/aetherdrift.json", scoreKey: "winRate", metric: "win rate in hand" },
  FIN: { name: "Final Fantasy", url: "data/final-fantasy.json", scoreKey: "winRate", metric: "win rate in hand" },
};
const WIN_RATE_SET_CODES = new Set(["DFT", "FIN"]);
const SCRYFALL_NAMED_URL = "https://api.scryfall.com/cards/named";
const EPSILON = 0.000001;
const SCRYFALL_TIMEOUT_MS = 4500;
const BROWSE_LIMIT = 30;
const MAX_CONCURRENT_IMAGE_REQUESTS = 4;
const RARITY_LABELS = {
  common: "C",
  uncommon: "U",
  rare: "R",
  mythic: "M",
};
const COLOR_LABELS = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
  M: "Multicolor",
  C: "Colorless",
};
const BROWSE_RARITY_LABELS = {
  common: "Commons",
  uncommon: "Uncommons",
  rarePlus: "Mythics / Rares",
};

const state = {
  setCode: "DFT",
  loadId: 0,
  pairId: 0,
  loading: false,
  cards: [],
  buckets: [],
  currentPair: null,
  round: 0,
  decisiveRounds: 0,
  correctDecisions: 0,
  ties: 0,
  revealed: false,
  viewMode: "train",
  browse: {
    rarity: "rarePlus",
    color: "M",
    hasChosenRarity: true,
    hasChosenColor: true,
    requestId: 0,
  },
};

const imageCache = new Map();
const pendingImageRequests = new Map();
const imageRequestQueue = [];
let activeImageRequests = 0;

const setSelect = document.getElementById("setSelect");
const sourceLink = document.getElementById("sourceLink");
const sourceDescription = document.getElementById("sourceDescription");
const metricLabel = () => SETS[state.setCode].metric;
const cardScore = (card) => card[SETS[state.setCode].scoreKey];
const cardGrade = (card) => WIN_RATE_SET_CODES.has(state.setCode) ? card.grade : avgNormToGrade(card.avgNorm);

const sourceStatus = document.getElementById("sourceStatus");
const roundLabel = document.getElementById("roundLabel");
const roundCount = document.getElementById("roundCount");
const accuracyLabel = document.getElementById("accuracyLabel");
const accuracyStat = document.getElementById("accuracyStat");
const bucketLabelTitle = document.getElementById("bucketLabelTitle");
const bucketLabel = document.getElementById("bucketLabel");
const promptText = document.getElementById("promptText");
const resultText = document.getElementById("resultText");
const nextButton = document.getElementById("nextButton");
const resultPanel = document.querySelector(".result-panel");
const resultCallout = document.getElementById("resultCallout");
const resultCardLeft = document.getElementById("resultCardLeft");
const resultCardRight = document.getElementById("resultCardRight");
const arena = document.getElementById("arena");
const browsePanel = document.getElementById("browsePanel");
const browseList = document.getElementById("browseList");
const viewModeButtons = [...document.querySelectorAll("[data-view-mode]")];
const browseRarityButtons = [...document.querySelectorAll("[data-browse-rarity]")];
const browseColorButtons = [...document.querySelectorAll("[data-browse-color]")];
const cardButtons = [
  document.getElementById("cardA"),
  document.getElementById("cardB"),
];

function isPhoneViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function scrollResultIntoView() {
  if (!isPhoneViewport() || !resultPanel || state.viewMode !== "train") {
    return;
  }

  resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function scrollArenaIntoView() {
  if (!isPhoneViewport() || !arena || state.viewMode !== "train") {
    return;
  }

  arena.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createColorKey(colors) {
  if (!Array.isArray(colors) || colors.length === 0) {
    return "C";
  }

  return [...colors].sort().join("");
}

function getBrowseColorKey(card) {
  if (card.colorKey === "C") {
    return "C";
  }

  return card.colorKey.length === 1 ? card.colorKey : "M";
}

function describeColors(colorKey) {
  if (colorKey === "C" || colorKey === "M") {
    return COLOR_LABELS[colorKey];
  }

  return colorKey
    .split("")
    .map((color) => COLOR_LABELS[color] || color)
    .join(" / ");
}

function describeBucket(bucket) {
  return `${RARITY_LABELS[bucket.rarity] || bucket.rarity.toUpperCase()} • ${describeColors(bucket.colorKey)}`;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickPairFromBucket(bucketCards) {
  const firstIndex = Math.floor(Math.random() * bucketCards.length);
  let secondIndex = Math.floor(Math.random() * bucketCards.length);

  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * bucketCards.length);
  }

  return [bucketCards[firstIndex], bucketCards[secondIndex]];
}

function normalizeCards(rawCards) {
  return rawCards
    .filter((card) => card && Number.isFinite(cardScore(card)))
    .map((card) => {
      const colorKey = createColorKey(card.colors);

      return {
        ...card,
        colorKey,
        browseColorKey: getBrowseColorKey({ colorKey }),
        rarityLabel: RARITY_LABELS[card.rarity] || card.rarity,
      };
    });
}

function buildBuckets(cards) {
  const grouped = new Map();

  for (const card of cards) {
    const bucketKey = `${card.rarity}|${card.colorKey}`;
    if (!grouped.has(bucketKey)) {
      grouped.set(bucketKey, {
        key: bucketKey,
        rarity: card.rarity,
        colorKey: card.colorKey,
        cards: [],
      });
    }

    grouped.get(bucketKey).cards.push(card);
  }

  return [...grouped.values()].filter((bucket) => bucket.cards.length >= 2);
}

function avgNormToGrade(avgNorm) {
  if (avgNorm >= 2.25) {
    return "A+";
  }
  if (avgNorm >= 1.75) {
    return "A";
  }
  if (avgNorm >= 1.25) {
    return "A-";
  }
  if (avgNorm >= 0.75) {
    return "B+";
  }
  if (avgNorm >= 0.25) {
    return "B";
  }
  if (avgNorm >= -0.25) {
    return "B-";
  }
  if (avgNorm >= -0.75) {
    return "C+";
  }
  if (avgNorm >= -1.25) {
    return "C";
  }
  if (avgNorm >= -1.75) {
    return "C-";
  }
  if (avgNorm >= -2.25) {
    return "D+";
  }
  if (avgNorm >= -2.75) {
    return "D";
  }
  if (avgNorm >= -3.25) {
    return "D-";
  }
  return "F";
}

function buildScryfallUrl(name, setCode) {
  const url = new URL(SCRYFALL_NAMED_URL);
  url.searchParams.set("fuzzy", name);
  if (setCode) {
    url.searchParams.set("set", setCode.toLowerCase());
  }
  return url.toString();
}

function getNameCandidates(card) {
  const rawCandidates = [card.name];
  const splitParts = card.name.includes(" // ")
    ? card.name.split(" // ").map((part) => part.trim()).filter(Boolean)
    : [];

  if (splitParts.length > 0) {
    rawCandidates.push(...[...splitParts].reverse(), ...splitParts);
  }

  const uniqueCandidates = [];
  for (const candidate of rawCandidates) {
    if (!candidate || uniqueCandidates.includes(candidate)) {
      continue;
    }
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates.flatMap((candidate) => [
    { name: candidate, setCode: card.setCode },
    { name: candidate, setCode: null },
  ]);
}

function extractImageUrl(data) {
  return (
    data?.image_uris?.normal ||
    data?.card_faces?.find((face) => face?.image_uris?.normal)?.image_uris?.normal ||
    null
  );
}

function pumpImageQueue() {
  while (activeImageRequests < MAX_CONCURRENT_IMAGE_REQUESTS && imageRequestQueue.length > 0) {
    const nextRequest = imageRequestQueue.shift();
    if (nextRequest.cancelled) {
      continue;
    }

    activeImageRequests += 1;

    Promise.resolve()
      .then(nextRequest.task)
      .then(nextRequest.resolve, nextRequest.reject)
      .finally(() => {
        activeImageRequests -= 1;
        pumpImageQueue();
      });
  }
}

function enqueueImageTask(task, cacheKey) {
  return new Promise((resolve, reject) => {
    imageRequestQueue.push({ task, resolve, reject, cacheKey, cancelled: false });
    pumpImageQueue();
  });
}

function clearQueuedImageRequests() {
  while (imageRequestQueue.length > 0) {
    const queuedRequest = imageRequestQueue.shift();
    queuedRequest.cancelled = true;
    if (queuedRequest.cacheKey) {
      pendingImageRequests.delete(queuedRequest.cacheKey);
    }
    queuedRequest.resolve(null);
  }
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null,
      };
    }
    return {
      ok: true,
      status: response.status,
      data: await response.json(),
    };
  } catch (_error) {
    return {
      ok: false,
      status: 0,
      data: null,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchCardImage(card) {
  if (card.imageUrl) return card.imageUrl;
  const cacheKey = `${card.name}::${card.setCode || ""}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  if (pendingImageRequests.has(cacheKey)) {
    return pendingImageRequests.get(cacheKey);
  }

  const request = enqueueImageTask(async () => {
    const candidates = getNameCandidates(card).map(({ name, setCode }) => buildScryfallUrl(name, setCode));
    let sawTransientFailure = false;

    for (const url of candidates) {
      const result = await fetchJsonWithTimeout(url, SCRYFALL_TIMEOUT_MS);
      const imageUrl = extractImageUrl(result.data);

      if (imageUrl) {
        imageCache.set(cacheKey, imageUrl);
        return imageUrl;
      }

      if (!result.ok && result.status !== 404) {
        sawTransientFailure = true;
      }
    }

    if (!sawTransientFailure) {
      imageCache.set(cacheKey, null);
    }

    return null;
  }, cacheKey);

  pendingImageRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingImageRequests.delete(cacheKey);
  }
}

function resetCardButton(button) {
  button.disabled = true;
  button.classList.remove("is-selected", "is-correct", "is-wrong", "is-tie");
  button.querySelector(".card-name").textContent = "Loading...";
  button.querySelector(".card-meta").textContent = "";
  button.querySelector(".card-copy").hidden = true;

  const image = button.querySelector(".card-image");
  const fallback = button.querySelector(".image-fallback");
  image.removeAttribute("src");
  image.alt = "";
  fallback.hidden = false;
  fallback.textContent = "Loading image...";
}

function renderCard(button, card, imageUrl) {
  button.dataset.cardName = card.name;
  button.setAttribute("aria-label", `Choose ${card.name}`);
  button.querySelector(".card-name").textContent = card.name;
  button.querySelector(".card-meta").textContent =
    `${card.rarityLabel} rarity • ${describeColors(card.colorKey)} • ${card.type || "Unknown type"}`;

  const image = button.querySelector(".card-image");
  const fallback = button.querySelector(".image-fallback");
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = card.name;
    fallback.hidden = true;
  } else {
    image.removeAttribute("src");
    image.alt = "";
    fallback.hidden = false;
    fallback.textContent = `${card.name}\nImage unavailable from Scryfall`;
  }
}

function renderTrainerPair(pair) {
  bucketLabel.textContent = describeBucket(pair.bucket);
  promptText.replaceChildren();
  const instruction = document.createElement("strong");
  instruction.textContent = "Choose the better card.";
  const context = document.createElement("span");
  context.className = "prompt-context";
  context.textContent = `(Same rarity, same color identity: ${describeBucket(pair.bucket)})`;
  promptText.append(instruction, " ", context);
  renderCard(cardButtons[0], pair.leftCard, pair.leftImage);
  renderCard(cardButtons[1], pair.rightCard, pair.rightImage);
  setButtonsEnabled(!state.revealed);
}

function formatScore(score) {
  return WIN_RATE_SET_CODES.has(state.setCode) ? `${score.toFixed(1)}%` : score.toFixed(3);
}

function setResultCardState(element, card, tone) {
  element.classList.remove("is-winner", "is-loser", "is-tie");
  element.classList.add(tone);
  element.querySelector(".result-card-name").textContent = card.name;
  element.querySelector("[data-grade]").textContent = cardGrade(card);
  element.querySelector("[data-score]").textContent = formatScore(cardScore(card));
}

function resetResultCardState(element) {
  element.classList.remove("is-winner", "is-loser", "is-tie");
  element.querySelector(".result-card-name").textContent = "Waiting...";
  element.querySelector("[data-grade]").textContent = "--";
  element.querySelector("[data-score]").textContent = "--";
}

function setButtonsEnabled(enabled) {
  for (const button of cardButtons) {
    button.disabled = !enabled;
  }
}

function clearResultState() {
  state.revealed = false;
  resultText.textContent = "Results appear here after you choose.";
  nextButton.hidden = true;
  resultCallout.hidden = true;
  resultPanel.classList.remove("is-correct", "is-wrong", "is-tie");
  if (state.viewMode === "train") {
    promptText.textContent = `Click the card you think has the higher ${metricLabel()}.`;
  }
  resetResultCardState(resultCardLeft);
  resetResultCardState(resultCardRight);
  for (const button of cardButtons) {
    button.classList.remove("is-selected", "is-correct", "is-wrong", "is-tie", "is-hero", "is-sunken");
    button.querySelector(".card-copy").hidden = true;
  }
}

function updateTrainerStatus() {
  roundLabel.textContent = "Round";
  roundCount.textContent = String(state.round);
  accuracyLabel.textContent = "Decisive Accuracy";
  accuracyStat.textContent = `${state.correctDecisions}/${state.decisiveRounds}`;
  bucketLabelTitle.textContent = "Current Bucket";
  bucketLabel.textContent = state.currentPair ? describeBucket(state.currentPair.bucket) : "Waiting for data";
}

function updateBrowseStatus(cards) {
  if (!state.browse.hasChosenRarity || !state.browse.hasChosenColor) {
    roundLabel.textContent = "Showing";
    roundCount.textContent = "--";
    accuracyLabel.textContent = "Rarity";
    accuracyStat.textContent = state.browse.hasChosenRarity
      ? BROWSE_RARITY_LABELS[state.browse.rarity]
      : "Pick one";
    bucketLabelTitle.textContent = "Color";
    bucketLabel.textContent = state.browse.hasChosenColor
      ? COLOR_LABELS[state.browse.color]
      : "Pick one";
    return;
  }

  roundLabel.textContent = "Showing";
  roundCount.textContent = String(cards.length);
  accuracyLabel.textContent = "Rarity";
  accuracyStat.textContent = BROWSE_RARITY_LABELS[state.browse.rarity];
  bucketLabelTitle.textContent = "Color";
  bucketLabel.textContent = COLOR_LABELS[state.browse.color];
}

function setButtonGroupState(buttons, value, datasetKey) {
  for (const button of buttons) {
    button.classList.toggle("is-active", button.dataset[datasetKey] === value);
  }
}

function matchesBrowseRarity(card, rarity) {
  if (rarity === "common" || rarity === "uncommon") {
    return card.rarity === rarity;
  }

  return card.rarity === "rare" || card.rarity === "mythic";
}

function getBrowseCards() {
  if (!state.browse.hasChosenRarity || !state.browse.hasChosenColor) {
    return [];
  }

  return state.cards
    .filter((card) => matchesBrowseRarity(card, state.browse.rarity))
    .filter((card) => card.browseColorKey === state.browse.color)
    .sort((leftCard, rightCard) => {
      if (cardScore(rightCard) !== cardScore(leftCard)) {
        return cardScore(rightCard) - cardScore(leftCard);
      }

      return leftCard.name.localeCompare(rightCard.name);
    })
    .slice(0, BROWSE_LIMIT);
}

function createBrowseCardElement(card, index) {
  const article = document.createElement("article");
  article.className = "browse-card";
  article.innerHTML = `
    <div class="browse-image-shell">
      <div class="browse-rank">#${index + 1}</div>
      <img alt="" class="browse-image" loading="lazy">
      <div class="image-fallback browse-image-fallback">Loading image...</div>
    </div>
    <div class="browse-copy">
      <div class="browse-heading">
        <h2 class="browse-name">${card.name}</h2>
        <div class="browse-grade-pill">
          <span class="browse-grade">${cardGrade(card)}</span>
          <span class="browse-score">${formatScore(cardScore(card))}</span>
        </div>
      </div>
      <p class="browse-meta">${card.rarityLabel} rarity • ${describeColors(card.colorKey)} • ${card.type || "Unknown type"}</p>
    </div>
  `;

  return article;
}

async function hydrateBrowseCardImage(card, article, requestId) {
  const imageUrl = await fetchCardImage(card);
  if (state.viewMode !== "browse" || state.browse.requestId !== requestId || !article.isConnected) {
    return;
  }

  const image = article.querySelector(".browse-image");
  const fallback = article.querySelector(".browse-image-fallback");
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = card.name;
    fallback.hidden = true;
  } else {
    image.removeAttribute("src");
    image.alt = "";
    fallback.hidden = false;
    fallback.textContent = `${card.name}\nImage unavailable from Scryfall`;
  }
}

function renderBrowseList() {
  const cards = getBrowseCards();
  updateBrowseStatus(cards);

  browseList.innerHTML = "";
  state.browse.requestId += 1;
  clearQueuedImageRequests();

  if (!state.browse.hasChosenRarity || !state.browse.hasChosenColor) {
    promptText.textContent = "Pick a rarity and a color to load the ranking.";
    const emptyState = document.createElement("article");
    emptyState.className = "browse-empty";
    emptyState.textContent = "Choose filters to load card images.";
    browseList.append(emptyState);
    return;
  }

  promptText.textContent = cards.length
    ? `Top ${cards.length} ${BROWSE_RARITY_LABELS[state.browse.rarity].toLowerCase()} in ${COLOR_LABELS[state.browse.color]}, sorted by ${metricLabel()}.`
    : `No ${BROWSE_RARITY_LABELS[state.browse.rarity].toLowerCase()} are available for ${COLOR_LABELS[state.browse.color]}.`;

  const requestId = state.browse.requestId;

  if (cards.length === 0) {
    const emptyState = document.createElement("article");
    emptyState.className = "browse-empty";
    emptyState.textContent = "No cards matched that filter.";
    browseList.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const [index, card] of cards.entries()) {
    const article = createBrowseCardElement(card, index);
    fragment.append(article);
    hydrateBrowseCardImage(card, article, requestId);
  }

  browseList.append(fragment);
}

function setViewMode(mode) {
  state.viewMode = mode;
  setButtonGroupState(viewModeButtons, mode, "viewMode");

  const isBrowseMode = mode === "browse";
  arena.hidden = isBrowseMode;
  resultPanel.hidden = isBrowseMode;
  browsePanel.hidden = !isBrowseMode;

  if (isBrowseMode) {
    renderBrowseList();
    return;
  }

  updateTrainerStatus();
  if (!state.currentPair) {
    promptText.textContent = "Loading cards...";
  } else {
    renderTrainerPair(state.currentPair);
  }
}

async function nextRound() {
  if (state.loading || !state.buckets.length) return;
  const pairId = ++state.pairId;
  state.currentPair = null;
  clearResultState();
  scrollArenaIntoView();
  setButtonsEnabled(false);
  for (const button of cardButtons) {
    resetCardButton(button);
  }

  const bucket = pickRandom(state.buckets);
  const [leftCard, rightCard] = pickPairFromBucket(bucket.cards);

  const [leftImage, rightImage] = await Promise.all([
    fetchCardImage(leftCard),
    fetchCardImage(rightCard),
  ]);

  if (pairId !== state.pairId) return;

  state.currentPair = {
    bucket,
    leftCard,
    rightCard,
    leftImage,
    rightImage,
  };
  state.round += 1;

  if (state.viewMode !== "train") {
    return;
  }

  renderTrainerPair(state.currentPair);
  updateTrainerStatus();
}

function revealOutcome(selectedSide) {
  if (!state.currentPair || state.revealed || state.viewMode !== "train") {
    return;
  }

  state.revealed = true;
  setButtonsEnabled(false);
  nextButton.hidden = false;

  const selectedButton = selectedSide === "left" ? cardButtons[0] : cardButtons[1];
  selectedButton.classList.add("is-selected");

  const leftScore = cardScore(state.currentPair.leftCard);
  const rightScore = cardScore(state.currentPair.rightCard);

  for (const button of cardButtons) {
    button.querySelector(".card-copy").hidden = false;
  }

  resultCallout.hidden = false;

  if (Math.abs(leftScore - rightScore) <= EPSILON) {
    state.ties += 1;
    resultPanel.classList.add("is-tie");
    cardButtons[0].classList.add("is-tie");
    cardButtons[1].classList.add("is-tie");
    setResultCardState(resultCardLeft, state.currentPair.leftCard, "is-tie");
    setResultCardState(resultCardRight, state.currentPair.rightCard, "is-tie");
    resultText.textContent = `Tie. Both cards have the same ${metricLabel()}.`;
    scrollResultIntoView();
    return;
  }

  const leftWins = leftScore > rightScore;
  const pickedCorrectly =
    (selectedSide === "left" && leftWins) || (selectedSide === "right" && !leftWins);
  const winnerButton = leftWins ? cardButtons[0] : cardButtons[1];
  const loserButton = leftWins ? cardButtons[1] : cardButtons[0];

  state.decisiveRounds += 1;
  if (pickedCorrectly) {
    state.correctDecisions += 1;
  }
  updateTrainerStatus();

  winnerButton.classList.add("is-correct");
  winnerButton.classList.add("is-hero");
  loserButton.classList.add("is-wrong");
  loserButton.classList.add("is-sunken");
  setResultCardState(resultCardLeft, state.currentPair.leftCard, leftWins ? "is-winner" : "is-loser");
  setResultCardState(resultCardRight, state.currentPair.rightCard, leftWins ? "is-loser" : "is-winner");
  resultPanel.classList.add(pickedCorrectly ? "is-correct" : "is-wrong");

  resultText.textContent = pickedCorrectly
    ? "CORRECT."
    : "INCORRECT.";
  scrollResultIntoView();
}

async function selectSet(setCode) {
  const loadId = ++state.loadId;
  state.pairId += 1;
  state.browse.requestId += 1;
  state.setCode = setCode;
  state.loading = true;
  state.cards = [];
  state.buckets = [];
  state.currentPair = null;
  state.round = state.decisiveRounds = state.correctDecisions = state.ties = 0;
  clearQueuedImageRequests();
  clearResultState();
  cardButtons.forEach(resetCardButton);
  browseList.innerHTML = "";
  sourceStatus.textContent = `Loading ${SETS[setCode].name}…`;
  sourceLink.hidden = true;
  sourceDescription.textContent = `Pick the stronger card using ${metricLabel()} as the answer key.`;
  updateTrainerStatus();
  promptText.textContent = "Loading cards…";

  try {
    const response = await fetch(SETS[setCode].url);
    if (!response.ok) throw new Error(`Could not load ${SETS[setCode].name}.`);
    const payload = await response.json();
    if (loadId !== state.loadId) return;
    state.cards = normalizeCards(payload.cards || []);
    state.buckets = buildBuckets(state.cards);
    if (!state.buckets.length) throw new Error("No comparable cards found.");
    const excluded = payload.cards.length - state.cards.length;
    const userGroup = payload.userGroup === "All" ? "All users" : payload.userGroup ? `${payload.userGroup} users` : "";
    const snapshotParts = [
      payload.format,
      userGroup,
      payload.timePeriod === "ALL_TIME" ? "All time" : payload.timePeriod,
      payload.retrievedAt ? `Snapshot ${payload.retrievedAt}` : "",
    ].filter(Boolean);
    const snapshotDetails = WIN_RATE_SET_CODES.has(setCode) && snapshotParts.length
      ? ` • ${snapshotParts.join(" • ")}`
      : "";
    sourceStatus.textContent = `${state.cards.length} rated cards from ${payload.sourceName}` +
      snapshotDetails +
      (excluded ? ` • ${excluded} unrated cards excluded` : "");
    sourceLink.href = payload.sourceUrl;
    sourceLink.hidden = false;
    state.loading = false;
    setViewMode(state.viewMode);
    await nextRound();
  } catch (error) {
    if (loadId !== state.loadId) return;
    state.loading = false;
    promptText.textContent = "The selected set could not load. Choose another set or reload to retry.";
    resultText.textContent = error.message;
    sourceStatus.textContent = "Source load failed";
  }
}

setSelect.addEventListener("change", () => selectSet(setSelect.value));

cardButtons[0].addEventListener("click", () => revealOutcome("left"));
cardButtons[1].addEventListener("click", () => revealOutcome("right"));
nextButton.addEventListener("click", () => {
  nextRound();
});

for (const button of viewModeButtons) {
  button.addEventListener("click", () => {
    setViewMode(button.dataset.viewMode);
  });
}

for (const button of browseRarityButtons) {
  button.addEventListener("click", () => {
    state.browse.rarity = button.dataset.browseRarity;
    state.browse.hasChosenRarity = true;
    setButtonGroupState(browseRarityButtons, state.browse.rarity, "browseRarity");
    if (state.viewMode === "browse") {
      renderBrowseList();
    }
  });
}

for (const button of browseColorButtons) {
  button.addEventListener("click", () => {
    state.browse.color = button.dataset.browseColor;
    state.browse.hasChosenColor = true;
    setButtonGroupState(browseColorButtons, state.browse.color, "browseColor");
    if (state.viewMode === "browse") {
      renderBrowseList();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (state.viewMode !== "train" || state.loading || event.target.closest("select, input, textarea, button")) {
    return;
  }

  if (state.revealed && event.key === "Enter") {
    nextRound();
    return;
  }

  if (!state.revealed && !cardButtons[0].disabled) {
    if (event.key === "ArrowLeft") {
      revealOutcome("left");
    } else if (event.key === "ArrowRight") {
      revealOutcome("right");
    }
  }
});

// Capacitor injects its native bridge before this script runs in the iOS shell.
const siteCredits = document.getElementById("siteCredits");
siteCredits.hidden = Boolean(window.Capacitor?.isNativePlatform?.());

selectSet(setSelect.value);
