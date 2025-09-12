import "./styles.css";

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import createGlobe from "cobe";
import usePartySocket from "partysocket/react";

// The type of messages we'll be receiving from the server
import type { OutgoingMessage } from "../shared";
import type { LegacyRef } from "react";

const randomNames = [
  "Rylie", "Peyton", "Jordan", "Taylor", "Alex", "Cameron", "Morgan", "Casey", "Riley", "Reese",
  "Rowan", "Quinn", "Kai", "Avery", "Sawyer", "Parker", "Dakota", "Skyler", "Frankie", "River"
];

// A simple utility to get the room from the URL
function getRoom() {
  return new URLSearchParams(window.location.search).get("room") || "default";
}

// A simple utility to generate a random room name
function generateRoomName() {
  return Math.random().toString(36).substring(2, 8);
}

function App() {
  const [room, setRoom] = useState(getRoom());
  const [activeRooms, setActiveRooms] = useState<{ id: string; userCount: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>();
  const [counter, setCounter] = useState(0);
  const [users, setUsers] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<{ id: string; name: string; text: string; timestamp: string }[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const positions = useRef<
    Map<
      string,
      {
        location: [number, number];
        size: number;
      }
    >
  >(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active rooms
  useEffect(() => {
    fetch("/rooms")
      .then((res) => res.json())
      .then((data: { rooms: { id: string; userCount: number }[] }) => setActiveRooms(data.rooms))
      .catch((err) => console.error("Failed to fetch rooms:", err));
  }, []);

  // Scroll to the bottom of the message list when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to the PartyServer server
  const socket = usePartySocket({
    room: room,
    party: "globe",
    onMessage(evt) {
      const message = JSON.parse(evt.data as string) as OutgoingMessage;
      if (message.type === "add-marker") {
        positions.current.set(message.position.id, {
          location: [message.position.lat, message.position.lng],
          size: message.position.id === socket.id ? 0.1 : 0.05,
        });
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          const randomName = randomNames[Math.floor(Math.random() * randomNames.length)];
          newUsers.set(message.position.id, randomName);
          return newUsers;
        });
        setCounter((c) => c + 1);
      } else if (message.type === "remove-marker") {
        positions.current.delete(message.id);
        setUsers((prevUsers) => {
          const newUsers = new Map(prevUsers);
          newUsers.delete(message.id);
          return newUsers;
        });
        setCounter((c) => c - 1);
      } else if (message.type === "room-update") {
        setActiveRooms((prev) => {
          let newRooms = [...prev];
          const index = newRooms.findIndex((r) => r.id === message.roomId);
          if (message.userCount > 0) {
            if (index !== -1) {
              newRooms[index] = { ...newRooms[index], userCount: message.userCount };
            } else {
              newRooms.push({ id: message.roomId, userCount: message.userCount });
            }
          } else {
            if (index !== -1) {
              newRooms.splice(index, 1);
            }
          }
          return newRooms;
        });
        if (message.roomId === room) {
          setCounter(message.userCount);
        }
      } else if (message.type === "chat-message") {
        setMessages((prev) => [
          ...prev,
          {
            id: message.id,
            name: users.get(message.id) || "Unknown",
            text: message.text,
            timestamp: message.timestamp,
          },
        ]);
      }
    },
  });

  useEffect(() => {
    let phi = 0;
    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 400 * 2,
      height: 400 * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 0.8,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.8, 0.1, 0.1],
      glowColor: [0.2, 0.2, 0.2],
      markers: [],
      opacity: 0.7,
      onRender: (state) => {
        state.markers = [...positions.current.values()];
        state.phi = phi;
        phi += 0.01;
      },
    });

    return () => {
      globe.destroy();
    };
  }, []);

  const handleJoinRoom = () => {
    const roomCode = window.prompt("Enter 6-digit room code:");
    if (roomCode && /^[a-z0-9]{6}$/.test(roomCode)) {
      window.history.pushState({}, "", `?room=${roomCode}`);
      setRoom(roomCode);
    } else if (roomCode) {
      window.alert("Invalid room code! Please enter a 6-digit alphanumeric code.");
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && messageInput.length <= 200 && room !== "default") {
      const msg = {
        type: "chat-message",
        id: socket.id,
        text: messageInput.trim(),
        timestamp: new Date().toISOString(),
      };
      socket.send(JSON.stringify(msg));
      // Add the message to local state immediately
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id,
          name: users.get(msg.id) || "Unknown",
          text: msg.text,
          timestamp: msg.timestamp,
        },
      ]);
      setMessageInput("");
    } else if (messageInput.length > 200) {
      window.alert("Message too long! Maximum 200 characters.");
    }
  };

  return (
    <div className="App">
      <h1>WYA?</h1>
      <div className="room-controls">
        {room === "default" ? (
          <div className="room-actions">
            <div className="room-create">
              <button
                role="button"
                onClick={() => {
                  const newRoom = generateRoomName();
                  window.history.pushState({}, "", `?room=${newRoom}`);
                  setRoom(newRoom);
                }}
              >
                Create Room
              </button>
            </div>
            <div className="join-room">
              <button role="button" onClick={handleJoinRoom}>
                Join Room
              </button>
            </div>
            {activeRooms.length > 0 && (
              <div className="active-rooms">
                <h3>Active Rooms</h3>
                <ul>
                  {activeRooms.map((r) => (
                    <li key={r.id}>
                      <button
                        role="button"
                        onClick={() => {
                          window.history.pushState({}, "", `?room=${r.id}`);
                          setRoom(r.id);
                        }}
                      >
                        {r.id} ({r.userCount} {r.userCount === 1 ? "user" : "users"})
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="room-info">
            <p>
              You're in room <b>{room}</b>.{" "}
              <a href={`?room=${room}`} target="_blank" rel="noopener noreferrer">
                Share this link
              </a>{" "}
              or <a href="/">go back to the main globe</a>.
            </p>
          </div>
        )}
      </div>
      <div className="status">
        {counter !== 0 ? (
          <p>
            <b>{counter}</b> {counter === 1 ? "person" : "people"} connected.
          </p>
        ) : (
          <p>&nbsp;</p>
        )}
      </div>
      <div className="globe-container">
        <canvas
          ref={canvasRef as LegacyRef<HTMLCanvasElement>}
          style={{ width: 400, height: 400, maxWidth: "100%", aspectRatio: 1 }}
        />
      </div>
      <div className="visitors">
        <h3>Visitors</h3>
        <ul>
          {Array.from(users.entries()).map(([id, name]) => (
            <li key={id}>{name}</li>
          ))}
        </ul>
      </div>
      {room !== "default" && (
        <div className="chat">
          <h3>Messages</h3>
          <div className="message-list">
            {messages.map((msg) => (
              <div key={`${msg.id}-${msg.timestamp}`} className="message">
                <span className="message-sender">{msg.name}</span>: {msg.text}
                <span className="message-timestamp">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              aria-label="Chat message"
              maxLength={200}
            />
            <button type="submit" role="button">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(<App />);