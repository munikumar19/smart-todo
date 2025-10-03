import React, { useState } from 'react';
import axios from 'axios';

// Backend endpoints for authentication
const LOGIN_URL = 'http://localhost:5000/api/auth/login';
const REGISTER_URL = 'http://localhost:5000/api/auth/register';

const AuthForm = ({ onAuthSuccess, currentTheme }) => {
    const [isLogin, setIsLogin] = useState(true); // True for Login, False for Register
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const url = isLogin ? LOGIN_URL : REGISTER_URL;
        
        try {
            const response = await axios.post(url, { email, password });
            
            // The backend returns a JWT token.
            const token = response.data.token;
            
            // Decode the token locally to get the User ID
            // This logic correctly decodes the user ID from the JWT payload
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            const userId = payload.userId;

            // Pass the token and user ID up to App.js to set the authenticated session
            onAuthSuccess(token, userId);

        } catch (err) {
            console.error("Authentication failed:", err);
            // Extracts error message from response if available, otherwise uses a default message
            const message = err.response?.data?.message || 'Authentication failed. Please check your credentials.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    return (
        <div className={`auth-container ${currentTheme}`}>
            <h2>{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="auth-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="auth-input"
                />

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" disabled={isLoading} className="auth-submit-button">
                    {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
                </button>
            </form>

            <button onClick={toggleMode} className="auth-toggle-mode-button">
                {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
        </div>
    );
};

export default AuthForm;