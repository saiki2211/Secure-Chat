import React, { useState, useEffect } from 'react';
import { useSecureChat } from '../context/SecureChatContext';
import './UserList.css';

const UserList = ({ onSelectUser }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { user: currentUser } = useSecureChat();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/users`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch users');
                }

                const data = await response.json();
                // Filter out the current user
                const otherUsers = data.filter(u => u._id !== currentUser?.id);
                setUsers(otherUsers);
            } catch (err) {
                setError('Failed to load users');
                console.error('Error fetching users:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [currentUser]);

    if (loading) {
        return <div className="user-list-loading">Loading users...</div>;
    }

    if (error) {
        return <div className="user-list-error">{error}</div>;
    }

    return (
        <div className="user-list">
            <h3>Available Users</h3>
            {users.length === 0 ? (
                <div className="no-users">No other users available</div>
            ) : (
                <ul>
                    {users.map(user => (
                        <li 
                            key={user._id}
                            onClick={() => onSelectUser(user)}
                            className="user-item"
                        >
                            <div className="user-info">
                                <span className="username">{user.username}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default UserList; 