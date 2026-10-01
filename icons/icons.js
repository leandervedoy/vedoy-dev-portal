const manifestUrl = "../assets/vedoy-icons/manifest.json";
const iconRoot = "../assets/vedoy-icons/";
const grid = document.querySelector("#grid");
const filters = document.querySelector("#filters");
const search = document.querySelector("#search");
const empty = document.querySelector("#empty");
let icons = [];
let selectedCategory = "All icons";

function renderFilters() {
  const options = ["All icons", ...new Set(icons.map((icon) => icon.category))];
  filters.innerHTML = options.map((category) => `<button class="filter${category === selectedCategory ? " active" : ""}" type="button" data-category="${category}">${category}</button>`).join("");
}

function renderIcons() {
  const query = search.value.trim().toLowerCase();
  const filtered = icons.filter((icon) => (selectedCategory === "All icons" || icon.category === selectedCategory)
    && `${icon.name} ${icon.category}`.toLowerCase().includes(query));
  grid.innerHTML = filtered.map((icon) => `<article class="icon-card">
    <div class="variants" aria-label="${icon.name} symbol in black and white">
      <div class="variant-swatch black"><img src="${iconRoot}symbols-black/${icon.slug}.png" alt="" loading="lazy" /></div>
      <div class="variant-swatch white"><img src="${iconRoot}symbols-white/${icon.slug}.png" alt="" loading="lazy" /></div>
    </div>
    <div class="icon-name" title="${icon.name}">${icon.name}</div>
    <div class="icon-category">${icon.category}</div>
    <div class="icon-downloads">
      <a class="icon-download" href="${iconRoot}symbols-black/${icon.slug}.ico" download="${icon.slug}-black.ico">Black .ico</a>
      <a class="icon-download" href="${iconRoot}symbols-white/${icon.slug}.ico" download="${icon.slug}-white.ico">White .ico</a>
    </div>
  </article>`).join("");
  empty.hidden = filtered.length !== 0;
  grid.hidden = filtered.length === 0;
  document.querySelector("#icon-count").textContent = `${filtered.length} ${filtered.length === 1 ? "icon" : "icons"}`;
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderFilters();
  renderIcons();
});
search.addEventListener("input", renderIcons);

fetch(manifestUrl)
  .then((response) => {
    if (!response.ok) throw new Error("The icon list could not be loaded.");
    return response.json();
  })
  .then((data) => {
    icons = data;
    renderFilters();
    renderIcons();
  })
  .catch(() => {
    grid.hidden = true;
    empty.hidden = false;
    empty.textContent = "The icon library is unavailable right now. Refresh the page to try again.";
    document.querySelector("#icon-count").textContent = "Library unavailable";
  });
