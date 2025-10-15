import React, { useState, useEffect } from 'react';
import { database, serverTimestamp } from '../firebase';
import { ref, set, get, update, onValue } from 'firebase/database';
import { User } from '../types';

interface LoginProps {
    onLogin: (user: User, isAdmin: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [appName, setAppName] = useState('Golden Royal Chat');

    useEffect(() => {
        const appNameRef = ref(database, 'app_config/appName');
        const unsubscribe = onValue(appNameRef, (snapshot) => {
            if (snapshot.exists()) {
                setAppName(snapshot.val());
            }
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Secret Admin Login
        if (name.trim() === '666club' && email.trim() === 'admin666@club.com') {
            const adminUser: User = { id: 'admin', name: 'Admin', email: 'admin@app.com', phone: '' };
            onLogin(adminUser, true);
            return;
        }

        const trimmedEmail = email.trim();
        const trimmedName = name.trim();

        if (!trimmedName && !trimmedEmail) {
            setError('Please provide a name or email to start.');
            return;
        }
        
        let userId: string;
        const isGuest = !trimmedEmail;

        if (isGuest) {
            let guestId = localStorage.getItem('guest_user_id');
            if (!guestId) {
                guestId = 'guest_' + Date.now() + Math.random().toString(36).substring(2, 8);
                localStorage.setItem('guest_user_id', guestId);
            }
            userId = guestId;
        } else {
            // FIX: Corrected regex to properly sanitize email into a userId. The range was '0-g' instead of '0-9'.
            userId = trimmedEmail.replace(/[^a-zA-Z0-9]/g, '');
        }
        
        const userRef = ref(database, 'users/' + userId);

        try {
            const snapshot = await get(userRef);
            let user: User;
            if (snapshot.exists()) {
                // Existing user
                user = { ...snapshot.val(), id: userId };
                const updates: Partial<User> = { lastActivity: serverTimestamp() as any, isClosed: false };
                if (trimmedName) updates.name = trimmedName;
                if (phone) updates.phone = phone;
                await update(userRef, updates);
            } else {
                // New user
                user = {
                    id: userId,
                    name: trimmedName || 'Guest User',
                    email: trimmedEmail,
                    phone,
                    createdAt: serverTimestamp() as any,
                    lastActivity: serverTimestamp() as any,
                };
                await set(userRef, user);
            }
            
            if (!isGuest) {
                localStorage.removeItem('guest_user_id');
            }
            onLogin(user, false);
        } catch (err) {
            console.error(err);
            setError('Failed to login. Please try again.');
        }
    };

    return (
        <div className="login-container">
            <h2 className="login-title">{appName}</h2>
            <p className="login-subtitle">Connect with Support</p>
            <form onSubmit={handleLogin} className="login-form">
                <input className="login-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                <input className="login-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                <input className="login-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (Optional)" />
                
                {error && <p className="login-error">{error}</p>}
                <button type="submit" className="login-button">
                    Start Chat
                </button>
            </form>
        </div>
    );
};

export default Login;