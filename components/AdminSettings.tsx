import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { AppConfig, Theme, ThemeColors } from '../types';

interface AdminSettingsProps {
    onBack: () => void;
}

const DEFAULT_COLORS: ThemeColors = {
    primary: '#ffd700', backgroundMain: '#14141e', backgroundPanel: '#1a1a24', backgroundHeader: 'rgba(20, 20, 30, 0.75)',
    backgroundInput: '#2a2a3c', backgroundBubbleUser: '#2a2a3c', backgroundBubbleAdmin: '#ffd700', textMain: '#f0f0f0',
    textMuted: '#888', textLight: '#14141e', border: 'rgba(255, 215, 0, 0.2)', unreadDot: '#ffd700', success: '#28a745', marked: '#ffc107',
    markedHighlight: 'rgba(255, 193, 7, 0.3)'
};

const DEFAULT_CONFIG: AppConfig = {
    appName: 'Royal Support Mart',
    agentName: 'Support Agent',
    agentStatus: 'online',
    theme: { mode: 'royal', colors: DEFAULT_COLORS },
    mediaUploadsEnabled: false,
    mediaUploadApiKey: '',
    welcomeMessage: 'Welcome to our support chat! Let us know how we can help you today.',
    helpSuggestions: [],
};

const ColorPicker: React.FC<{ label: string; color: string; onChange: (color: string) => void }> = ({ label, color, onChange }) => (
    <div style={styles.colorPickerWrapper}>
        <label>{label}</label>
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} style={styles.colorInput} />
    </div>
);

const AdminSettings: React.FC<AdminSettingsProps> = ({ onBack }) => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const configRef = ref(database, 'app_config');
        const unsubscribe = onValue(configRef, (snapshot) => {
            if (snapshot.exists()) {
                setConfig(prev => ({ ...DEFAULT_CONFIG, ...snapshot.val() }));
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
    
    const handleColorChange = (key: keyof ThemeColors, value: string) => {
        setConfig(prev => ({
            ...prev,
            theme: {
                ...prev.theme,
                mode: 'custom',
                colors: { ...prev.theme.colors, [key]: value }
            }
        }));
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <button onClick={onBack} style={styles.backButton} className="mobile-back-button">←</button>
                <h2 style={styles.title}>Application Settings</h2>
            </header>
            
            <div style={styles.scrollableContent}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>App Name</label>
                    <input type="text" style={styles.input} value={config.appName} onChange={(e) => setConfig(prev => ({...prev, appName: e.target.value}))} />
                </div>
                
                <div style={styles.formGroup}>
                    <label style={styles.label}>Agent Name</label>
                    <input type="text" style={styles.input} value={config.agentName} onChange={(e) => setConfig(prev => ({...prev, agentName: e.target.value}))} />
                </div>
                
                <div style={styles.formGroup}>
                    <label style={styles.label}>Initial Welcome Message</label>
                    <textarea 
                        style={{...styles.input, minHeight: '80px', resize: 'vertical'}} 
                        value={config.welcomeMessage || ''} 
                        onChange={(e) => setConfig(prev => ({...prev, welcomeMessage: e.target.value}))}
                        placeholder="e.g., Welcome to our support chat! How can we help you today?"
                    />
                    <small style={styles.helpText}>This message is shown to users in an empty chat window.</small>
                </div>
                
                <div style={styles.formGroup}>
                    <label style={styles.label}>New Chat Help Suggestions</label>
                    <textarea 
                        style={{...styles.input, minHeight: '100px', resize: 'vertical'}} 
                        value={(config.helpSuggestions || []).join('\n')} 
                        onChange={(e) => setConfig(prev => ({...prev, helpSuggestions: e.target.value.split('\n').filter(s => s.trim() !== '')}))}
                        placeholder="Withdraw related&#10;Deposit related&#10;Game related"
                    />
                    <small style={styles.helpText}>Enter each suggestion on a new line. These will be shown as clickable buttons to new users.</small>
                </div>

                 <div style={styles.formGroup}>
                    <label style={styles.label}>Media (Image) Uploads</label>
                     <label className="toggle-switch">
                        <input type="checkbox" checked={!!config.mediaUploadsEnabled} onChange={(e) => setConfig(prev => ({ ...prev, mediaUploadsEnabled: e.target.checked }))} />
                        <span className="slider"></span>
                    </label>
                </div>
                
                {config.mediaUploadsEnabled && (
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Media Upload API Key</label>
                        <input type="text" style={styles.input} placeholder="Enter your image hosting API key" value={config.mediaUploadApiKey || ''} onChange={(e) => setConfig(prev => ({...prev, mediaUploadApiKey: e.target.value}))} />
                    </div>
                )}

                <div style={styles.formGroup}>
                     <label style={styles.label}>Theme Colors</label>
                     <div style={styles.themeGrid}>
                        {Object.entries(config.theme.colors || DEFAULT_COLORS).map(([key, value]) => (
                            <ColorPicker key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} color={value} onChange={(color) => handleColorChange(key as keyof ThemeColors, color)} />
                        ))}
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
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '14px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    helpText: { fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' },
    themeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' },
    colorPickerWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-background-input)', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' },
    colorInput: { width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer' },
    saveButton: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text-light)', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },
    statusMessage: { marginTop: '16px', textAlign: 'center', color: 'var(--color-success)' },
};

export default AdminSettings;