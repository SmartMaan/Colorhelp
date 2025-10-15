


import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import UserChat from './components/UserChat';
import AdminPanel from './components/AdminPanel';
import { User, Theme } from './types';
import { database } from './firebase';
import { ref, onValue, off } from 'firebase/database';

const appStyles: React.CSSProperties = {
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    background: 'transparent',
};

const loadingStyles: React.CSSProperties = {
    ...appStyles,
    fontSize: '24px',
    color: 'var(--color-primary, #ffd700)',
};

// Error Boundary Component to prevent blank screens
class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, { hasError: boolean }> {
  // FIX: Initialize state as a class property for clarity and to resolve potential issues with `this` context.
  state = { hasError: false };

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Chat App crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: '#ff6b6b', padding: '40px', textAlign: 'center', background: 'var(--color-background-panel)', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
          <h2>Oops! Something went wrong.</h2>
          <p style={{color: 'var(--color-text-main)'}}>We're sorry for the inconvenience. Please try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Applies theme from DB or falls back to default
const applyTheme = (theme: Theme | null) => {
    const colors = theme?.colors || {
        primary: '#ffd700',
        backgroundMain: '#14141e',
        backgroundPanel: '#1a1a24',
        backgroundHeader: 'rgba(20, 20, 30, 0.75)',
        backgroundInput: '#2a2a3c',
        backgroundBubbleUser: '#2a2a3c',
        backgroundBubbleAdmin: '#ffd700',
        textMain: '#f0f0f0',
        textMuted: '#888',
        textLight: '#14141e',
        border: 'rgba(255, 215, 0, 0.2)',
        unreadDot: '#ffd700',
        success: '#28a745',
        marked: '#ffc107',
    };

    for (const [key, value] of Object.entries(colors)) {
        document.documentElement.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    }
};


const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    // Effect for loading theme from Firebase
    useEffect(() => {
        const configRef = ref(database, 'app_config/theme');
        const unsubscribe = onValue(configRef, (snapshot) => {
            applyTheme(snapshot.exists() ? snapshot.val() : null);
        });
        return () => off(configRef, 'value', unsubscribe);
    }, []);

    // Effect for loading user session from localStorage
    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('chat_user');
            const savedIsAdmin = localStorage.getItem('chat_is_admin');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
                setIsAdmin(savedIsAdmin === 'true');
            }
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
            localStorage.clear();
        }
        setLoading(false);
    }, []);

    const handleLogin = (loggedInUser: User, admin: boolean) => {
        setUser(loggedInUser);
        setIsAdmin(admin);
        localStorage.setItem('chat_user', JSON.stringify(loggedInUser));
        localStorage.setItem('chat_is_admin', String(admin));
    };

    const handleLogout = () => {
        setUser(null);
        setIsAdmin(false);
        localStorage.removeItem('chat_user');
        localStorage.removeItem('chat_is_admin');
        localStorage.removeItem('guest_user_id');
    };

    if (loading) {
        return <div style={loadingStyles}>Loading...</div>;
    }

    return (
        <ErrorBoundary>
            <div style={appStyles}>
                {!user ? (
                    <Login onLogin={handleLogin} />
                ) : isAdmin ? (
                    <AdminPanel adminUser={user} onLogout={handleLogout} />
                ) : (
                    <UserChat user={user} onLogout={handleLogout} />
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;