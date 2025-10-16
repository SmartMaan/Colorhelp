


import React, { useState, useEffect, Component } from 'react';
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

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

// FIX: Changed import to explicitly include 'Component' and updated the class to extend it.
// This resolves typing issues where `this.props` and `this.state` were not found on the component instance.
class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

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
    const root = document.documentElement;
    const body = document.body;

    const colors = theme?.colors || {
        primary: '#ffd700', backgroundMain: '#14141e', backgroundPanel: '#1a1a24', backgroundHeader: 'rgba(20, 20, 30, 0.75)',
        backgroundInput: '#2a2a3c', backgroundBubbleUser: '#2a2a3c', backgroundBubbleAdmin: '#ffd700', textMain: '#f0f0f0',
        textMuted: '#888', textLight: '#14141e', border: 'rgba(255, 215, 0, 0.2)', unreadDot: '#ffd700', success: '#28a745', marked: '#ffc107',
    };

    for (const [key, value] of Object.entries(colors)) {
        root.style.setProperty(`--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
    }

    const defaultFont = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const fontFamily = theme?.fontFamily ? `'${theme.fontFamily}', sans-serif` : defaultFont;
    body.style.fontFamily = fontFamily;
    
    // Handle animated vs static backgrounds
    if (body.dataset.animationClass) {
        body.classList.remove(body.dataset.animationClass);
        delete body.dataset.animationClass;
    }
    if (theme?.backgroundAnimationClass) {
        body.classList.add(theme.backgroundAnimationClass);
        body.dataset.animationClass = theme.backgroundAnimationClass;
        body.style.backgroundImage = 'none';
        body.style.backgroundColor = 'transparent';
    } else {
        const backgroundImageUrl = theme?.backgroundImageUrl || '';
        body.style.backgroundImage = backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none';
        body.style.backgroundColor = backgroundImageUrl ? 'transparent' : (theme?.colors.backgroundMain || '#14141e');
    }

    // Apply advanced theme options
    root.style.setProperty('--blur-effect', theme?.blurEffectEnabled ? '10px' : '0px');
    root.style.setProperty('--color-background-chat', theme?.chatBackgroundColor || 'transparent');
    root.style.setProperty('--image-background-chat', theme?.chatBackgroundImageUrl ? `url(${theme.chatBackgroundImageUrl})` : 'none');
    root.style.setProperty('--opacity-background-chat', String(theme?.chatBackgroundImageOpacity ?? 1));
    root.style.setProperty('--message-corner-radius', `${theme?.messageCornerRadius ?? 18}px`);
    root.style.setProperty('--message-text-size', `${theme?.messageTextSize ?? 15}px`);
};


const ChatSkeleton: React.FC = () => (
    <div style={{...styles.chatContainer, background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)'}} className="responsive-container">
        <div style={{...styles.header, background: '#14141e', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
            <div className="skeleton" style={{ width: '120px', height: '24px', borderRadius: '8px' }}></div>
            <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
        </div>
        <div style={{...styles.messagesArea, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', alignItems: 'flex-end', width: '60%' }}>
                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
                <div className="skeleton" style={{ flex: 1, height: '40px' }}></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-end', alignItems: 'flex-end', width: '70%' }}>
                 <div className="skeleton" style={{ flex: 1, height: '60px' }}></div>
                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
            </div>
             <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', alignItems: 'flex-end', width: '50%' }}>
                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
                <div className="skeleton" style={{ flex: 1, height: '40px' }}></div>
            </div>
        </div>
        <div style={{...styles.inputArea, background: '#14141e', borderTop: '1px solid rgba(255,255,255,0.1)'}}>
            <div className="skeleton" style={{ flex: 1, height: '48px', borderRadius: '24px' }}></div>
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%' }}></div>
        </div>
    </div>
);
const styles: { [key: string]: React.CSSProperties } = {
    chatContainer: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', height: '90vh', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', overflow: 'hidden' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', flexShrink: 0 },
    messagesArea: { flex: 1, overflow: 'hidden' },
    inputArea: { display: 'flex', padding: '16px', gap: '10px', alignItems: 'center' },
};


const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'user' | 'admin' | 'master' | null>(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [themeLoading, setThemeLoading] = useState(true);

    // Effect for loading theme from Firebase
    useEffect(() => {
        const configRef = ref(database, 'app_config/theme');
        const unsubscribe = onValue(configRef, (snapshot) => {
            applyTheme(snapshot.exists() ? snapshot.val() : null);
            setThemeLoading(false);
        }, () => {
            applyTheme(null); // Fallback to default CSS if DB fails
            setThemeLoading(false);
        });
        return () => off(configRef, 'value', unsubscribe);
    }, []);

    // Effect for loading user session from localStorage
    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('chat_user');
            const savedRole = localStorage.getItem('chat_role') as 'user' | 'admin' | 'master' | null;
            if (savedUser && savedRole) {
                setUser(JSON.parse(savedUser));
                setRole(savedRole);
            }
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
            localStorage.clear();
        }
        setSessionLoading(false);
    }, []);

    const handleLogin = (loggedInUser: User, loggedInRole: 'user' | 'admin' | 'master') => {
        setUser(loggedInUser);
        setRole(loggedInRole);
        localStorage.setItem('chat_user', JSON.stringify(loggedInUser));
        localStorage.setItem('chat_role', loggedInRole);
    };

    const handleLogout = () => {
        setUser(null);
        setRole(null);
        localStorage.removeItem('chat_user');
        localStorage.removeItem('chat_role');
        localStorage.removeItem('chat_is_admin'); // Cleanup old key
        localStorage.removeItem('guest_user_id');
    };

    if (themeLoading) {
        return <div style={appStyles}><ChatSkeleton /></div>;
    }
    
    if (sessionLoading) {
        return <div style={loadingStyles}>Loading Session...</div>;
    }

    return (
        <ErrorBoundary>
            <div style={appStyles}>
                {!user ? (
                    <Login onLogin={handleLogin} />
                ) : (role === 'admin' || role === 'master') ? (
                    <AdminPanel adminUser={user} onLogout={handleLogout} role={role} />
                ) : (
                    <UserChat user={user} onLogout={handleLogout} />
                )}
            </div>
        </ErrorBoundary>
    );
};

export default App;