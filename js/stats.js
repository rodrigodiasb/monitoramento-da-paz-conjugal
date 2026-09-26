import { DAY_MS, diffMs, fullDaysBetween, toDate } from "./utils.js";

function sortByStartedAt(conflicts) {
  return [...conflicts].sort((a, b) => (toDate(a.startedAt)?.getTime() ?? 0) - (toDate(b.startedAt)?.getTime() ?? 0));
}

export function calculateStats({ conflicts = [], system = {}, settings = {}, globalStats = {}, now = new Date() }) {
  const ordered = sortByStartedAt(conflicts);
  const earliestConflict = ordered[0]?.startedAt ? toDate(ordered[0].startedAt) : null;
  const monitorStart = toDate(settings.monitorStartAt) ?? earliestConflict ?? toDate(system.currentPeaceStartAt) ?? now;

  const peaceIntervals = [];
  const resolvedConflicts = [];
  let peaceCursor = monitorStart;
  let activeConflict = null;
  let totalConflictMs = 0;

  for (const conflict of ordered) {
    const startedAt = toDate(conflict.startedAt);
    if (!startedAt) continue;

    if (peaceCursor && startedAt >= peaceCursor) {
      peaceIntervals.push({
        start: peaceCursor,
        end: startedAt,
        ms: Math.max(0, startedAt.getTime() - peaceCursor.getTime()),
        days: fullDaysBetween(peaceCursor, startedAt),
        endedByConflictId: conflict.id,
        completed: true
      });
    }

    if (conflict.status === "resolved" && conflict.resolvedAt) {
      const resolvedAt = toDate(conflict.resolvedAt);
      if (resolvedAt) {
        const durationMs = Math.max(0, resolvedAt.getTime() - startedAt.getTime());
        totalConflictMs += durationMs;
        resolvedConflicts.push({ ...conflict, durationMs });
        peaceCursor = resolvedAt;
      }
    } else {
      activeConflict = conflict;
      totalConflictMs += Math.max(0, now.getTime() - startedAt.getTime());
      peaceCursor = null;
      break;
    }
  }

  let currentPeaceStart = null;
  let currentDays = 0;
  if (activeConflict) {
    const prior = peaceIntervals.at(-1);
    currentDays = prior?.days ?? 0;
  } else {
    currentPeaceStart = toDate(system.currentPeaceStartAt) ?? peaceCursor ?? monitorStart;
    if (currentPeaceStart) {
      const currentInterval = {
        start: currentPeaceStart,
        end: now,
        ms: Math.max(0, now.getTime() - currentPeaceStart.getTime()),
        days: fullDaysBetween(currentPeaceStart, now),
        endedByConflictId: null,
        completed: false
      };
      const last = peaceIntervals.at(-1);
      if (!last || last.start.getTime() !== currentPeaceStart.getTime() || last.completed) {
        peaceIntervals.push(currentInterval);
      }
      currentDays = currentInterval.days;
    }
  }

  const completedPeaceIntervals = peaceIntervals.filter(item => item.completed);
  const completedRecordDays = completedPeaceIntervals.reduce((max, item) => Math.max(max, item.days), 0);
  const recordDays = peaceIntervals.reduce((max, item) => Math.max(max, item.days), 0);
  const topPeace = [...peaceIntervals].sort((a, b) => b.days - a.days || b.ms - a.ms).slice(0, 3);

  let recordBreakCount = 0;
  let runningRecord = -1;
  for (const interval of completedPeaceIntervals) {
    if (interval.days > runningRecord) {
      if (runningRecord >= 0) recordBreakCount += 1;
      runningRecord = interval.days;
    }
  }
  if (!activeConflict && currentDays > runningRecord && runningRecord >= 0) recordBreakCount += 1;

  const averagePeaceMs = completedPeaceIntervals.length
    ? completedPeaceIntervals.reduce((sum, item) => sum + item.ms, 0) / completedPeaceIntervals.length
    : null;
  const averageConflictMs = resolvedConflicts.length
    ? resolvedConflicts.reduce((sum, item) => sum + item.durationMs, 0) / resolvedConflicts.length
    : null;
  const longestConflict = resolvedConflicts.length
    ? resolvedConflicts.reduce((best, item) => !best || item.durationMs > best.durationMs ? item : best, null)
    : null;
  const fastestConflict = resolvedConflicts.length
    ? resolvedConflicts.reduce((best, item) => !best || item.durationMs < best.durationMs ? item : best, null)
    : null;

  const monitoredMs = Math.max(0, now.getTime() - monitorStart.getTime());
  const monitoredDays = Math.floor(monitoredMs / DAY_MS);
  const peaceMs = Math.max(0, monitoredMs - totalConflictMs);
  const peacePercent = monitoredMs > 0 ? Math.min(100, (peaceMs / monitoredMs) * 100) : 100;
  const quickReconciliations = resolvedConflicts.filter(item => item.durationMs <= 6 * 60 * 60_000).length;

  let recordGapText = "Primeiro recorde em formação";
  let daysToBeatRecord = null;
  if (!activeConflict && completedRecordDays > 0) {
    daysToBeatRecord = Math.max(0, completedRecordDays - currentDays + 1);
    recordGapText = daysToBeatRecord === 0
      ? "Novo recorde em andamento"
      : `${daysToBeatRecord} ${daysToBeatRecord === 1 ? "dia" : "dias"}`;
  }

  const lastUpdateCandidates = [
    toDate(system.updatedAt),
    ...ordered.map(item => toDate(item.updatedAt)).filter(Boolean)
  ].filter(Boolean);
  const lastUpdate = lastUpdateCandidates.length
    ? new Date(Math.max(...lastUpdateCandidates.map(date => date.getTime())))
    : now;

  return {
    monitorStart,
    currentPeaceStart,
    currentDays,
    recordDays,
    completedRecordDays,
    daysToBeatRecord,
    recordGapText,
    conflictsCount: ordered.length,
    reconciliations: resolvedConflicts.length,
    monitoredDays,
    monitoredMs,
    peacePercent,
    averagePeaceMs,
    averageConflictMs,
    longestConflict,
    fastestConflict,
    fastestConflictMs: fastestConflict?.durationMs ?? null,
    quickReconciliations,
    topPeace,
    peaceIntervals,
    recordBreakCount,
    activeConflict,
    totalVisits: Number(globalStats.totalVisits ?? 0),
    lastUpdate,
    lastConflict: ordered.length ? ordered.at(-1) : null,
    lastReconciliation: resolvedConflicts.length ? resolvedConflicts.at(-1) : null,
    resolvedConflicts
  };
}
