import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDRVW6ClygXPr_aCsMf8pgmqRz9Owzdv5w",
  authDomain: "monitoramento-da-paz-conjugal.firebaseapp.com",
  projectId: "monitoramento-da-paz-conjugal",
  storageBucket: "monitoramento-da-paz-conjugal.firebasestorage.app",
  messagingSenderId: "260025894962",
  appId: "1:260025894962:web:6a1d4a602de16a1c7b942b"
};

export const PRIMARY_ADMIN = {
  uid: "Xj5jFnLQ5NfvB1HH9v59OvZHD072",
  alias: "Rodrigo",
  email: "rodbcontato@gmail.com"
};

export const DEFAULT_PARTNER_ALIAS = "Digníssima";

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Não foi possível manter a sessão local do Firebase.", error);
});
