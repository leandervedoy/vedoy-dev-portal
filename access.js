(function () {
  let currentUser = null;
  let loadedForPage = false;

  const client = () => window.vedoySupabase;
  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  function showMessage(text, kind = "error") {
    const message = document.querySelector("#access-message");
    if (!message) return;
    message.textContent = text;
    message.dataset.kind = kind;
  }

  async function loadRequests() {
    const history = document.querySelector("#access-history");
    if (!currentUser || loadedForPage || !history || !client()) return;
    loadedForPage = true;
    const { data, error } = await client().from("developer_access_requests")
      .select("id,organization,products,status,created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      loadedForPage = false;
      showMessage("We could not load your previous requests.");
      return;
    }
    if (!data?.length) {
      history.hidden = true;
      return;
    }
    history.innerHTML = `<h2>Your requests</h2>${data.map(item => `<article class="access-request"><div><strong>${safe(item.organization)}</strong><p>${safe((item.products || []).join(", ") || "Platform access")}</p></div><span class="request-status">${safe(item.status.replaceAll("_", " "))}</span></article>`).join("")}`;
    history.hidden = false;
  }

  function renderAuth() {
    const gate = document.querySelector("#access-auth-gate");
    const form = document.querySelector("#access-form");
    if (!gate || !form) return;
    gate.hidden = Boolean(currentUser);
    form.hidden = !currentUser;
    if (currentUser) loadRequests();
    else document.querySelector("#access-history")?.setAttribute("hidden", "");
  }

  async function syncSession() {
    if (!client()) return;
    const { data } = await client().auth.getSession();
    currentUser = data.session?.user || null;
    renderAuth();
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-auth]")) document.querySelector("#account-button")?.click();
  });

  document.addEventListener("submit", async event => {
    if (event.target.id !== "access-form") return;
    event.preventDefault();
    const form = event.target;
    const submit = document.querySelector("#access-submit");
    if (!currentUser || !client()) {
      showMessage("Sign in with your Vedøy account before submitting.");
      return;
    }
    const values = new FormData(form);
    const products = [...form.querySelectorAll('input[name="products"]:checked')].map(input => input.value);
    submit.disabled = true;
    showMessage("");
    const { error } = await client().from("developer_access_requests").insert({
      organization: String(values.get("organization") || "").trim(),
      website: String(values.get("website") || "").trim() || null,
      products,
      use_case: String(values.get("use_case") || "").trim(),
    });
    submit.disabled = false;
    if (error) {
      showMessage(error.code === "23505"
        ? "You already have an open request. Its current status is shown below."
        : "We could not send your request just now. Please try again.");
      if (error.code === "23505") { loadedForPage = false; loadRequests(); }
      return;
    }
    form.reset();
    showMessage("Request sent. You can follow its status here.", "success");
    loadedForPage = false;
    await loadRequests();
  });

  document.addEventListener("vedoy-page-change", event => {
    if (event.detail?.page === "access") syncSession();
  });

  const start = window.setInterval(() => {
    if (!client()) return;
    window.clearInterval(start);
    client().auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      loadedForPage = false;
      renderAuth();
    });
    syncSession();
  }, 50);
  window.setTimeout(() => window.clearInterval(start), 5000);
})();
