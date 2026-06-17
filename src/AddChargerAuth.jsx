// src/AddChargerAuth.jsx
import React, { useState, useEffect } from "react";
import { auth } from "./firebaseConfig";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

export default function AddChargerAuth() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Setting up the invisible security reCAPTCHA link
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-box", {
      size: "invisible",
      callback: () => {
        console.log("reCAPTCHA check verified.");
      }
    });

    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  const sendVerificationCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Forces +91 country code prefix automatically for Indian phone strings if missing
    const formattedNumber = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;

    try {
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
      
      setConfirmationResult(confirmation);
      setStep(2); 
      setMessage("Verification code triggered successfully!");
    } catch (error) {
      console.error(error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await confirmationResult.confirm(otp);
      setMessage(`Success! Logged in as Verified User ID: ${result.user.uid}`);
    } catch (error) {
      console.error(error);
      setMessage("Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "420px", margin: "40px auto", padding: "24px", border: "1px solid #30363d", borderRadius: "12px", backgroundColor: "#161b22", color: "#c9d1d9", fontFamily: "sans-serif" }}>
      <h2 style={{ marginTop: 0, color: "#fff" }}>Register Your Home Charger</h2>
      <p style={{ color: "#8b949e", fontSize: "14px" }}>Verify ownership via mobile authentication before listing your charging point.</p>
      
      {/* Invisible anchor div required by Firebase reCAPTCHA */}
      <div id="recaptcha-box"></div>

      {message && (
        <p style={{ 
          padding: "10px", 
          borderRadius: "6px", 
          backgroundColor: message.startsWith("Error") ? "rgba(248,81,73,0.1)" : "rgba(46,164,79,0.1)", 
          color: message.startsWith("Error") ? "#f85149" : "#56d364", 
          fontSize: "14px",
          border: message.startsWith("Error") ? "1px solid rgba(248,81,73,0.4)" : "1px solid rgba(46,164,79,0.4)"
        }}>
          {message}
        </p>
      )}

      {step === 1 ? (
        <form onSubmit={sendVerificationCode}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#8b949e" }}>Mobile Number</label>
            <input 
              type="tel" 
              placeholder="98765 43210" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #30363d", backgroundColor: "#0d1117", color: "#fff" }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", border: "none", borderRadius: "6px", backgroundColor: "#2188ff", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            {loading ? "Processing..." : "Send Verification OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtpCode}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold", fontSize: "14px", color: "#8b949e" }}>Enter 6-Digit OTP</label>
            <input 
              type="text" 
              maxLength="6"
              placeholder="123456" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", boxSizing: "border-box", borderRadius: "6px", border: "1px solid #30363d", backgroundColor: "#0d1117", color: "#fff", textAlign: "center", letterSpacing: "6px", fontSize: "18px" }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", border: "none", borderRadius: "6px", backgroundColor: "#2ea44f", color: "white", fontWeight: "bold", cursor: "pointer" }}>
            {loading ? "Verifying..." : "Confirm & Authenticate"}
          </button>
          <button type="button" onClick={() => setStep(1)} style={{ width: "100%", background: "none", border: "none", marginTop: "12px", color: "#8b949e", cursor: "pointer", textDecoration: "underline" }}>
            Change Phone Number
          </button>
        </form>
      )}
    </div>
  );
}