import { PRIMARY_ADMIN } from "./firebase.js";
import { getAliases, loginWithAlias, logout, observeSession, validateCurrentUser } from "./auth.js";
import {
  cancelResolutionProposal,
  configurePartner,
  confirmResolution,
  editActiveConflictReason,
  ensureBootstrap,
  fetchConflictEvents,
  proposeResolution,
  registerConflict,
  registerVisit,
  rejectResolution,
  subscribeDashboard,
  updateCoupleSettings
} from "./data.js";
import { calculateStats } from "./stats.js";
import { getLoginCelebration } from "./gamification.js";
import { getReconciliationPhrase } from "./phrases.js";
import {
  closeDialog,
  openDialog,
  renderAuditEvents,
  renderDashboard,
  renderUser,
  setLoginAliases,
  setLoginBusy,
  showApp,
  showCelebration,
  showLogin,
  showNotificationPanel,
  showToast
} from "./ui.js";
import {
  dateFromInputs,
  localDateInputValue,
  localDateTimeInputValue,
  localTimeInputValue,
  toDate
} from "./utils.js";

const $ = id => document.getElementById(id);

const appState = {
  user: null,
  profile: null,
  dashboardData: null,
  stats: null,
  unsubscribeDashboard: null,
  timer: null
};

async function init() {
  bindStaticEvents();
  setConflictDefaults();

  try {
    const aliases = await getAliases(true);
    setLoginAliases(aliases);
  } catch (error) {
    console.warn(error);
  }

  observeSession(handleSessionChange);
}

function bindStaticEvents() {
  $("loginForm").addEventListener("submit", handleLogin);
  $("togglePassword").addEventListener("click", () => {
    const input = $("loginPassword");
    input.type = input.type === "password" ? "text" : "password";
  });

  $("userMenuButton").addEventListener("click", event => {
    event.stopPropagation();
    $("userMenu").classList.toggle("hidden");
  });
  document.addEventListener("click", () => $("userMenu").classList.add("hidden"));
  $("logoutButton").addEventListener("click", async () => {
    $("userMenu").classList.add("hidden");
    await logout();
  });

  $("notificationsButton").addEventListener("click", () => showNotificationPanel(true));
  $("closeNotificationsButton").addEventListener("click", () => showNotificationPanel(false));
  $("registerConflictButton").addEventListener("click", () => {
    if (appState.stats?.activeConflict) {
      showToast("Já existe uma ocorrência em andamento.", "error");
      return;
    }
    setConflictDefaults();
    openDialog("conflictDialog");
  });
  $("openHistoryButton").addEventListener("click", () => $("historico").scrollIntoView({ behavior: "smooth" }));
  $("openAccessHistoryButton").addEventListener("click", () => $("acessos").scrollIntoView({ behavior: "smooth", block: "start" }));
  $("openSettingsButton").addEventListener("click", openSettings);

  $("conflictForm").addEventListener("submit", handleConflictSubmit);
  $("editConflictForm").addEventListener("submit", handleEditConflictSubmit);
  $("settingsForm").addEventListener("submit", handleSettingsSubmit);

  document.addEventListener("click", handleDelegatedClick);
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
  });
}

async function handleLogin(event) {
  event.preventDefault();
  $("loginFeedback").textContent = "";
  setLoginBusy(true);
  try {
    await loginWithAlias($("loginName").value, $("loginPassword").value);
    $("loginPassword").value = "";
  } catch (error) {
    $("loginFeedback").textContent = friendlyAuthError(error);
  } finally {
    setLoginBusy(false);
  }
}

function friendlyAuthError(error) {
  const code = error?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Nome ou senha não conferem.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (code.includes("network-request-failed")) return "Sem conexão com o Firebase. Confira sua internet.";
  return error?.message || "Não foi possível entrar agora.";
}

async function handleSessionChange(user) {
  cleanupDashboardSubscription();
  appState.user = null;
  appState.profile = null;
  appState.dashboardData = null;
  appState.stats = null;

  if (!user) {
    showLogin();
    return;
  }

  try {
    const profile = await validateCurrentUser(user);
    if (!profile) {
      showLogin("Conta não autorizada para este monitoramento.");
      return;
    }

    appState.user = user;
    appState.profile = profile;
    await ensureBootstrap(user);
    renderUser(profile, user.uid === PRIMARY_ADMIN.uid);
    showApp();
    registerVisit(user).catch(console.warn);

    appState.unsubscribeDashboard = subscribeDashboard(handleDashboardData, error => {
      console.error(error);
      showToast("Não foi possível sincronizar os dados com o Firestore.", "error", 6000);
    });

    appState.timer = window.setInterval(() => {
      if (appState.dashboardData) updateComputedDashboard(false);
    }, 60_000);
  } catch (error) {
    console.error(error);
    showLogin(error?.message || "Falha ao abrir o monitoramento.");
  }
}

function cleanupDashboardSubscription() {
  if (appState.unsubscribeDashboard) appState.unsubscribeDashboard();
  if (appState.timer) window.clearInterval(appState.timer);
  appState.unsubscribeDashboard = null;
  appState.timer = null;
}

function handleDashboardData(data) {
  appState.dashboardData = data;
  updateComputedDashboard(true);
}

function updateComputedDashboard(checkCelebration) {
  const stats = calculateStats({ ...appState.dashboardData, now: new Date() });
  appState.stats = stats;
  renderDashboard({
    stats,
    settings: appState.dashboardData.settings,
    profile: appState.profile,
    accessLogs: appState.dashboardData.accessLogs ?? [],
    accessLogsStatus: appState.dashboardData.accessLogsStatus ?? "loading"
  });
  const label = appState.dashboardData.settings?.coupleLabel;
  document.title = label ? `${label} — Dias Sem Brigas` : "Dias Sem Brigas";
  if (checkCelebration) maybeCelebrate(stats);
}

function maybeCelebrate(stats) {
  const celebration = getLoginCelebration(stats);
  if (!celebration || !appState.user) return;
  const key = `dsb:celebration:${appState.user.uid}:${celebration.type}:${celebration.days}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, String(Date.now()));
  showCelebration({
    emoji: celebration.emoji,
    title: celebration.title,
    message: celebration.message,
    eyebrow: celebration.type === "record" ? "NOVO RECORDE NACIONAL" : "MARCO DESBLOQUEADO",
    intensity: celebration.type === "record" ? 110 : 70
  });
}

function setConflictDefaults() {
  const now = new Date();
  $("conflictDate").value = localDateInputValue(now);
  $("conflictTime").value = localTimeInputValue(now);
  $("conflictReason").value = "";
}

async function handleConflictSubmit(event) {
  event.preventDefault();
  const startedAt = dateFromInputs($("conflictDate").value, $("conflictTime").value);
  const button = $("saveConflictButton");
  button.disabled = true;
  button.textContent = "Registrando…";
  try {
    await registerConflict({
      reason: $("conflictReason").value,
      startedAt,
      user: appState.user,
      displayName: appState.profile.displayName
    });
    closeDialog("conflictDialog");
    showToast("Ocorrência registrada. O contador foi pausado até a reconciliação.", "success", 5000);
  } catch (error) {
    showToast(error.message, "error", 5000);
  } finally {
    button.disabled = false;
    button.textContent = "Registrar ocorrência";
  }
}

async function handleDelegatedClick(event) {
  const conflictButton = event.target.closest("[data-conflict-action]");
  if (conflictButton) {
    await handleConflictAction(conflictButton.dataset.conflictAction, conflictButton.dataset.id);
    return;
  }

  const historyButton = event.target.closest("[data-history-action='events']");
  if (historyButton) {
    historyButton.disabled = true;
    try {
      const events = await fetchConflictEvents(historyButton.dataset.id);
      renderAuditEvents(historyButton.dataset.id, events);
    } catch (error) {
      showToast("Não foi possível carregar as movimentações.", "error");
    } finally {
      historyButton.disabled = false;
    }
  }
}

async function handleConflictAction(action, conflictId) {
  const active = appState.stats?.activeConflict;
  if (!active || active.id !== conflictId) {
    showToast("Esta ocorrência já mudou de estado. Aguarde a sincronização.", "error");
    return;
  }

  try {
    if (action === "edit") {
      $("editConflictReason").value = active.reason ?? "";
      $("editConflictForm").dataset.conflictId = active.id;
      openDialog("editConflictDialog");
      return;
    }

    if (action === "propose") {
      await proposeResolution({ conflictId, user: appState.user, displayName: appState.profile.displayName });
      showToast("Pedido de reconciliação enviado. Agora o outro usuário precisa confirmar.", "success", 5200);
      return;
    }

    if (action === "cancel-proposal") {
      await cancelResolutionProposal({ conflictId, user: appState.user, displayName: appState.profile.displayName });
      showToast("Pedido de reconciliação cancelado.");
      return;
    }

    if (action === "reject") {
      await rejectResolution({ conflictId, user: appState.user, displayName: appState.profile.displayName });
      showToast("Registrado: você ainda não considera a situação resolvida.");
      return;
    }

    if (action === "confirm") {
      await confirmResolution({ conflictId, user: appState.user, displayName: appState.profile.displayName });
      showCelebration({
        emoji: "🤝",
        title: "Paz restabelecida!",
        message: getReconciliationPhrase(`${conflictId}-${Date.now()}`),
        eyebrow: "ACORDO BILATERAL CONFIRMADO",
        intensity: 90
      });
    }
  } catch (error) {
    showToast(error.message, "error", 5200);
  }
}

async function handleEditConflictSubmit(event) {
  event.preventDefault();
  const conflictId = event.currentTarget.dataset.conflictId;
  try {
    await editActiveConflictReason({
      conflictId,
      reason: $("editConflictReason").value,
      user: appState.user,
      displayName: appState.profile.displayName
    });
    closeDialog("editConflictDialog");
    showToast("Ocorrência atualizada e movimentação registrada.", "success");
  } catch (error) {
    showToast(error.message, "error", 5200);
  }
}

function openSettings() {
  const settings = appState.dashboardData?.settings ?? {};
  $("coupleLabelInput").value = settings.coupleLabel ?? "Rodrigo & Digníssima";
  $("monitorStartInput").value = localDateTimeInputValue(settings.monitorStartAt);
  $("partnerAliasInput").value = settings.partnerName ?? "Digníssima";
  $("partnerEmailInput").value = settings.partnerEmail ?? "";
  $("partnerUidInput").value = settings.partnerUid ?? "";
  openDialog("settingsDialog");
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const monitorStartValue = $("monitorStartInput").value;
  const partnerValues = {
    alias: $("partnerAliasInput").value.trim(),
    email: $("partnerEmailInput").value.trim(),
    uid: $("partnerUidInput").value.trim()
  };
  try {
    const hasAnyPartnerField = Object.values(partnerValues).some(Boolean);
    const hasAllPartnerFields = Object.values(partnerValues).every(Boolean);
    if (hasAnyPartnerField && !hasAllPartnerFields) throw new Error("Para configurar o segundo acesso, preencha nome, e-mail e UID.");

    await updateCoupleSettings({
      coupleLabel: $("coupleLabelInput").value,
      monitorStartAt: monitorStartValue ? new Date(monitorStartValue) : null,
      user: appState.user
    });

    if (hasAllPartnerFields) {
      await configurePartner({ ...partnerValues, user: appState.user });
      const aliases = await getAliases(true);
      setLoginAliases(aliases);
    }

    closeDialog("settingsDialog");
    showToast("Configurações salvas.", "success");
  } catch (error) {
    showToast(error.message, "error", 6000);
  }
}

window.addEventListener("beforeunload", cleanupDashboardSubscription);
init();
