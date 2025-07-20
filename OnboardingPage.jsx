import React, { useEffect } from "react";
import "./OnboardingPage.css";
import bgImage from "./onboarding-bg.png";
import bg from "./Group.png";

const OnboardingPage = () => {
  useEffect(() => {
    const appleLoginBtn = document.querySelector(".apple-login");
    if (!appleLoginBtn) return;

    // Utility function: base64url string to Uint8Array
    const base64UrlToUint8Array = (base64url) => {
      const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
      const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    // Utility function: ArrayBuffer to base64url string
    const arrayBufferToBase64 = (buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      return window
        .btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    };

    const handleFingerprintLogin = async () => {
      if (!window.PublicKeyCredential) {
        alert("Your browser does not support WebAuthn.");
        return;
      }

      try {
        // 1. Request authentication options (challenge) from backend
        const authChallengeRes = await fetch("http://localhost:5001/api/auth/challenge", {
          credentials: "include",
        });

        if (!authChallengeRes.ok) {
          throw new Error("Failed to get authentication challenge.");
        }

        const authOptions = await authChallengeRes.json();

        // Convert challenge and allowCredentials id to Uint8Array
        authOptions.challenge = base64UrlToUint8Array(authOptions.challenge);
        if (authOptions.allowCredentials) {
          authOptions.allowCredentials = authOptions.allowCredentials.map((cred) => ({
            ...cred,
            id: base64UrlToUint8Array(cred.id),
          }));
        }

        // 2. Use WebAuthn API to get assertion from authenticator
        const assertion = await navigator.credentials.get({ publicKey: authOptions });

        // 3. Send the assertion to backend for verification
        const verifyRes = await fetch("http://localhost:5001/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: assertion.id,
            rawId: arrayBufferToBase64(assertion.rawId),
            response: {
              authenticatorData: arrayBufferToBase64(assertion.response.authenticatorData),
              clientDataJSON: arrayBufferToBase64(assertion.response.clientDataJSON),
              signature: arrayBufferToBase64(assertion.response.signature),
              userHandle: assertion.response.userHandle
                ? arrayBufferToBase64(assertion.response.userHandle)
                : null,
            },
            type: assertion.type,
          }),
        });

        if (!verifyRes.ok) {
          throw new Error("Authentication verification failed.");
        }

        const verifyResult = await verifyRes.json();

        if (!verifyResult.success) {
          throw new Error(verifyResult.message || "Authentication failed.");
        }

        alert("Login successful ✅");
      } catch (authErr) {
        console.warn("Authentication failed, trying registration...", authErr);
        await handleRegistration();
      }
    };

    const handleRegistration = async () => {
      try {
        // 1. Request registration options from backend
        const regOptionsRes = await fetch("http://localhost:5001/api/auth/register-options", {
          credentials: "include",
        });

        if (!regOptionsRes.ok) {
          throw new Error("Failed to get registration options.");
        }

        const regOptions = await regOptionsRes.json();

        // Convert challenge and user ID to Uint8Array
        regOptions.challenge = base64UrlToUint8Array(regOptions.challenge);
        regOptions.user.id = base64UrlToUint8Array(regOptions.user.id);

        // 2. Create new credentials with WebAuthn API
        const credential = await navigator.credentials.create({ publicKey: regOptions });

        // 3. Send the credential to backend for registration
        const registerRes = await fetch("http://localhost:5001/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: credential.id,
            rawId: arrayBufferToBase64(credential.rawId),
            response: {
              attestationObject: arrayBufferToBase64(credential.response.attestationObject),
              clientDataJSON: arrayBufferToBase64(credential.response.clientDataJSON),
            },
            type: credential.type,
          }),
        });

        if (!registerRes.ok) {
          throw new Error("Registration failed.");
        }

        const registerResult = await registerRes.json();

        if (registerResult.success) {
          alert("Touch ID registration successful ✅");
        } else {
          throw new Error(registerResult.message || "Registration verification failed.");
        }
      } catch (regErr) {
        console.error("Registration error:", regErr);
        alert(`Touch ID registration failed ❌\nError: ${regErr.message || "Unknown error"}`);
      }
    };

    appleLoginBtn.addEventListener("click", handleFingerprintLogin);
    return () => appleLoginBtn.removeEventListener("click", handleFingerprintLogin);
  }, []);

  return (
    <div className="onboarding-container">
      <div className="left-panel">
        <img src={bgImage} alt="Trading UI Design" className="bg-image" />
      </div>

      <div className="right-panel" style={{ backgroundImage: `url(${bg})` }}>
        <h1>Hello! Let's Swing In</h1>
        <p>Unlock smarter tools for better trading decisions.</p>

        <button className="social-btn google">
          <svg
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: "8px", width: "20px", height: "20px" }}
          >
            <title>Google</title>
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
          </svg>
          Sign up with Google
        </button>

        <button className="social-btn apple">
          <svg
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: "8px", width: "20px", height: "20px" }}
          >
            <title>Apple</title>
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
          </svg>
          Sign up with Apple ID
        </button>

        <button className="social-btn twitter">
          <svg
            role="img"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ marginRight: "8px", width: "20px", height: "20px" }}
          >
            <title>X</title>
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
          </svg>
          Sign up with X
        </button>

        <div className="divider">OR</div>
        <button className="signup-btn">Sign up with phone or email</button>

        <p className="terms">
          By signing up, you agree to the <a href="#">Terms of Service</a> and{" "}
          <a href="#">Privacy Policy</a>, including <a href="#">cookie use</a>.
        </p>

        <p>Already have an account?</p>
        <button className="login-button">Log in</button>
        <button className="social-btn apple-login">Log in with Apple ID</button>
      </div>
    </div>
  );
};

export default OnboardingPage;
