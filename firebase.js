// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPYAht5ZNk3in_Z6oUFFWSH1kMyEui1rI",
  authDomain: "dinnerschedulekm.firebaseapp.com",
  projectId: "dinnerschedulekm",
  storageBucket: "dinnerschedulekm.firebasestorage.app",
  messagingSenderId: "1046023961196",
  appId: "1:1046023961196:web:b730c6244ba2c74a403649",
  measurementId: "G-EC3MHTZFJV"
};

// すでに初期化されているか確認
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 必要な機能を export
export const auth = getAuth(app);
export const db = getFirestore(app);