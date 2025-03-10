import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { encryptMessage, decryptMessage, storeMessage, getOfflineMessages, storeUserKeys, getUserKeys } from '../utils/cryptoUtils';

const SecureChatContext = createContext();

export const useSecureChat = () => {
    const context = useContext(SecureChatContext);
    if (!context) {
        throw new Error('useSecureChat must be used within a SecureChatProvider');
    }
    return context;
};

export const SecureChatProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [messages, setMessages] = useState({});
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const socketRef = useRef(null);

    const connectSocket = useCallback(() => {
        const token = localStorage.getItem('token');
        if (!token || !user) return;

        const socket = io(process.env.REACT_APP_API_URL, {
            auth: { token },
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            // Retry connection with polling if websocket fails
            if (socket.io.opts.transports[0] === 'websocket') {
                socket.io.opts.transports = ['polling', 'websocket'];
            }
        });

        socket.on('connect', () => {
            console.log('Socket connected successfully');
        });

        socket.on('userStatus', ({ userId, status }) => {
            setOnlineUsers(prev => {
                const newSet = new Set(prev);
                if (status === 'online') {
                    newSet.add(userId);
                } else {
                    newSet.delete(userId);
                }
                return newSet;
            });
        });

        socket.on('onlineUsers', (users) => {
            setOnlineUsers(new Set(users));
        });

        socket.on('receiveMessage', (message) => {
            setMessages(prev => {
                const chatId = message.sender === user.id ? message.receiver : message.sender;
                return {
                    ...prev,
                    [chatId]: [...(prev[chatId] || []), message]
                };
            });
        });

        socket.on('previousMessages', (prevMessages) => {
            const messagesByChat = prevMessages.reduce((acc, msg) => {
                const chatId = msg.sender === user.id ? msg.receiver : msg.sender;
                if (!acc[chatId]) acc[chatId] = [];
                acc[chatId].push(msg);
                return acc;
            }, {});
            setMessages(messagesByChat);
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        socketRef.current = socket;
        return () => socket.disconnect();
    }, [user]);

    useEffect(() => {
        const cleanup = connectSocket();
        return () => cleanup?.();
    }, [connectSocket]);

    const sendMessage = useCallback((receiverId, content) => {
        if (!socketRef.current?.connected) {
            throw new Error('Not connected to chat server');
        }
        socketRef.current.emit('sendMessage', {
            receiver: receiverId,
            content
        });
    }, []);

    const isUserOnline = useCallback((userId) => {
        return onlineUsers.has(userId);
    }, [onlineUsers]);

    const value = {
        user,
        setUser,
        messages,
        sendMessage,
        isUserOnline,
        onlineUsers: Array.from(onlineUsers)
    };

    return (
        <SecureChatContext.Provider value={value}>
            {children}
        </SecureChatContext.Provider>
    );
}; 