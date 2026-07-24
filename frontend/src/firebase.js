import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "link-checker-1784544272",
  appId: "1:833231168125:web:e0979db7312f214ba60714",
  storageBucket: "link-checker-1784544272.firebasestorage.app",
  apiKey: "AIzaSyDfMQDz_YM5zT6goo-8sZlKvx4y1hBYZTg",
  authDomain: "link-checker-1784544272.firebaseapp.com",
  messagingSenderId: "833231168125"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
