import { clamp } from "./utils.js";

export const TIERS = [
  { min: 0, max: 6, key: "training", emoji: "🥉", title: "Casal em Treinamento", theme: "tier-training" },
  { min: 7, max: 29, key: "stable", emoji: "🥈", title: "Casal Estável", theme: "tier-stable" },
  { min: 30, max: 89, key: "diplomacy", emoji: "🥇", title: "Mestres da Diplomacia", theme: "tier-diplomacy" },
  { min: 90, max: 179, key: "legend", emoji: "👑", title: "Lendas da Paz Conjugal", theme: "tier-legend" },
  { min: 180, max: Number.POSITIVE_INFINITY, key: "heritage", emoji: "🛡️", title: "Patrimônio Nacional da Resolução de Conflitos", theme: "tier-heritage" }
];

export const MILESTONES = [
  { days: 7, emoji: "🌷", title: "Primeira Semana de Paz", message: "Sete dias completos. O Conselho de Diplomacia Doméstica reconhece o primeiro ciclo oficial de estabilidade." },
  { days: 15, emoji: "💌", title: "Quinzena do Chamego", message: "Quinze dias: já existe evidência suficiente para suspeitar que diálogo e carinho estão funcionando." },
  { days: 30, emoji: "🥂", title: "Um Mês de Estabilidade", message: "Um mês inteiro de estabilidade diplomática. Ata aprovada por unanimidade." },
  { days: 50, emoji: "✨", title: "Operação 50 Dias", message: "Cinquenta dias. A paz doméstica entrou oficialmente na categoria de projeto bem-sucedido." },
  { days: 60, emoji: "💗", title: "Dois Meses de Boa Vizinhança", message: "Sessenta dias de convivência monitorada sem necessidade de comissão extraordinária." },
  { days: 90, emoji: "👑", title: "Trimestre Diplomático", message: "Noventa dias. O nível de maturidade relacional já exige cerimônia e um pouco de exagero." },
  { days: 100, emoji: "🏛️", title: "Caso Estatisticamente Relevante", message: "Cem dias. O Centro Nacional de Monitoramento informa: isto já merece relatório especial." },
  { days: 180, emoji: "🛡️", title: "Patrimônio da Paz", message: "Cento e oitenta dias. Vocês agora ocupam uma faixa de estabilidade que merece placa comemorativa." },
  { days: 365, emoji: "💍", title: "Bodas da Paz", message: "Um ano oficialmente registrado sem incidentes diplomáticos. Celebração autorizada em caráter permanente." }
];

export const ACHIEVEMENTS = [
  { id: "first_week", icon: "🌷", title: "Primeira Semana de Paz", desc: "Chegar a 7 dias sem brigas.", secret: false, test: s => s.currentDays >= 7 || s.recordDays >= 7 },
  { id: "thirty", icon: "📜", title: "Operação 30 Dias", desc: "Alcançar 30 dias de estabilidade.", secret: false, test: s => s.recordDays >= 30 },
  { id: "recess", icon: "🏖️", title: "Conselho em Recesso", desc: "Passar 60 dias sem abrir nova ocorrência.", secret: false, test: s => s.recordDays >= 60 },
  { id: "advanced", icon: "🎖️", title: "Diplomacia Avançada", desc: "Chegar à marca de 90 dias.", secret: false, test: s => s.recordDays >= 90 },
  { id: "hundred", icon: "🏛️", title: "100 Dias sem Audiência", desc: "Completar 100 dias de paz monitorada.", secret: false, test: s => s.recordDays >= 100 },
  { id: "fast", icon: "⚡", title: "Reconciliação Relâmpago", desc: "Resolver um conflito em até 30 minutos.", secret: true, test: s => s.fastestConflictMs != null && s.fastestConflictMs <= 30 * 60_000 },
  { id: "record", icon: "🏆", title: "Novo Recorde Nacional", desc: "Superar uma marca anterior de paz.", secret: false, test: s => s.recordBreakCount >= 1 },
  { id: "veterans", icon: "🫶", title: "Veteranos da Conversa", desc: "Realizar 5 reconciliações confirmadas.", secret: false, test: s => s.reconciliations >= 5 },
  { id: "patience", icon: "🧘", title: "Paciência Nível Máximo", desc: "Alcançar 180 dias de estabilidade.", secret: true, test: s => s.recordDays >= 180 },
  { id: "year", icon: "💍", title: "Bodas da Paz", desc: "Completar 365 dias sem brigas.", secret: false, test: s => s.recordDays >= 365 },
  { id: "perfect", icon: "🕊️", title: "Auditoria sem Ressalvas", desc: "Manter pelo menos 95% do tempo monitorado em paz.", secret: true, test: s => s.monitoredDays >= 30 && s.peacePercent >= 95 },
  { id: "talk", icon: "☕", title: "Café Antes da Crise", desc: "Resolver três conflitos em menos de 6 horas cada.", secret: true, test: s => s.quickReconciliations >= 3 }
];

export function getTier(days) {
  return TIERS.find(tier => days >= tier.min && days <= tier.max) ?? TIERS[0];
}

export function getMilestoneProgress(days) {
  const next = MILESTONES.find(item => days < item.days);
  if (!next) {
    return { next: null, remaining: 0, percent: 100, previousDays: MILESTONES.at(-1).days };
  }
  const previous = [...MILESTONES].reverse().find(item => item.days <= days);
  const start = previous?.days ?? 0;
  const span = next.days - start;
  const progressed = days - start;
  return {
    next,
    remaining: Math.max(0, next.days - days),
    percent: clamp((progressed / span) * 100, 0, 100),
    previousDays: start
  };
}

export function getUnlockedAchievements(stats) {
  return ACHIEVEMENTS.map(item => ({ ...item, unlocked: Boolean(item.test(stats)) }));
}

export function getLoginCelebration(stats) {
  if (stats.activeConflict) return null;
  const exactMilestone = MILESTONES.find(item => item.days === stats.currentDays);
  if (exactMilestone) {
    return { type: "milestone", ...exactMilestone };
  }
  if (stats.currentDays === stats.completedRecordDays + 1 && stats.completedRecordDays > 0) {
    return {
      type: "record",
      days: stats.currentDays,
      emoji: "🏆",
      title: "Novo Recorde!",
      message: `Com ${stats.currentDays} dias, vocês ultrapassaram o recorde anterior de ${stats.completedRecordDays} dias. O feito já consta nos anais da diplomacia doméstica.`
    };
  }
  return null;
}
