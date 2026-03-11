// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCVL7tpUkyQWz_aVr9wFi2hrCBum2pLnPs",
  authDomain: "inmo-nicaragua.firebaseapp.com",
  projectId: "inmo-nicaragua",
  storageBucket: "inmo-nicaragua.firebasestorage.app",
  messagingSenderId: "735319266898",
  appId: "1:735319266898:web:124c3b886d0eb32a25b18b",
  measurementId: "G-DXTBSYNR95"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
