// Import the functions you need from the SDKs you need
import { firebaseInitializer } from "./helper/initializeFirebase.js";
import { backToMapBtn, signIn } from "./helper/sign_in_up.js";

firebaseInitializer();
backToMapBtn();
signIn();