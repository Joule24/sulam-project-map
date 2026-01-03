// Import the functions you need from the SDKs you need
import { firebaseInitializer } from "./helper/initializeFirebase.js";
import { backToMapBtn, signUp } from "./helper/sign_in_up.js";

firebaseInitializer();
backToMapBtn();
signUp();