import React, { useState, useEffect, useContext } from "react";
import io from "socket.io-client";
import CryptoJS from "crypto-js";
import { AuthContext } from "../context/AuthContext";

const socket = io("http://localhost:5000");

// Predefined secret key (must match server.js)
const SECRET_KEY = "your_32_character_secret_key";

const Chat = () => {
    const { user } = useContext(AuthContext);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);

    // Decrypt function
    const decryptMessage = (encryptedText) => {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
            return bytes.toString(CryptoJS.enc.Utf8) || "[Decryption Error]";
        } catch (err) {
            return "[Decryption Failed]";
        }
    };

    // Fetch previous messages on mount
    useEffect(() => {
        socket.on("previousMessages", (loadedMessages) => {
            const decryptedMessages = loadedMessages.map((msg) => ({
                sender: msg.sender,
                message: decryptMessage(msg.message),
            }));
            setMessages(decryptedMessages);
        });

        socket.on("receiveMessage", (data) => {
            setMessages((prev) => [...prev, { sender: data.sender, message: decryptMessage(data.message) }]);
        });

        return () => {
            socket.off("previousMessages");
            socket.off("receiveMessage");
        };
    }, []);

    // 🚀 Fix: Early return AFTER hooks
    if (!user) {
        return <h2>Please log in first.</h2>;
    }

    // Encrypt and send message
    const sendMessage = () => {
        if (!message.trim()) return;

        const encryptedMessage = CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
        socket.emit("sendMessage", { sender: user.username, message: encryptedMessage });

        setMessages((prev) => [...prev, { sender: "You", message }]);
        setMessage("");
    };

    return (
        <div>
            <h2>Chat</h2>
            <div>
                {messages.map((msg, index) => (
                    <p key={index}><b>{msg.sender}:</b> {msg.message}</p>
                ))}
            </div>
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message"
            />
            <button onClick={sendMessage}>Send</button>
        </div>
    );
};

export default Chat;