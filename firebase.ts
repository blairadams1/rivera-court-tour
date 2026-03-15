import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAGaE5bMANoRS_rrdBa7PjD2cNxUn1S7AI",
  authDomain: "rivera-court-mural-2451s.firebaseapp.com",
  projectId: "rivera-court-mural-2451s",
  storageBucket: "rivera-court-mural-2451s.firebasestorage.app",
  messagingSenderId: "580792072419",
  appId: "1:580792072419:web:c99c57f8623825cec3edd6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
