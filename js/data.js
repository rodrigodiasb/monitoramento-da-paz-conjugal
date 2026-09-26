import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db, PRIMARY_ADMIN } from "./firebase.js";
import { fullDaysBetween, normalizeAlias, toDate } from "./utils.js";

const refs = {
  publicAliases: doc(db, "public", "authAliases"),
  couple: doc(db, "settings", "couple"),
  system: doc(db, "system", "status"),
  globalStats: doc(db, "stats", "global")
};

export async function loadPublicAliases() {
  const fallback = {
    [normalizeAlias(PRIMARY_ADMIN.alias)]: {
      displayName: PRIMARY_ADMIN.alias,
      email: PRIMARY_ADMIN.email
    }
  };
  try {
    const snapshot = await getDoc(refs.publicAliases);
    return snapshot.exists() ? { ...fallback, ...(snapshot.data().aliases ?? {}) } : fallback;
  } catch (error) {
    console.warn("Não foi possível carregar aliases públicos; usando configuração local.", error);
    return fallback;
  }
}

export async function isAuthorizedUser(user) {
  if (!user) return false;
  if (user.uid === PRIMARY_ADMIN.uid) return true;
  const snapshot = await getDoc(doc(db, "authorizedUsers", user.uid));
  return snapshot.exists() && snapshot.data().active !== false;
}

export async function getAuthorizedProfile(user) {
  if (!user) return null;
  if (user.uid === PRIMARY_ADMIN.uid) {
    return { uid: user.uid, displayName: PRIMARY_ADMIN.alias, email: user.email, role: "admin", active: true };
  }
  const snapshot = await getDoc(doc(db, "authorizedUsers", user.uid));
  return snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null;
}

export async function ensureBootstrap(user) {
  if (!user || user.uid !== PRIMARY_ADMIN.uid) return;

  const adminRef = doc(db, "authorizedUsers", PRIMARY_ADMIN.uid);
  const [adminSnap, aliasSnap, coupleSnap, systemSnap, statsSnap] = await Promise.all([
    getDoc(adminRef),
    getDoc(refs.publicAliases),
    getDoc(refs.couple),
    getDoc(refs.system),
    getDoc(refs.globalStats)
  ]);

  const writes = [];
  if (!adminSnap.exists()) {
    writes.push(setDoc(adminRef, {
      displayName: PRIMARY_ADMIN.alias,
      email: PRIMARY_ADMIN.email,
      role: "admin",
      active: true,
      createdAt: serverTimestamp()
    }));
  }
  if (!aliasSnap.exists()) {
    writes.push(setDoc(refs.publicAliases, {
      aliases: {
        [normalizeAlias(PRIMARY_ADMIN.alias)]: {
          displayName: PRIMARY_ADMIN.alias,
          email: PRIMARY_ADMIN.email
        }
      },
      updatedAt: serverTimestamp()
    }));
  }
  if (!coupleSnap.exists()) {
    writes.push(setDoc(refs.couple, {
      coupleLabel: "Rodrigo & Digníssima",
      monitorStartAt: serverTimestamp(),
      partnerName: "Digníssima",
      partnerEmail: "",
      partnerUid: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  }
  if (!systemSnap.exists()) {
    writes.push(setDoc(refs.system, {
      activeConflictId: null,
      currentPeaceStartAt: serverTimestamp(),
      lastConflictAt: null,
      lastResolvedAt: null,
      updatedAt: serverTimestamp()
    }));
  }
  if (!statsSnap.exists()) {
    writes.push(setDoc(refs.globalStats, {
      totalVisits: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  }
  await Promise.all(writes);
}

export function subscribeDashboard(onData, onError) {
  const state = { settings: null, system: null, globalStats: null, conflicts: null };
  const loaded = { settings: false, system: false, globalStats: false, conflicts: false };

  const emit = () => {
    if (Object.values(loaded).every(Boolean)) onData({ ...state });
  };

  const unsubscribers = [
    onSnapshot(refs.couple, snap => {
      state.settings = snap.exists() ? snap.data() : {};
      loaded.settings = true;
      emit();
    }, onError),
    onSnapshot(refs.system, snap => {
      state.system = snap.exists() ? snap.data() : {};
      loaded.system = true;
      emit();
    }, onError),
    onSnapshot(refs.globalStats, snap => {
      state.globalStats = snap.exists() ? snap.data() : {};
      loaded.globalStats = true;
      emit();
    }, onError),
    onSnapshot(query(collection(db, "conflicts"), orderBy("startedAt", "asc")), snap => {
      state.conflicts = snap.docs.map(item => ({ id: item.id, ...item.data() }));
      loaded.conflicts = true;
      emit();
    }, onError)
  ];

  return () => unsubscribers.forEach(unsubscribe => unsubscribe());
}

export async function registerVisit(user) {
  if (!user) return false;
  const key = `dsb:lastVisit:${user.uid}`;
  const last = Number(localStorage.getItem(key) ?? 0);
  const now = Date.now();
  const thirtyMinutes = 30 * 60_000;
  if (now - last < thirtyMinutes) return false;

  await setDoc(refs.globalStats, {
    totalVisits: increment(1),
    updatedAt: serverTimestamp()
  }, { merge: true });
  localStorage.setItem(key, String(now));
  return true;
}

export async function registerConflict({ reason, startedAt, user, displayName }) {
  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) throw new Error("Informe o motivo da ocorrência.");
  if (!(startedAt instanceof Date) || Number.isNaN(startedAt.getTime())) throw new Error("Data ou hora inválida.");
  if (startedAt.getTime() > Date.now() + 5 * 60_000) throw new Error("A ocorrência não pode começar no futuro.");

  const conflictRef = doc(collection(db, "conflicts"));
  const eventRef = doc(collection(conflictRef, "events"));

  await runTransaction(db, async transaction => {
    const [systemSnap, settingsSnap] = await Promise.all([
      transaction.get(refs.system),
      transaction.get(refs.couple)
    ]);
    const system = systemSnap.exists() ? systemSnap.data() : {};
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    if (system.activeConflictId) throw new Error("Já existe uma ocorrência em andamento.");

    const peaceStart = toDate(system.currentPeaceStartAt) ?? toDate(settings.monitorStartAt) ?? new Date();
    if (startedAt.getTime() < peaceStart.getTime()) {
      throw new Error("A ocorrência não pode ser anterior ao início da sequência atual de paz.");
    }
    const daysBeforeConflict = fullDaysBetween(peaceStart, startedAt);

    transaction.set(conflictRef, {
      status: "active",
      reason: trimmedReason,
      startedAt: Timestamp.fromDate(startedAt),
      createdByUid: user.uid,
      createdByName: displayName,
      daysBeforeConflict,
      resolutionProposal: null,
      resolvedAt: null,
      confirmedByUid: null,
      confirmedByName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      type: "created",
      label: "Ocorrência registrada",
      actorUid: user.uid,
      actorName: displayName,
      details: trimmedReason,
      createdAt: serverTimestamp()
    });
    transaction.set(refs.system, {
      activeConflictId: conflictRef.id,
      lastConflictAt: Timestamp.fromDate(startedAt),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  return conflictRef.id;
}

export async function editActiveConflictReason({ conflictId, reason, user, displayName }) {
  const trimmedReason = String(reason ?? "").trim();
  if (!trimmedReason) throw new Error("O motivo não pode ficar vazio.");
  const conflictRef = doc(db, "conflicts", conflictId);
  const eventRef = doc(collection(conflictRef, "events"));

  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(conflictRef);
    if (!snapshot.exists()) throw new Error("Ocorrência não encontrada.");
    const conflict = snapshot.data();
    if (conflict.status !== "active") throw new Error("Somente a ocorrência ativa pode ser editada.");
    if (conflict.resolutionProposal) throw new Error("Cancele ou responda à proposta de reconciliação antes de editar.");

    transaction.update(conflictRef, { reason: trimmedReason, updatedAt: serverTimestamp() });
    transaction.set(eventRef, {
      type: "edited",
      label: "Ocorrência editada",
      actorUid: user.uid,
      actorName: displayName,
      previousValue: conflict.reason ?? "",
      details: trimmedReason,
      createdAt: serverTimestamp()
    });
  });
}

export async function proposeResolution({ conflictId, user, displayName }) {
  const conflictRef = doc(db, "conflicts", conflictId);
  const eventRef = doc(collection(conflictRef, "events"));
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(conflictRef);
    if (!snapshot.exists()) throw new Error("Ocorrência não encontrada.");
    const conflict = snapshot.data();
    if (conflict.status !== "active") throw new Error("Esta ocorrência já foi encerrada.");
    if (conflict.resolutionProposal) throw new Error("Já existe uma proposta de reconciliação aguardando resposta.");

    transaction.update(conflictRef, {
      resolutionProposal: {
        proposedByUid: user.uid,
        proposedByName: displayName,
        proposedAt: Timestamp.now()
      },
      updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      type: "resolution_proposed",
      label: "Reconciliação proposta",
      actorUid: user.uid,
      actorName: displayName,
      createdAt: serverTimestamp()
    });
  });
}

export async function cancelResolutionProposal({ conflictId, user, displayName }) {
  const conflictRef = doc(db, "conflicts", conflictId);
  const eventRef = doc(collection(conflictRef, "events"));
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(conflictRef);
    if (!snapshot.exists()) throw new Error("Ocorrência não encontrada.");
    const conflict = snapshot.data();
    if (conflict.status !== "active" || !conflict.resolutionProposal) throw new Error("Não há proposta ativa para cancelar.");
    if (conflict.resolutionProposal.proposedByUid !== user.uid) throw new Error("Somente quem propôs pode cancelar o pedido.");

    transaction.update(conflictRef, { resolutionProposal: null, updatedAt: serverTimestamp() });
    transaction.set(eventRef, {
      type: "resolution_cancelled",
      label: "Proposta de reconciliação cancelada",
      actorUid: user.uid,
      actorName: displayName,
      createdAt: serverTimestamp()
    });
  });
}

export async function rejectResolution({ conflictId, user, displayName }) {
  const conflictRef = doc(db, "conflicts", conflictId);
  const eventRef = doc(collection(conflictRef, "events"));
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(conflictRef);
    if (!snapshot.exists()) throw new Error("Ocorrência não encontrada.");
    const conflict = snapshot.data();
    const proposal = conflict.resolutionProposal;
    if (conflict.status !== "active" || !proposal) throw new Error("Não há proposta aguardando resposta.");
    if (proposal.proposedByUid === user.uid) throw new Error("A confirmação precisa vir do outro usuário.");

    transaction.update(conflictRef, { resolutionProposal: null, updatedAt: serverTimestamp() });
    transaction.set(eventRef, {
      type: "resolution_rejected",
      label: "Reconciliação ainda não aceita",
      actorUid: user.uid,
      actorName: displayName,
      createdAt: serverTimestamp()
    });
  });
}

export async function confirmResolution({ conflictId, user, displayName }) {
  const conflictRef = doc(db, "conflicts", conflictId);
  const eventRef = doc(collection(conflictRef, "events"));
  const resolvedAt = Timestamp.now();

  await runTransaction(db, async transaction => {
    const [conflictSnap, systemSnap] = await Promise.all([
      transaction.get(conflictRef),
      transaction.get(refs.system)
    ]);
    if (!conflictSnap.exists()) throw new Error("Ocorrência não encontrada.");
    const conflict = conflictSnap.data();
    const proposal = conflict.resolutionProposal;
    if (conflict.status !== "active" || !proposal) throw new Error("Não há proposta aguardando confirmação.");
    if (proposal.proposedByUid === user.uid) throw new Error("A confirmação precisa vir do outro usuário.");
    if (systemSnap.exists() && systemSnap.data().activeConflictId !== conflictId) {
      throw new Error("O estado atual do monitoramento não corresponde a esta ocorrência.");
    }

    transaction.update(conflictRef, {
      status: "resolved",
      resolvedAt,
      confirmedByUid: user.uid,
      confirmedByName: displayName,
      resolutionProposal: {
        ...proposal,
        confirmedByUid: user.uid,
        confirmedByName: displayName,
        confirmedAt: resolvedAt
      },
      updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      type: "resolved",
      label: "Paz restabelecida por concordância bilateral",
      actorUid: user.uid,
      actorName: displayName,
      proposedByUid: proposal.proposedByUid,
      proposedByName: proposal.proposedByName,
      createdAt: serverTimestamp()
    });
    transaction.set(refs.system, {
      activeConflictId: null,
      currentPeaceStartAt: resolvedAt,
      lastResolvedAt: resolvedAt,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
}

export async function fetchConflictEvents(conflictId) {
  const snapshot = await getDocs(query(collection(db, "conflicts", conflictId, "events"), orderBy("createdAt", "asc")));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function updateCoupleSettings({ coupleLabel, monitorStartAt, user }) {
  if (user.uid !== PRIMARY_ADMIN.uid) throw new Error("Somente o administrador inicial pode alterar estas configurações.");
  const payload = { updatedAt: serverTimestamp() };
  if (String(coupleLabel ?? "").trim()) payload.coupleLabel = String(coupleLabel).trim();

  let normalizedStart = null;
  if (monitorStartAt instanceof Date && !Number.isNaN(monitorStartAt.getTime())) {
    if (monitorStartAt.getTime() > Date.now()) throw new Error("O início do monitoramento não pode estar no futuro.");
    const firstConflictSnap = await getDocs(query(collection(db, "conflicts"), orderBy("startedAt", "asc"), limit(1)));
    if (!firstConflictSnap.empty) {
      const firstStartedAt = toDate(firstConflictSnap.docs[0].data().startedAt);
      if (firstStartedAt && monitorStartAt.getTime() > firstStartedAt.getTime()) {
        throw new Error("O início do monitoramento não pode ser posterior à primeira ocorrência registrada.");
      }
    }
    normalizedStart = Timestamp.fromDate(monitorStartAt);
    payload.monitorStartAt = normalizedStart;
  }

  await setDoc(refs.couple, payload, { merge: true });

  if (normalizedStart) {
    const systemSnap = await getDoc(refs.system);
    const system = systemSnap.exists() ? systemSnap.data() : {};
    if (!system.lastConflictAt && !system.activeConflictId) {
      await setDoc(refs.system, { currentPeaceStartAt: normalizedStart, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
}

export async function configurePartner({ alias, email, uid, user }) {
  if (user.uid !== PRIMARY_ADMIN.uid) throw new Error("Somente Rodrigo pode configurar o segundo acesso.");
  const cleanAlias = String(alias ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();
  const cleanUid = String(uid ?? "").trim();
  if (!cleanAlias || !cleanEmail || !cleanUid) throw new Error("Preencha nome, e-mail e UID do segundo usuário.");
  if (cleanUid === PRIMARY_ADMIN.uid) throw new Error("O UID do segundo usuário precisa ser diferente do administrador.");
  if (normalizeAlias(cleanAlias) === normalizeAlias(PRIMARY_ADMIN.alias)) throw new Error("Escolha um nome de login diferente de Rodrigo.");

  const currentSettings = await getDoc(refs.couple);
  const previousUid = currentSettings.exists() ? String(currentSettings.data().partnerUid ?? "") : "";
  const batch = writeBatch(db);
  if (previousUid && previousUid !== cleanUid) batch.delete(doc(db, "authorizedUsers", previousUid));

  batch.set(doc(db, "authorizedUsers", cleanUid), {
    displayName: cleanAlias,
    email: cleanEmail,
    role: "partner",
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(refs.publicAliases, {
    aliases: {
      [normalizeAlias(PRIMARY_ADMIN.alias)]: { displayName: PRIMARY_ADMIN.alias, email: PRIMARY_ADMIN.email },
      [normalizeAlias(cleanAlias)]: { displayName: cleanAlias, email: cleanEmail }
    },
    updatedAt: serverTimestamp()
  });
  batch.set(refs.couple, {
    partnerName: cleanAlias,
    partnerEmail: cleanEmail,
    partnerUid: cleanUid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  await batch.commit();
}

export async function removePartnerAccess({ partnerUid, user }) {
  if (user.uid !== PRIMARY_ADMIN.uid) throw new Error("Apenas o administrador pode remover acessos.");
  if (!partnerUid) return;
  await deleteDoc(doc(db, "authorizedUsers", partnerUid));
}
