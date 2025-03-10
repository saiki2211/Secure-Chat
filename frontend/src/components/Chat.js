import React, { useState } from 'react';
import UserList from './UserList';
import ChatRoom from './ChatRoom';
import './Chat.css';

const Chat = () => {
    const [selectedUser, setSelectedUser] = useState(null);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
    };

    return (
        <div className="chat-container">
            <UserList onSelectUser={handleSelectUser} />
            {selectedUser ? (
                <ChatRoom 
                    receiverId={selectedUser._id}
                    receiverName={selectedUser.username}
                />
            ) : (
                <div className="no-chat-selected">
                    <p>Select a user to start chatting</p>
                </div>
            )}
        </div>
    );
};

export default Chat; 