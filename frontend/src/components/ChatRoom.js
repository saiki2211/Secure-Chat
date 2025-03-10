import React, { useState, useRef, useEffect } from 'react';
import { useSecureChat } from '../context/SecureChatContext';
import './ChatRoom.css';

const ChatRoom = ({ receiverId, receiverName }) => {
    const { messages, sendMessage, isOnline, user } = useSecureChat();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await sendMessage(receiverId, newMessage.trim());
        setNewMessage('');
    };

    const filteredMessages = messages.filter(
        msg => (msg.sender === receiverId && msg.receiver === user.id) ||
               (msg.sender === user.id && msg.receiver === receiverId)
    );

    return (
        <div className="chat-room">
            <div className="chat-header">
                <h2>{receiverName}</h2>
                <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                </div>
            </div>

            <div className="messages-container">
                {filteredMessages.map((message) => (
                    <div
                        key={message.id}
                        className={`message ${message.sender === user.id ? 'sent' : 'received'}`}
                    >
                        <div className="message-content">
                            <p>{message.content}</p>
                            <span className="message-time">
                                {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className={`message-status ${message.status}`}>
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && '✓✓'}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="message-input">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={!isOnline}
                />
                <button type="submit" disabled={!isOnline || !newMessage.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};

export default ChatRoom; 