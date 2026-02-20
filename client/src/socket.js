// client/src/socket.js
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket"],
  auth: {
    token: localStorage.getItem("moduli-token") || null, // ✅ FIX KEY
  },
});

export function emit(event, payload) {
  socket.emit(event, payload);
}

export function reconnectWithAuth() {
  socket.auth = { token: localStorage.getItem("moduli-token") || null }; // ✅ FIX KEY
  if (socket.connected) socket.disconnect();
  socket.connect();
}