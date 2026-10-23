const STORAGE_KEY = "vp-anime-tracker-library-v1";
const ANILIST_API = "https://graphql.anilist.co";
const COVER_QUERY = `
  query ($search: String!) {
    Media(search: $search, type: ANIME, isAdult: false) {
      coverImage { extraLarge large }
    }
  }
`;

const palettes = {
  coral: { background: "linear-gradient(145deg, #fa765f 0%, #b92f50 100%)", accent: "#ff6b5e" },
  blue: { background: "linear-gradient(145deg, #396a9e 0%, #1a2850 100%)", accent: "#63a5ff" },
  lilac: { background: "linear-gradient(145deg, #795f9d 0%, #34264d 100%)", accent: "#b899ff" },
  yellow: { background: "linear-gradient(145deg, #e0a53d 0%, #8f412e 100%)", accent: "#f4c95d" },
  mint: { background: "linear-gradient(145deg, #42a88f 0%, #173f49 100%)", accent: "#66d7bd" },
};

const defaultAnime = [
  {
    id: crypto.randomUUID(),
    title: "Frieren",
    season: "Temporada 1",
    status: "watching",
    currentEpisode: 18,
    totalEpisodes: 28,
    score: 9.4,
    palette: "mint",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
    updatedAt: Date.now() - 1000,
  },
  {
    id: crypto.randomUUID(),
    title: "Jujutsu Kaisen",
    season: "Temporada 2",
    status: "watching",
    currentEpisode: 14,
    totalEpisodes: 23,
    score: 8.8,
    palette: "coral",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-hSNRJM03pvv1.jpg",
    updatedAt: Date.now() - 2000,
  },
  {
    id: crypto.randomUUID(),
    title: "Vinland Saga",
    season: "Temporada 2",
    status: "completed",
    currentEpisode: 24,
    totalEpisodes: 24,
    score: 9.1,
    palette: "yellow",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx136430-gsBsJjA7hGh9.jpg",
    updatedAt: Date.now() - 3000,
  },
  {
    id: crypto.randomUUID(),
    title: "Blue Lock",
    season: "Temporada 1",
    status: "pending",
    currentEpisode: 7,
    totalEpisodes: 24,
    score: 7.9,
    palette: "blue",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx137822-U8naszP96vzC.png",
    updatedAt: Date.now() - 4000,
  },
  {
    id: crypto.randomUUID(),
    title: "Chainsaw Man",
    season: "Temporada 1",
    status: "completed",
    currentEpisode: 12,
    totalEpisodes: 12,
    score: 8.5,
    palette: "lilac",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png",
    updatedAt: Date.now() - 5000,
  },
  {
    id: crypto.randomUUID(),
    title: "Solo Leveling",
    season: "Temporada 2",
    status: "pending",
    currentEpisode: 0,
    totalEpisodes: 13,
    score: null,
    palette: "coral",
    cover: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx176496-9BDMjAZGEbq4.png",
    updatedAt: Date.now() - 6000,
  },
];

const state = {
  anime: loadAnime(),
  filter: "all",
  search: "",
  sort: "recent",
};

const grid = document.querySelector("#animeGrid");
const emptyState = document.querySelector("#emptyState");
const resultCount = document.querySelector("#resultCount");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const dialog = document.querySelector("#animeDialog");
const form = document.querySelector("#animeForm");
const dialogTitle = document.querySelector("#dialogTitle");
const titleInput = document.querySelector("#titleInput");
const toast = document.querySelector("#toast");

let toastTimer;

function loadAnime() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : defaultAnime;
  } catch {
    return defaultAnime;
  }
}

function saveAnime() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.anime));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getVisibleAnime() {
  const term = normalizeText(state.search);
  const visible = state.anime.filter((anime) => {
    const matchesStatus = state.filter === "all" || anime.status === state.filter;
    const matchesSearch = !term || normalizeText(`${anime.title} ${anime.season}`).includes(term);
    return matchesStatus && matchesSearch;
  });

  return visible.sort((a, b) => {
    if (state.sort === "title") return a.title.localeCompare(b.title, "es");
    if (state.sort === "score") return (b.score ?? -1) - (a.score ?? -1);
    if (state.sort === "pending") {
      return b.totalEpisodes - b.currentEpisode - (a.totalEpisodes - a.currentEpisode);
    }
    return b.updatedAt - a.updatedAt;
  });
}

function statusLabel(status) {
  return {
    watching: "Viendo",
    pending: "Pendiente",
    completed: "Completado",
  }[status];
}

function paletteFor(value) {
  return palettes[value] || palettes.coral;
}

function safeCoverUrl(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

async function findAnimeCover(title) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: COVER_QUERY, variables: { search: title } }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`AniList respondió con ${response.status}`);
    const payload = await response.json();
    return safeCoverUrl(
      payload?.data?.Media?.coverImage?.extraLarge ||
      payload?.data?.Media?.coverImage?.large ||
      "",
    );
  } catch (error) {
    console.warn(`No se pudo obtener la carátula de ${title}.`, error);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function hydrateMissingCovers() {
  const missing = state.anime.filter((anime) => !safeCoverUrl(anime.cover));
  if (!missing.length) return;

  const results = await Promise.allSettled(
    missing.map((anime) => findAnimeCover(anime.title)),
  );
  let changed = false;

  results.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) return;
    missing[index].cover = result.value;
    changed = true;
  });

  if (changed) {
    saveAnime();
    render();
  }
}

function animeCard(anime, index) {
  const palette = paletteFor(anime.palette);
  const current = Math.max(0, Number(anime.currentEpisode) || 0);
  const total = Math.max(1, Number(anime.totalEpisodes) || 1);
  const progress = Math.min(100, Math.round((current / total) * 100));
  const coverUrl = safeCoverUrl(anime.cover);
  const coverStyle = coverUrl
    ? `background-image: linear-gradient(180deg, transparent 35%, rgba(0,0,0,.78)), url(&quot;${escapeHtml(coverUrl)}&quot;); --cover-bg: ${palette.background};`
    : `--cover-bg: ${palette.background};`;
  const title = escapeHtml(anime.title);
  const season = escapeHtml(anime.season || "Sin temporada");
  const score = anime.score === null || anime.score === "" || Number.isNaN(Number(anime.score))
    ? "—"
    : Number(anime.score).toFixed(1);

  return `
    <article class="anime-card" data-id="${anime.id}" style="--accent: ${palette.accent}">
      <div class="card-cover${coverUrl ? " has-image" : ""}" style="${coverStyle}">
        <span class="cover-index">ARCHIVE / ${String(index + 1).padStart(2, "0")}</span>
        <span class="card-status ${anime.status}">${statusLabel(anime.status)}</span>
        ${coverUrl ? "" : '<span class="cover-kanji" aria-hidden="true">物語</span>'}
        <h3 class="cover-title">${title}</h3>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${season}</span>
          <strong class="score" title="Puntuación">★ ${score}</strong>
        </div>
        <div class="progress-row">
          <span>Progreso</span>
          <strong>${current} <small>/ ${total} eps.</small></strong>
        </div>
        <div class="progress-track" role="progressbar" aria-label="Progreso de ${title}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${current}">
          <span class="progress-bar" style="width: ${progress}%"></span>
        </div>
        <div class="card-actions">
          <button class="continue-button" type="button" data-action="progress" ${current >= total ? "disabled" : ""}>
            ${current >= total ? "✓ Completado" : "+1 episodio"}
          </button>
          <button class="mini-button" type="button" data-action="edit" aria-label="Editar ${title}" title="Editar">✎</button>
          <button class="mini-button danger" type="button" data-action="delete" aria-label="Eliminar ${title}" title="Eliminar">×</button>
        </div>
      </div>
    </article>
  `;
}

function render() {
  const visible = getVisibleAnime();
  grid.innerHTML = visible.map(animeCard).join("");
  resultCount.textContent = visible.length;
  grid.hidden = visible.length === 0;
  emptyState.hidden = visible.length !== 0;
  renderStats();
}

function renderStats() {
  const watching = state.anime.filter((anime) => anime.status === "watching").length;
  const pendingEpisodes = state.anime.reduce(
    (sum, anime) => sum + Math.max(0, Number(anime.totalEpisodes) - Number(anime.currentEpisode)),
    0,
  );
  const completed = state.anime.filter((anime) => anime.status === "completed").length;
  const scores = state.anime.map((anime) => Number(anime.score)).filter((score) => score > 0);
  const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : "—";

  document.querySelector("#watchingStat").textContent = watching;
  document.querySelector("#pendingStat").textContent = pendingEpisodes;
  document.querySelector("#completedStat").textContent = completed;
  document.querySelector("#scoreStat").textContent = average;
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function openModal(anime = null) {
  form.reset();
  form.elements.id.value = anime?.id || "";
  form.elements.title.value = anime?.title || "";
  form.elements.season.value = anime?.season || "";
  form.elements.status.value = anime?.status || "watching";
  form.elements.currentEpisode.value = anime?.currentEpisode ?? 0;
  form.elements.totalEpisodes.value = anime?.totalEpisodes ?? 12;
  form.elements.score.value = anime?.score ?? "";
  form.elements.palette.value = anime?.palette || "coral";
  form.elements.cover.value = anime?.cover || "";
  dialogTitle.textContent = anime ? "Editar anime" : "Añadir a mi lista";
  dialog.showModal();
  requestAnimationFrame(() => titleInput.focus());
}

function closeModal() {
  dialog.close();
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => openModal());
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModal);
});

dialog.addEventListener("click", (event) => {
  const bounds = dialog.getBoundingClientRect();
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;
  if (outside) closeModal();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const submitButton = form.querySelector('[type="submit"]');
  const originalButtonText = submitButton.textContent;
  let cover = safeCoverUrl(data.cover.trim());

  if (!cover) {
    submitButton.disabled = true;
    submitButton.textContent = "Buscando carátula...";
    cover = await findAnimeCover(data.title.trim());
  }

  const totalEpisodes = Math.max(1, Number(data.totalEpisodes));
  let currentEpisode = Math.max(0, Number(data.currentEpisode));
  currentEpisode = Math.min(currentEpisode, totalEpisodes);
  let status = data.status;
  if (currentEpisode >= totalEpisodes) status = "completed";
  if (status === "completed") currentEpisode = totalEpisodes;

  const record = {
    id: data.id || crypto.randomUUID(),
    title: data.title.trim(),
    season: data.season.trim() || "Sin temporada",
    status,
    currentEpisode,
    totalEpisodes,
    score: data.score === "" ? null : Math.min(10, Math.max(0, Number(data.score))),
    palette: data.palette,
    cover,
    updatedAt: Date.now(),
  };

  const existingIndex = state.anime.findIndex((anime) => anime.id === record.id);
  if (existingIndex >= 0) {
    state.anime[existingIndex] = record;
    notify(`${record.title} se ha actualizado.`);
  } else {
    state.anime.unshift(record);
    notify(`${record.title} se ha añadido a tu lista.`);
  }

  saveAnime();
  render();
  closeModal();
  submitButton.disabled = false;
  submitButton.textContent = originalButtonText;
});

grid.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const card = event.target.closest(".anime-card");
  if (!actionButton || !card) return;

  const anime = state.anime.find((item) => item.id === card.dataset.id);
  if (!anime) return;

  const action = actionButton.dataset.action;
  if (action === "progress") {
    anime.currentEpisode = Math.min(anime.totalEpisodes, Number(anime.currentEpisode) + 1);
    anime.updatedAt = Date.now();
    if (anime.currentEpisode >= anime.totalEpisodes) {
      anime.status = "completed";
      notify(`¡${anime.title} completado!`);
    } else {
      anime.status = "watching";
      notify(`${anime.title}: episodio ${anime.currentEpisode} registrado.`);
    }
    saveAnime();
    render();
  }

  if (action === "edit") openModal(anime);

  if (action === "delete") {
    const confirmed = window.confirm(`¿Eliminar “${anime.title}” de tu biblioteca?`);
    if (!confirmed) return;
    state.anime = state.anime.filter((item) => item.id !== anime.id);
    saveAnime();
    render();
    notify(`${anime.title} se ha eliminado.`);
  }
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  });
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  render();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
render();
hydrateMissingCovers();
