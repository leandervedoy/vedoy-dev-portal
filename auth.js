(function () {
  const button = document.querySelector("#account-button");
  const modal = document.querySelector("#auth-modal");
  const close = document.querySelector("#auth-close");
  const form = document.querySelector("#auth-form");
  const message = document.querySelector("#auth-message");
  const submit = document.querySelector("#auth-submit");
  const account = document.querySelector("#auth-account");
  const emailLabel = document.querySelector("#auth-user-email");
  let client;

  function showMessage(text, kind = "error") {
    message.textContent = text;
    message.dataset.kind = kind;
  }

  function setSession(user) {
    button.innerHTML = user ? `${escapeText(user.user_metadata?.full_name || user.email?.split("@")[0] || "Account")} <span>⌄</span>` : 'Sign in <span>↗</span>';
    form.hidden = Boolean(user);
    account.hidden = !user;
    emailLabel.textContent = user?.email || "";
    document.body.classList.toggle("auth-open", !modal.hidden);
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("auth-open");
    if (!account.hidden) {
      document.querySelector("#auth-title").textContent = "Your account.";
    } else {
      document.querySelector("#auth-title").textContent = "Welcome back.";
      window.setTimeout(() => document.querySelector("#auth-email").focus(), 0);
    }
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("auth-open");
    button.focus();
  }

  button.addEventListener("click", openModal);
  close.addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });

  const config = window.VEDOY_SUPABASE_CONFIG;
  if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) {
    button.disabled = true;
    button.title = "Supabase client configuration is missing";
    return;
  }

  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  window.vedoySupabase = client;

  async function updateAccount(user) {
    if (!user) { setSession(null); return; }
    let profileName = "";
    const { data } = await client.from("vedoy_profiles").select("display_name").eq("id", user.id).maybeSingle();
    profileName = data?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Account";
    button.innerHTML = `${escapeText(profileName)} <span>⌄</span>`;
    form.hidden = true;
    account.hidden = false;
    emailLabel.textContent = user.email || "";
  }

  client.auth.getSession().then(({ data }) => updateAccount(data.session?.user || null));
  client.auth.onAuthStateChange((_event, session) => { updateAccount(session?.user || null); });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = new FormData(form).get("email").toString().trim();
    const password = new FormData(form).get("password").toString();
    submit.disabled = true;
    submit.innerHTML = "Signing in…";
    message.textContent = "";
    const { error } = await client.auth.signInWithPassword({ email, password });
    submit.disabled = false;
    submit.innerHTML = 'Sign in securely <span>→</span>';
    if (error) {
      showMessage(error.message.includes("Invalid login") ? "That email and password combination wasn’t recognized." : error.message);
      return;
    }
    showMessage("You’re signed in. Welcome to the developer hub.", "success");
    window.setTimeout(closeModal, 450);
  });

  document.querySelector("#auth-signout").addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) { showMessage(error.message); return; }
    showMessage("You’ve signed out.", "success");
    setSession(null);
  });
})();
