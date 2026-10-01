import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./firebase.js";
import { getAuthorizedProfile, isAuthorizedUser, loadPublicAliases, registerAccessLogin } from "./data.js";
import { normalizeAlias } from "./utils.js";
import { clearSessionState, startFreshSession } from "./session.js";

let aliasCache = null;

export async function getAliases(force = false) {
  if (!aliasCache || force) aliasCache = await loadPublicAliases();
  return aliasCache;
}

export async function loginWithAlias(alias, password) {
  const aliases = await getAliases(true);
  const key = normalizeAlias(alias);
  const account = aliases[key];
  if (!account?.email) throw new Error("Usuário não configurado. Confira o nome ou configure o segundo acesso.");

  const credential = await signInWithEmailAndPassword(auth, account.email, password);
  const authorized = await isAuthorizedUser(credential.user);
  if (!authorized) {
    await signOut(auth);
    throw new Error("Esta conta existe no Firebase, mas não está autorizada para este casal.");
  }
  const profile = await getAuthorizedProfile(credential.user);
  startFreshSession(credential.user.uid);
  try {
    await registerAccessLogin({
      user: credential.user,
      displayName: profile?.displayName || account.displayName || alias
    });
  } catch (error) {
    console.warn("Login realizado, mas não foi possível registrar o histórico de acesso.", error);
  }
  return { user: credential.user, profile, aliases };
}

export async function logout() {
  clearSessionState();
  await signOut(auth);
}

export function observeSession(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function validateCurrentUser(user) {
  if (!user) return null;
  const authorized = await isAuthorizedUser(user);
  if (!authorized) {
    await signOut(auth);
    return null;
  }
  return getAuthorizedProfile(user);
}
