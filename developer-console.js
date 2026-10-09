(function () {
  const api = "/api/v1";
  let token = "";
  let projects = [];
  let balances = [];
  let usage = [];
  let issuedApiKey = "";
  let issuedProjectId = "";
  let apiRequestComplete = false;

  const root = () => document.querySelector("[data-developer-console]");
  const client = () => window.vedoySupabase;
  const field = selector => root()?.querySelector(selector);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  function message(text, error = false) {
    const element = field("[data-console-message]");
    if (!element) return;
    element.textContent = text;
    element.dataset.error = String(error);
  }

  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || "The Developer API request failed.");
    return payload.data;
  }

  function setTask(name, state, label) {
    const task = field(`[data-console-task="${name}"]`);
    if (!task) return;
    task.dataset.state = state;
    const stateLabel = task.querySelector("[data-console-task-state]");
    if (stateLabel) stateLabel.textContent = label;
  }

  function renderQuickstart() {
    const command = field("[data-quickstart-command]");
    const copy = field("[data-quickstart-copy]");
    const test = field("[data-test-api]");
    if (!command || !copy || !test) return;
    command.textContent = `curl https://vedoy-dev-portal.vercel.app/api/v1/models \\\n  -H "Authorization: Bearer ${issuedApiKey || "$VEDOY_API_KEY"}"`;
    copy.textContent = issuedApiKey
      ? "Your new key is inserted below. Copy this command into a server terminal, or test it here."
      : "Create an API key in step 2 to insert it into this command.";
    test.disabled = !issuedApiKey;
  }

  function renderTasks(projectId) {
    const hasProject = Boolean(projectId);
    setTask("project", hasProject ? "complete" : "active", hasProject ? "Complete" : "Active");
    setTask("key", hasProject && issuedApiKey ? "complete" : hasProject ? "active" : "locked", hasProject && issuedApiKey ? "Complete" : hasProject ? "Active" : "Locked");
    setTask("request", apiRequestComplete ? "complete" : issuedApiKey ? "active" : "locked", apiRequestComplete ? "Complete" : issuedApiKey ? "Ready" : "Locked");
    renderQuickstart();
  }

  function render() {
    const select = field("[data-project-select]");
    if (!select) return;
    const selected = select.value || projects[0]?.id || "";
    select.innerHTML = projects.length
      ? projects.map(project => `<option value="${safe(project.id)}">${safe(project.name)}</option>`).join("")
      : '<option value="">Create your first project</option>';
    if (projects.some(project => project.id === selected)) select.value = selected;
    const projectId = select.value;
    const balance = balances.find(item => item.project_id === projectId)?.balance_microunits;
    const projectUsage = usage.filter(item => item.project_id === projectId);
    field("[data-console-balance]").textContent = balance == null ? "—" : (Number(balance) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
    field("[data-console-usage]").textContent = projectUsage.length.toLocaleString("en-US");
    field("[data-key-form]").querySelector("button").disabled = !projectId;
    if (issuedProjectId && issuedProjectId !== projectId) {
      issuedApiKey = "";
      issuedProjectId = "";
      apiRequestComplete = false;
      field("[data-quickstart-result]").hidden = true;
    }
    renderTasks(projectId);
  }

  async function load() {
    if (!root() || !client()) return;
    const { data } = await client().auth.getSession();
    token = data.session?.access_token || "";
    field("[data-console-auth]").hidden = Boolean(token);
    field("[data-console-app]").hidden = !token;
    field("[data-console-status]").textContent = token ? "Account connected" : "Sign-in required";
    if (!token) return;
    message("Loading your developer account…");
    try {
      [projects, balances, usage] = await Promise.all([
        request("/projects"),
        request("/credits/balance"),
        request("/usage"),
      ]);
      render();
      message(projects.length ? "Developer account ready." : "Create your first project to receive 200 Vedøy Credits.");
    } catch (error) {
      message(error.message, true);
    }
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-console-signin]")) document.querySelector("#account-button")?.click();
    if (event.target.closest("[data-copy-key]")) {
      const value = field("[data-key-value]")?.textContent || "";
      if (value) await navigator.clipboard.writeText(value);
      message("API key copied. Store it in a server-side secret manager.");
    }
    if (event.target.closest("[data-test-api]")) {
      const button = field("[data-test-api]");
      const result = field("[data-quickstart-result]");
      if (!issuedApiKey || !button || !result) return;
      button.disabled = true;
      button.textContent = "Testing…";
      try {
        const response = await fetch(`${api}/models`, { headers: { Authorization: `Bearer ${issuedApiKey}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error?.message || "The API did not accept this key.");
        const models = Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(payload.data?.models)
            ? payload.data.models
            : [];
        const count = models.length;
        result.hidden = false;
        result.dataset.state = "success";
        result.textContent = `Connected. GET /v1/models returned ${count} model route${count === 1 ? "" : "s"}.`;
        apiRequestComplete = true;
        renderTasks(field("[data-project-select]")?.value || "");
        message("Your first authenticated API request succeeded.");
      } catch (error) {
        result.hidden = false;
        result.dataset.state = "error";
        result.textContent = error.message;
        message(error.message, true);
      } finally {
        button.disabled = false;
        button.innerHTML = "Test API connection <span>→</span>";
      }
    }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("[data-project-select]")) render();
  });

  document.addEventListener("submit", async event => {
    if (event.target.matches("[data-project-form]")) {
      event.preventDefault();
      const button = event.target.querySelector("button");
      button.disabled = true;
      try {
        const name = new FormData(event.target).get("name");
        await request("/projects", { method: "POST", body: JSON.stringify({ name }) });
        event.target.reset();
        await load();
        message("Project created with 200 Vedøy Credits.");
      } catch (error) { message(error.message, true); }
      finally { button.disabled = false; }
    }
    if (event.target.matches("[data-key-form]")) {
      event.preventDefault();
      const projectId = field("[data-project-select]").value;
      const button = event.target.querySelector("button");
      if (!projectId) return;
      button.disabled = true;
      try {
        const name = new FormData(event.target).get("name");
        const created = await request(`/projects/${projectId}/api-keys`, { method: "POST", body: JSON.stringify({ name }) });
        field("[data-key-value]").textContent = created.key;
        field("[data-key-result]").hidden = false;
        issuedApiKey = created.key;
        issuedProjectId = projectId;
        apiRequestComplete = false;
        field("[data-quickstart-result]").hidden = true;
        renderTasks(projectId);
        message("API key created. This is the only time the full key is shown.");
      } catch (error) { message(error.message, true); }
      finally { button.disabled = false; }
    }
  });

  document.addEventListener("vedoy-page-change", event => {
    if (event.detail?.page === "developer-api") window.setTimeout(load, 0);
  });

  const wait = window.setInterval(() => {
    if (!client()) return;
    window.clearInterval(wait);
    client().auth.onAuthStateChange(() => {
      if (root()) window.setTimeout(load, 0);
    });
    if (location.hash === "#developer-api") load();
  }, 50);
  window.setTimeout(() => window.clearInterval(wait), 5000);
})();
