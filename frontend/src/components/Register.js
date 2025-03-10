import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecureChat } from '../context/SecureChatContext';
import { generateAESKey, storeUserKeys } from '../utils/cryptoUtils';
import './Auth.css';

const Register = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [captcha, setCaptcha] = useState('');
    const [captchaImage, setCaptchaImage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login } = useSecureChat();

    const fetchCaptcha = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/captcha`);
            const data = await response.json();
            setCaptchaImage(data.captcha);
        } catch (error) {
            console.error('Error fetching CAPTCHA:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            // Generate RSA key pair
            const response = await fetch(`${process.env.REACT_APP_API_URL}/generate-keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate keys');
            }

            const { publicKey, privateKey } = await response.json();

            // Register user
            const registerResponse = await fetch(`${process.env.REACT_APP_API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    publicKey,
                    captcha 
                }),
            });

            const data = await registerResponse.json();

            if (!registerResponse.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store keys securely
            await storeUserKeys(data.user.id, { publicKey, privateKey });

            // Login the user
            const loginResponse = await fetch(`${process.env.REACT_APP_API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, captcha }),
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(loginData.error || 'Login failed');
            }

            localStorage.setItem('token', loginData.token);
            await login(loginData.user);
            navigate('/chat');
        } catch (error) {
            setError(error.message);
            fetchCaptcha(); // Refresh CAPTCHA on error
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>Register</h2>
                {error && <div className="error-message">{error}</div>}
                
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="captcha">CAPTCHA</label>
                    <div className="captcha-container">
                        <img 
                            src={`data:image/svg+xml;base64,${captchaImage}`} 
                            alt="CAPTCHA" 
                            className="captcha-image"
                        />
                        <button 
                            type="button" 
                            onClick={fetchCaptcha}
                            className="refresh-captcha"
                        >
                            ↻
                        </button>
                    </div>
                    <input
                        type="text"
                        id="captcha"
                        value={captcha}
                        onChange={(e) => setCaptcha(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="submit-button">
                    Register
                </button>
            </form>
        </div>
    );
};

export default Register; 