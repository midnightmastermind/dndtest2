// socket.js
import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:5000";

export const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ["websocket"],
  auth: {
    token: localStorage.getItem("daytrack-token") || null,
  },
});

// optional helper (matches your old style)
export function emit(event, payload) {
  socket.emit(event, payload);
}

// ✅ helper for after login/register if you *don’t* reload
export function reconnectWithAuth() {
  socket.auth = { token: localStorage.getItem("daytrack-token") || null };
  if (socket.connected) socket.disconnect();
  socket.connect();
}
