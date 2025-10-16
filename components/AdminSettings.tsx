import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { AppConfig, Theme } from '../types';
import { UserIcon } from './icons/Icons';
import { ImageUploadModal } from './ImageUploadModal';
import ThemeEditor from './ThemeEditor';

interface AdminSettingsProps {
    onBack: () => void;
}

const DEFAULT_CONFIG: AppConfig = {
    appName: 'Royal Support Mart',
    agentName: 'Support Agent',
    agentStatus: 'online',
    theme: { 
        mode: 'royal', 
        colors: {
            primary: '#ffd700', backgroundMain: '#14141e', backgroundPanel: '#1a1a24', backgroundHeader: 'rgba(20, 20, 30, 0.75)',
            backgroundInput: '#2a2a3c', backgroundBubbleUser: '#2a2a3c', backgroundBubbleAdmin: '#ffd700', textMain: '#f0f0f0',
            textMuted: '#888', textLight: '#14141e', border: 'rgba(255, 215, 0, 0.2)', unreadDot: '#ffd700', success: '#28a745', marked: '#ffc107',
            markedHighlight: 'rgba(255, 193, 7, 0.3)'
        }, 
        fontFamily: 'Poppins', 
        backgroundImageUrl: '',
        blurEffectEnabled: true,
        chatBackgroundColor: '',
        chatBackgroundImageUrl: '',
        chatBackgroundImageOpacity: 0.1,
        messageCornerRadius: 18,
        messageTextSize: 15,
    },
    mediaUploadsEnabled: false,
    mediaUploadApiKey: '',
    welcomeMessage: 'Welcome to our support chat! Let us know how we can help you today.',
    helpSuggestions: [],
    aiSuggestionsEnabled: true,
};

const AdminSettings: React.FC<AdminSettingsProps> = ({ onBack }) => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [statusMessage, setStatusMessage] = useState('');
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);

    useEffect(() => {
        const configRef = ref(database, 'app_config');
        const unsubscribe = onValue(configRef, (snapshot) => {
            if (snapshot.exists()) {
                const dbConfig = snapshot.val();
                setConfig(prev => ({ 
                    ...DEFAULT_CONFIG, 
                    ...dbConfig,
                    theme: {
                        ...DEFAULT_CONFIG.theme,
                        ...(dbConfig.theme || {}),
                        colors: {
                            ...DEFAULT_CONFIG.theme.colors,
                            ...(dbConfig.theme?.colors || {})
                        }
                    }
                }));
            } else {
                set(configRef, DEFAULT_CONFIG);
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSave = () => {
        update(ref(database, 'app_config'), config)
            .then(() => {
                setStatusMessage('Settings saved successfully!');
                setTimeout(() => setStatusMessage(''), 2000);
            })
            .catch(err => {
                setStatusMessage('Error saving settings.');
                console.error(err);
            });
    };

    const handleOpenImageModal = () => {
        if (!config.mediaUploadApiKey) {
            alert("Please set the Media Upload API Key to enable image uploads.");
            return;
        }
        setIsImageModalOpen(true);
    };

    const handleImageSave = (url: string) => {
        setConfig(prev => ({ ...prev, agentProfileImageUrl: url }));
        setIsImageModalOpen(false);
    };
    
    const handleThemeSave = (newTheme: Theme) => {
        setConfig(prev => ({ ...prev, theme: newTheme }));
        setIsThemeEditorOpen(false);
    };

    return (
        <div style={styles.container}>
            <ImageUploadModal 
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                onImageSave={handleImageSave}
                apiKey={config.mediaUploadApiKey || ''}
            />
            {isThemeEditorOpen && (
                <ThemeEditor 
                    initialTheme={config.theme}
                    apiKey={config.mediaUploadApiKey || ''}
                    onSave={handleThemeSave}
                    onClose={() => setIsThemeEditorOpen(false)}
                />
            )}
            <header style={styles.header}>
                <button onClick={onBack} style={styles.backButton} className="mobile-back-button">←</button>
                <h2 style={styles.title}>Application Settings</h2>
            </header>
            
            <div style={styles.scrollableContent}>
                 <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>General Settings</h3>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>App Name</label>
                        <input type="text" style={styles.input} value={config.appName} onChange={(e) => setConfig(prev => ({...prev, appName: e.target.value}))} />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Agent Name</label>
                        <input type="text" style={styles.input} value={config.agentName} onChange={(e) => setConfig(prev => ({...prev, agentName: e.target.value}))} />
                    </div>
                </div>

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Admin Profile</h3>
                    <div style={styles.profileSection}>
                        {config.agentProfileImageUrl ? (
                            <img src={config.agentProfileImageUrl} alt="Admin" style={styles.profileImage} />
                        ) : (
                            <div style={styles.profileImagePlaceholder}><UserIcon width={40} height={40} /></div>
                        )}
                        <button style={styles.changeImageButton} onClick={handleOpenImageModal}>Change Picture</button>
                    </div>
                </div>
                
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Chat Experience</h3>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Initial Welcome Message</label>
                        <textarea style={styles.textarea} value={config.welcomeMessage || ''} onChange={(e) => setConfig(prev => ({...prev, welcomeMessage: e.target.value}))} placeholder="e.g., Welcome to our support chat! How can we help you today?" />
                        <small style={styles.helpText}>This message is shown to users in an empty chat window.</small>
                    </div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>New Chat Help Suggestions</label>
                        <textarea style={styles.textarea} value={(config.helpSuggestions || []).join('\n')} onChange={(e) => setConfig(prev => ({...prev, helpSuggestions: e.target.value.split('\n').filter(s => s.trim() !== '')}))} placeholder="Withdraw related&#10;Deposit related&#10;Game related" />
                        <small style={styles.helpText}>Enter each suggestion on a new line. These will be shown as clickable buttons to new users.</small>
                    </div>
                    
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Enable AI Reply Suggestions</label>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={!!config.aiSuggestionsEnabled} onChange={(e) => setConfig(prev => ({ ...prev, aiSuggestionsEnabled: e.target.checked }))} />
                            <span className="slider"></span>
                        </label>
                        <small style={styles.helpText}>Allows the admin to generate reply suggestions using AI in the chat view.</small>
                    </div>
                </div>

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Media Settings</h3>
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Enable Media (Image) Uploads</label>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={!!config.mediaUploadsEnabled} onChange={(e) => setConfig(prev => ({ ...prev, mediaUploadsEnabled: e.target.checked }))} />
                            <span className="slider"></span>
                        </label>
                        <small style={styles.helpText}>Allows users and admins to upload images. Requires an API key from imgbb.com.</small>
                    </div>
                    {config.mediaUploadsEnabled && (
                         <div style={styles.formGroup}>
                            <label style={styles.label}>Media Upload API Key (from imgbb.com)</label>
                            <input type="text" style={styles.input} placeholder="Enter your imgbb.com API key" value={config.mediaUploadApiKey || ''} onChange={(e) => setConfig(prev => ({...prev, mediaUploadApiKey: e.target.value}))} />
                            <small style={styles.helpText}>This is required for the image upload feature to work.</small>
                        </div>
                    )}
                </div>

                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Theme Customization</h3>
                    <div style={styles.themeInfoBox}>
                        <div>
                            <p style={styles.themeInfoText}>Current Theme Mode: <strong style={{color: 'var(--color-primary)'}}>{config.theme.mode}</strong></p>
                            <p style={styles.themeInfoText}>Font: <strong>{config.theme.fontFamily}</strong></p>
                        </div>
                        <button style={styles.customizeButton} onClick={() => setIsThemeEditorOpen(true)}>
                            Customize Theme
                        </button>
                    </div>
                </div>

                <button style={styles.saveButton} onClick={handleSave}>Save Changes</button>
                {statusMessage && <p style={styles.statusMessage}>{statusMessage}</p>}
            </div>
             <style>{`
                .toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-background-input); transition: .4s; border-radius: 28px; border: 1px solid var(--color-border); }
                .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: var(--color-text-muted); transition: .4s; border-radius: 50%; }
                .toggle-switch input:checked + .slider { background-color: var(--color-primary); }
                .toggle-switch input:checked + .slider:before { transform: translateX(20px); background-color: var(--color-text-light); }
            `}</style>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' },
    header: { padding: '16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-main)', display: 'flex', alignItems: 'center', gap: '16px' },
    title: { margin: 0, color: 'var(--color-text-main)', flex: 1, fontSize: '1.2em' },
    backButton: { display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-main)', fontSize: '24px' },
    scrollableContent: { padding: '24px', flex: 1, overflowY: 'auto' },
    section: { marginBottom: '24px', paddingTop: '24px', borderTop: `1px solid var(--color-border)` },
    sectionTitle: { marginTop: 0, marginBottom: '20px', color: 'var(--color-primary)' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '14px', fontWeight: 500 },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    textarea: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' },
    helpText: { fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' },
    profileSection: { display: 'flex', alignItems: 'center', gap: '20px' },
    profileImage: { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' },
    profileImagePlaceholder: { width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-background-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', border: '2px solid var(--color-border)' },
    changeImageButton: { padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', cursor: 'pointer' },
    themeInfoBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-background-input)', padding: '16px', borderRadius: '8px' },
    themeInfoText: { margin: '0 0 8px 0', color: 'var(--color-text-muted)' },
    customizeButton: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text-light)', fontWeight: 500, cursor: 'pointer' },
    saveButton: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text-light)', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },
    statusMessage: { marginTop: '16px', textAlign: 'center', color: 'var(--color-success)' },
};

export default AdminSettings;
