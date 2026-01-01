import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { app } from "./initializeFirebase.js";

export const backToMapBtn = function backToMapBtn() {
    const backToMap = document.getElementById('backToMap');
    backToMap.addEventListener("click", function () {
        window.location.href = "index.html";
    })
};

export const signIn = function () {
    const auth = getAuth(app);
    const login = document.getElementById('loginBtn');

    login.addEventListener("click", function (event) {
        event.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                // Signed up 
                alert("Logging In...")
                window.location.href = "admin.html";
            })
            .catch((error) => {
                alert(error.message);
            });
    })
};

export const signUp = function () {
    const auth = getAuth(app);
    const submit = document.getElementById('submit');

    submit.addEventListener("click", function (event) {
        event.preventDefault();

        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

        createUserWithEmailAndPassword(auth, email, password)
            .then(() => {
                // Signed up 
                alert("Creating Account...")
                window.location.href = "admin.html";
            })
            .catch((error) => {
                alert(error.message);
            });
    })
};