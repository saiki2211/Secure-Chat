import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSecureChat } from '../context/SecureChatContext';
import './Auth.css';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [captcha, setCaptcha] = useState('');
    const [captchaImage, setCaptchaImage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCaptchaLoading, setIsCaptchaLoading] = useState(true);
    const navigate = useNavigate();
    const { login } = useSecureChat();

    const fetchCaptcha = async () => {
        setIsCaptchaLoading(true);
        setCaptchaImage('');
        setError('');
        
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/captcha`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            if (!data.captcha) {
                throw new Error('Invalid server response');
            }

            setCaptchaImage(data.captcha);
            if (process.env.NODE_ENV === 'development' && data.text) {
                console.log('CAPTCHA text:', data.text);
            }
        } catch (error) {
            console.error('CAPTCHA error:', error);
            setError('Failed to load CAPTCHA. Retrying...');
            setTimeout(fetchCaptcha, 2000);
        } finally {
            setIsCaptchaLoading(false);
        }
    };

    useEffect(() => {
        fetchCaptcha();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isCaptchaLoading || isLoading) return;
        
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ username, password, captcha })
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (data.error === "Invalid CAPTCHA" || data.error === "Session expired") {
                    setCaptcha('');
                    await fetchCaptcha();
                    setError(data.error === "Invalid CAPTCHA" ? 
                        'Incorrect CAPTCHA. Please try again.' : 
                        'Session expired. Please try again.');
                } else {
                    setError(data.error || 'Login failed');
                }
                return;
            }

            if (!data.token || !data.user) {
                throw new Error('Invalid server response');
            }

            localStorage.setItem('token', data.token);
            await login(data.user);
            navigate('/chat');
        } catch (error) {
            console.error('Login error:', error);
            setError('Connection error. Please try again.');
            setTimeout(fetchCaptcha, 1000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>Login</h2>
                {error && <div className="error-message">{error}</div>}
                
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
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
                        autoComplete="current-password"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="captcha">CAPTCHA</label>
                    <div className="captcha-container">
                        {isCaptchaLoading ? (
                            <div className="captcha-loading">Loading CAPTCHA...</div>
                        ) : captchaImage ? (
                            <img 
                                src={`data:image/svg+xml;base64,${captchaImage}`} 
                                alt="CAPTCHA" 
                                className="captcha-image"
                            />
                        ) : (
                            <div className="captcha-error">
                                Failed to load CAPTCHA
                            </div>
                        )}
                        <button 
                            type="button" 
                            onClick={fetchCaptcha}
                            className="refresh-captcha"
                            title="Refresh CAPTCHA"
                            disabled={isCaptchaLoading}
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
                        autoComplete="off"
                        placeholder="Enter the text shown above"
                    />
                </div>

                <button 
                    type="submit" 
                    className="submit-button"
                    disabled={isLoading || isCaptchaLoading}
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>

                <p style={{ marginTop: '1rem', textAlign: 'center' }}>
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </form>
        </div>
    );
};

export default Login; 