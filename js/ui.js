import { getDailyPhrase } from "./phrases.js";
import { getMilestoneProgress, getTier, getUnlockedAchievements, MILESTONES } from "./gamification.js";
import { escapeHtml, formatDateShort, formatDateTime, formatDuration, relativeTime, toDate } from "./utils.js";

const $ = id => document.getElementById(id);
const tierClasses = ["tier-training", "tier-stable", "tier-diplomacy", "tier-legend", "tier-heritage"];

export function setLoginAliases(aliases) {
  const list = $("knownUsers");
  list.innerHTML = Object.values(aliases)
    .filter(item => item?.displayName)
    .map(item => `<option value="${escapeHtml(item.displayName)}"></option>`)
    .join("");
}

export function showLogin(feedback = "") {
  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
  $("loginFeedback").textContent = feedback;
}

export function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
}

export function setLoginBusy(busy) {
  const button = $("loginButton");
  button.disabled = busy;
  button.querySelector("span:first-child").textContent = busy ? "Entrando…" : "Entrar no monitoramento";
}

export function renderUser(profile, isAdmin) {
  const displayName = profile?.displayName || "Usuário";
  $("userDisplayName").textContent = displayName;
  $("userAvatar").textContent = displayName.slice(0, 1).toUpperCase();
  $("userStatusText").textContent = isAdmin ? "no comando" : "no plantão diplomático";
  $("openSettingsButton").classList.toggle("hidden", !isAdmin);
}

export function renderDashboard({ stats, settings, profile, accessLogs = [], accessLogsStatus = "ready" }) {
  const tier = getTier(stats.currentDays);
  const milestone = getMilestoneProgress(stats.currentDays);
  const hero = $("heroCard");
  hero.classList.remove(...tierClasses);
  hero.classList.add(tier.theme);

  const conflictActive = Boolean(stats.activeConflict);
  $("liveStatusBadge").className = `status-badge ${conflictActive ? "conflict" : "peace"}`;
  $("liveStatusBadge").textContent = conflictActive ? "● Paz em manutenção" : "● Tudo em paz";
  $("lastUpdated").textContent = `Atualizado ${relativeTime(stats.lastUpdate)}`;
  $("heroIntro").textContent = conflictActive ? "Sequência pausada em" : "Estamos há";
  $("currentDays").textContent = String(stats.currentDays);
  $("heroHeadline").textContent = conflictActive ? "dias acumulados antes da ocorrência" : "dias sem brigas";
  $("tierBadge").textContent = `${tier.emoji} ${tier.title}`;
  $("dailyPhrase").textContent = getDailyPhrase({ days: stats.currentDays, userKey: profile?.uid ?? "casal", conflictActive });
  $("heroRecord").textContent = `${stats.recordDays} ${stats.recordDays === 1 ? "dia" : "dias"}`;
  $("heroLastConflict").textContent = stats.lastConflict?.startedAt ? formatDateShort(stats.lastConflict.startedAt) : "Ainda não houve";
  $("heroLastReconciliation").textContent = stats.lastReconciliation?.resolvedAt ? formatDateShort(stats.lastReconciliation.resolvedAt) : "Ainda não houve";
  $("heroRecordGap").textContent = conflictActive ? "Contagem pausada" : stats.recordGapText;

  if (milestone.next) {
    $("nextMilestoneLabel").textContent = `${milestone.next.days} dias — ${milestone.next.title}`;
    $("nextMilestoneRemaining").textContent = String(milestone.remaining);
    $("milestoneProgress").style.width = `${milestone.percent}%`;
  } else {
    $("nextMilestoneLabel").textContent = "Todos os marcos principais alcançados";
    $("nextMilestoneRemaining").textContent = "✓";
    $("milestoneProgress").style.width = "100%";
  }

  renderConflictBanner(stats.activeConflict, profile, settings);
  renderStats(stats);
  renderAchievements(stats);
  renderHistory(stats, settings);
  renderAccessHistory(accessLogs, accessLogsStatus);
  renderNotifications(stats, settings, profile);
}

function renderConflictBanner(conflict, profile, settings) {
  const banner = $("conflictBanner");
  if (!conflict) {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");
  $("conflictBannerTitle").textContent = conflict.resolutionProposal ? "Reconciliação em análise" : "Conflito em andamento";
  $("conflictBannerReason").textContent = conflict.reason || "Ocorrência sem descrição.";
  $("conflictStartedAt").textContent = `Início: ${formatDateTime(conflict.startedAt)}`;
  $("conflictCreatedBy").textContent = `Registrado por ${conflict.createdByName || "usuário"}`;

  const actions = $("conflictActions");
  const proposal = conflict.resolutionProposal;
  if (!proposal) {
    actions.innerHTML = `
      <button class="primary-button" type="button" data-conflict-action="propose" data-id="${conflict.id}">🤝 Considero resolvido</button>
      <button class="secondary-button" type="button" data-conflict-action="edit" data-id="${conflict.id}">Editar registro</button>
    `;
    return;
  }

  if (proposal.proposedByUid === profile.uid) {
    const otherName = profile.role === "admin" ? (settings.partnerName || "o outro usuário") : "Rodrigo";
    actions.innerHTML = `
      <span class="muted-small">Aguardando confirmação de ${escapeHtml(otherName)}.</span>
      <button class="secondary-button" type="button" data-conflict-action="cancel-proposal" data-id="${conflict.id}">Cancelar pedido</button>
    `;
  } else {
    actions.innerHTML = `
      <span class="muted-small">${escapeHtml(proposal.proposedByName || "A outra parte")} considera a situação resolvida.</span>
      <button class="primary-button" type="button" data-conflict-action="confirm" data-id="${conflict.id}">✓ Concordo, paz restabelecida</button>
      <button class="secondary-button" type="button" data-conflict-action="reject" data-id="${conflict.id}">Ainda não considero resolvido</button>
    `;
  }
}

function renderStats(stats) {
  $("statVisits").textContent = new Intl.NumberFormat("pt-BR").format(stats.totalVisits);
  $("statCurrentDays").textContent = String(stats.currentDays);
  $("statRecord").textContent = `${stats.recordDays} dias`;
  $("statConflicts").textContent = String(stats.conflictsCount);
  $("statReconciliations").textContent = String(stats.reconciliations);
  $("statMonitoredDays").textContent = `${stats.monitoredDays} dias`;
  $("statLastUpdate").textContent = relativeTime(stats.lastUpdate);
  $("statPeacePercent").textContent = `${stats.peacePercent.toFixed(stats.peacePercent >= 99 ? 0 : 1)}%`;
  $("statRecordBreaks").textContent = String(stats.recordBreakCount);
  $("statLastConflict").textContent = stats.lastConflict?.startedAt ? formatDateShort(stats.lastConflict.startedAt) : "—";
  $("statAveragePeace").textContent = stats.averagePeaceMs == null ? "—" : formatDuration(stats.averagePeaceMs);
  $("statAverageConflict").textContent = stats.averageConflictMs == null ? "—" : formatDuration(stats.averageConflictMs);
  $("statLongestConflict").textContent = stats.longestConflict ? formatDuration(stats.longestConflict.durationMs) : "—";
  $("statFastestConflict").textContent = stats.fastestConflict ? formatDuration(stats.fastestConflict.durationMs) : "—";

  $("topRecords").innerHTML = stats.topPeace.length
    ? stats.topPeace.map((item, index) => `
      <div class="podium-item">
        <span>${["🥇", "🥈", "🥉"][index] ?? "•"}</span>
        <div><strong>${item.days} ${item.days === 1 ? "dia" : "dias"}</strong><br><small>${formatDateShort(item.start)} → ${item.completed ? formatDateShort(item.end) : "em andamento"}</small></div>
        <small>${item.completed ? "concluído" : "atual"}</small>
      </div>
    `).join("")
    : `<div class="podium-item"><span>🌱</span><div><strong>Primeiro recorde em formação</strong><br><small>A história está começando.</small></div></div>`;
}

function renderAchievements(stats) {
  const achievements = getUnlockedAchievements(stats);
  const unlocked = achievements.filter(item => item.unlocked).length;
  $("achievementSummary").textContent = `${unlocked} de ${achievements.length} conquistas liberadas.`;
  $("achievementsGrid").innerHTML = achievements.map(item => `
    <article class="achievement-card ${item.unlocked ? "unlocked" : "locked"} ${item.secret ? "secret" : ""}">
      <span class="achievement-state">${item.unlocked ? "Desbloqueada" : item.secret ? "Secreta" : "Bloqueada"}</span>
      <div class="achievement-icon">${item.unlocked ? item.icon : "🔒"}</div>
      <strong class="achievement-title">${escapeHtml(item.title)}</strong>
      <p class="achievement-desc">${escapeHtml(item.desc)}</p>
    </article>
  `).join("");
}

function buildRecordConflictIds(stats) {
  const ids = new Set();
  let best = -1;
  for (const interval of stats.peaceIntervals.filter(item => item.completed)) {
    if (interval.days > best) {
      if (interval.endedByConflictId) ids.add(interval.endedByConflictId);
      best = interval.days;
    }
  }
  return ids;
}

function renderHistory(stats) {
  const container = $("historyList");
  const conflicts = [...(stats.resolvedConflicts ?? [])];
  if (stats.activeConflict) conflicts.push(stats.activeConflict);
  const allConflicts = conflicts.sort((a, b) => (toDate(b.startedAt)?.getTime() ?? 0) - (toDate(a.startedAt)?.getTime() ?? 0));
  if (!allConflicts.length) {
    container.innerHTML = `<div class="history-empty">🌷 Nenhuma ocorrência registrada. Que continue assim por bastante tempo.</div>`;
    return;
  }
  const recordIds = buildRecordConflictIds(stats);
  container.innerHTML = allConflicts.map((conflict, index) => {
    const started = toDate(conflict.startedAt);
    const resolved = toDate(conflict.resolvedAt);
    const duration = resolved && started ? resolved.getTime() - started.getTime() : (started ? Date.now() - started.getTime() : 0);
    const proposal = conflict.resolutionProposal;
    return `
      <article class="history-item" data-conflict-card="${conflict.id}">
        <div class="history-head">
          <div class="history-number">
            <span>${allConflicts.length - index}</span>
            <div><h3>Ocorrência diplomática</h3><small>${formatDateTime(conflict.startedAt)}</small></div>
          </div>
          <span class="history-status ${conflict.status === "active" ? "active" : ""}">${conflict.status === "active" ? "Em andamento" : "Resolvida"}</span>
        </div>
        <div class="history-reason">${escapeHtml(conflict.reason || "Sem descrição")}</div>
        <div class="history-meta-grid">
          <div class="history-meta"><small>Registrada por</small><strong>${escapeHtml(conflict.createdByName || "—")}</strong></div>
          <div class="history-meta"><small>Duração</small><strong>${formatDuration(duration)}</strong></div>
          <div class="history-meta"><small>Dias antes da ocorrência</small><strong>${Number(conflict.daysBeforeConflict ?? 0)} dias ${recordIds.has(conflict.id) ? "🏆" : ""}</strong></div>
          <div class="history-meta"><small>Reconciliação</small><strong>${conflict.status === "resolved" ? formatDateTime(conflict.resolvedAt) : proposal ? "Aguardando confirmação" : "Pendente"}</strong></div>
          ${conflict.status === "resolved" ? `<div class="history-meta"><small>Proposta por</small><strong>${escapeHtml(proposal?.proposedByName || "—")}</strong></div><div class="history-meta"><small>Confirmada por</small><strong>${escapeHtml(conflict.confirmedByName || proposal?.confirmedByName || "—")}</strong></div>` : ""}
        </div>
        <div class="history-actions">
          <button class="secondary-button" type="button" data-history-action="events" data-id="${conflict.id}">Ver movimentações</button>
          ${conflict.status === "active" && !proposal ? `<button class="text-button" type="button" data-conflict-action="edit" data-id="${conflict.id}">Editar ocorrência</button>` : ""}
        </div>
        <div class="audit-list hidden" data-audit-for="${conflict.id}"></div>
      </article>
    `;
  }).join("");
}

function renderAccessHistory(accessLogs, status = "ready") {
  const list = $("accessHistoryList");
  const summary = $("accessHistorySummary");
  if (!list || !summary) return;

  const logs = Array.isArray(accessLogs) ? accessLogs : [];

  if (status === "loading") {
    summary.textContent = "Carregando os últimos logins…";
    list.innerHTML = `<div class="access-empty"><span aria-hidden="true">⏳</span><div><strong>Consultando o histórico.</strong><p>Isso normalmente leva apenas alguns instantes.</p></div></div>`;
    return;
  }

  if (status === "error") {
    summary.textContent = "Não foi possível consultar os últimos logins.";
    list.innerHTML = `<div class="access-empty access-error"><span aria-hidden="true">⚠️</span><div><strong>Falha ao acessar o histórico.</strong><p>Confira se as regras da coleção accessLogs foram publicadas e atualize a página com Ctrl + F5.</p></div></div>`;
    return;
  }

  summary.textContent = logs.length
    ? `Exibindo os ${logs.length} logins mais recentes.`
    : "Nenhum login registrado ainda.";

  if (!logs.length) {
    list.innerHTML = `
      <div class="access-empty">
        <span aria-hidden="true">🔐</span>
        <div><strong>Ainda não há histórico de acesso.</strong><p>Os próximos logins realizados com sucesso passarão a aparecer aqui.</p></div>
      </div>
    `;
    return;
  }

  list.innerHTML = logs.map((entry, index) => {
    const name = entry.userName || "Usuário";
    const initial = name.trim().slice(0, 1).toUpperCase() || "•";
    const absolute = formatDateTime(entry.signedInAt);
    const relative = relativeTime(entry.signedInAt);
    return `
      <article class="access-item">
        <div class="access-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
        <div class="access-copy">
          <strong>${escapeHtml(name)}</strong>
          <span>Entrou no aplicativo</span>
        </div>
        <div class="access-time">
          <strong>${escapeHtml(absolute)}</strong>
          <small>${escapeHtml(relative)}</small>
        </div>
        <span class="access-sequence" aria-label="Posição no histórico">#${index + 1}</span>
      </article>
    `;
  }).join("");
}

function renderNotifications(stats, settings, profile) {
  const items = [];
  const active = stats.activeConflict;
  if (active?.resolutionProposal && active.resolutionProposal.proposedByUid !== profile.uid) {
    items.push({ icon: "🤝", text: `${active.resolutionProposal.proposedByName || "A outra parte"} sinalizou que a situação foi resolvida. Sua confirmação está pendente.` });
  }
  if (!active && stats.completedRecordDays > 0 && stats.daysToBeatRecord != null && stats.daysToBeatRecord <= 3 && stats.daysToBeatRecord > 0) {
    items.push({ icon: "🏆", text: `Faltam apenas ${stats.daysToBeatRecord} ${stats.daysToBeatRecord === 1 ? "dia" : "dias"} para superar o recorde anterior.` });
  }
  const milestone = MILESTONES.find(item => item.days === stats.currentDays);
  if (!active && milestone) items.push({ icon: milestone.emoji, text: `Hoje vocês atingiram ${milestone.days} dias: ${milestone.title}.` });
  if (!settings.partnerUid && profile.role === "admin") items.push({ icon: "👥", text: "O segundo usuário ainda não foi configurado. Abra Configurações para liberar o acesso da digníssima." });

  $("notificationDot").classList.toggle("hidden", items.length === 0);
  $("notificationList").innerHTML = items.length
    ? items.map(item => `<div class="notice-item"><span>${item.icon}</span><p>${escapeHtml(item.text)}</p></div>`).join("")
    : `<div class="notice-item"><span>🌿</span><p>Nenhuma pendência importante agora. O sistema recomenda seguir normalmente.</p></div>`;
}

export function showNotificationPanel(show = true) {
  $("notificationPanel").classList.toggle("hidden", !show);
  if (show) $("notificationPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}

export function showToast(message, type = "default", duration = 3600) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  $("toastRegion").appendChild(toast);
  window.setTimeout(() => toast.remove(), duration);
}

export function showCelebration({ emoji = "🏆", title, message, eyebrow = "MARCO DESBLOQUEADO", intensity = 70 }) {
  $("celebrationEmoji").textContent = emoji;
  $("celebrationEyebrow").textContent = eyebrow;
  $("celebrationTitle").textContent = title;
  $("celebrationMessage").textContent = message;
  const dialog = $("celebrationDialog");
  if (!dialog.open) dialog.showModal();
  launchConfetti(intensity);
}

export function launchConfetti(amount = 70) {
  const layer = $("confettiLayer");
  const palette = ["#d96f8d", "#cfc4ef", "#cfe9dd", "#f6d4bd", "#e6c97b", "#cfe1f4"];
  for (let i = 0; i < amount; i += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = palette[i % palette.length];
    piece.style.setProperty("--fall", `${2.1 + Math.random() * 2.1}s`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--rot", `${Math.random() * 180}deg`);
    layer.appendChild(piece);
    window.setTimeout(() => piece.remove(), 4600);
  }
}

export function renderAuditEvents(conflictId, events) {
  const box = document.querySelector(`[data-audit-for="${CSS.escape(conflictId)}"]`);
  if (!box) return;
  if (!box.classList.contains("hidden")) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.innerHTML = events.length
    ? `<div style="margin-top:14px;padding:14px;border-radius:14px;background:#fbf7fa;display:grid;gap:9px;">${events.map(event => `<div style="display:grid;grid-template-columns:auto 1fr;gap:10px;"><span>•</span><div><strong style="font-size:.82rem;">${escapeHtml(event.label || event.type)}</strong><br><small style="color:var(--muted);">${formatDateTime(event.createdAt)} · ${escapeHtml(event.actorName || "sistema")}</small>${event.details ? `<p style="margin:4px 0 0;font-size:.8rem;">${escapeHtml(event.details)}</p>` : ""}</div></div>`).join("")}</div>`
    : `<div style="margin-top:14px;color:var(--muted);font-size:.82rem;">Sem movimentações adicionais.</div>`;
  box.classList.remove("hidden");
}

export function openDialog(id) {
  const dialog = $(id);
  if (dialog && !dialog.open) dialog.showModal();
}

export function closeDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
}
