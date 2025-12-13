// LoginScreen.jsx
import React, { useState } from "react";
import { socket } from "./socket";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = () => {
    socket.emit("login", { email, password });
  };

  const register = () => {
    socket.emit("register", { email, password });
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "#1D2125",
      color: "white",
      gap: 12
    }}>
      <h2>Moduli Login</h2>

      <input
        style={{ padding: 8, width: 240 }}
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        type="password"
        style={{ padding: 8, width: 240 }}
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <button style={{ padding: 8, width: 240 }} onClick={login}>
        Login
      </button>
      <button style={{ padding: 8, width: 240 }} onClick={register}>
        Register
      </button>
    </div>
  );
}
