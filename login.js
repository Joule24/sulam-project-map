// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA093rrUBlUG4tDnGUdyql0-c7m-E2DDHw",
  authDomain: "sulam-project-map.firebaseapp.com",
  projectId: "sulam-project-map",
  storageBucket: "sulam-project-map.firebasestorage.app",
  messagingSenderId: "402597128748",
  appId: "1:402597128748:web:f73f4b44e44fcb55bfff89",
  measurementId: "G-SDHPJ5G431"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

//return to map button
const backToMap = document.getElementById('backToMap');
backToMap.addEventListener("click", function () {
  window.location.href = "index.html";
});

//submit
const login = document.getElementById('loginBtn');
login.addEventListener("click", function (event) {
  event.preventDefault()

  //inputs
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed up 
      const user = userCredential.user;
      alert("Logging In...")
      window.location.href = "admin.html";
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert(errorMessage)
    });
})