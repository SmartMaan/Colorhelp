import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { AppConfig, FirebaseConfig } from '../types';
import { firebaseConfig as currentFirebaseConfig } from '../firebase';

interface MasterSettingsProps {
    onBack: () => void;
}

const DEFAULT_CONFIG: Partial<AppConfig> = {
    mediaUploadsEnabled: false,
    mediaUploadApiKey: '',
    firebaseConfig: undefined,
};

const MasterSettings: React.FC<MasterSettingsProps> = ({ onBack }) => {
    const [config, setConfig] = useState<Partial<AppConfig>>(DEFAULT_CONFIG);
    const [newFirebaseConfig, setNewFirebaseConfig] = useState<Partial<FirebaseConfig>>({});
    const [statusMessage, setStatusMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        const configRef = ref(database, 'app_config');
        const unsubscribe = onValue(configRef, (snapshot) => {
            if (snapshot.exists()) {
                const dbConfig = snapshot.val();
                setConfig(prev => ({ ...prev, ...dbConfig }));
                setNewFirebaseConfig(dbConfig.firebaseConfig || {});
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSave = () => {
        setIsLoading(true);
        const updates: Partial<AppConfig> = {
            mediaUploadsEnabled: config.mediaUploadsEnabled,
            mediaUploadApiKey: config.mediaUploadApiKey,
        };
        
        // FIX: Added a type guard to ensure `val` is a string before calling `trim()`.
        const hasNewConfig = Object.values(newFirebaseConfig).some(val => typeof val === 'string' && val.trim() !== '');

        if (hasNewConfig) {
            updates.firebaseConfig = newFirebaseConfig as FirebaseConfig;
        }

        update(ref(database, 'app_config'), updates)
            .then(() => {
                if (hasNewConfig) {
                    localStorage.setItem('firebase_config_override', JSON.stringify(updates.firebaseConfig));
                    setStatusMessage('Settings saved! Reloading to apply new Firebase config...');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    setStatusMessage('Settings saved successfully!');
                     setTimeout(() => {
                        setStatusMessage('');
                        setIsLoading(false);
                    }, 2000);
                }
            })
            .catch(err => {
                setStatusMessage('Error saving settings.');
                setIsLoading(false);
                console.error(err);
            });
    };
    
    const handleFbConfigChange = (key: keyof FirebaseConfig, value: string) => {
        setNewFirebaseConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <button onClick={onBack} style={styles.backButton} className="mobile-back-button">←</button>
                <h2 style={styles.title}>Master Settings</h2>
            </header>
            
            <div style={styles.scrollableContent}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>Media (Image) Uploads</label>
                     <label className="toggle-switch">
                        <input type="checkbox" checked={!!config.mediaUploadsEnabled} onChange={(e) => setConfig(prev => ({ ...prev, mediaUploadsEnabled: e.target.checked }))} />
                        <span className="slider"></span>
                    </label>
                </div>
                
                {config.mediaUploadsEnabled && (
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Media Upload API Key (imgbb.com)</label>
                        <input type="text" style={styles.input} placeholder="Enter your image hosting API key" value={config.mediaUploadApiKey || ''} onChange={(e) => setConfig(prev => ({...prev, mediaUploadApiKey: e.target.value}))} />
                    </div>
                )}

                <div style={{...styles.formGroup, marginTop: '24px', paddingTop: '24px', borderTop: `1px solid var(--color-border)`}}>
                    <label style={styles.label}>Firebase Configuration</label>
                    <div style={styles.warningBox}>
                        <strong>Warning:</strong> Changing these settings will reload the application. This will connect all future visitors to the new Firebase project. Ensure the new configuration is correct.
                    </div>

                    <div style={styles.fbConfigContainer}>
                        <div>
                           <h4 style={styles.fbConfigHeader}>Current (In-Use) Config</h4>
                           <pre style={styles.codeBlock}>{JSON.stringify(currentFirebaseConfig, null, 2)}</pre>
                        </div>
                         <div>
                           <h4 style={styles.fbConfigHeader}>New Config (Overrides Current)</h4>
                           <p style={styles.helpText}>Leave all fields blank to revert to the hardcoded config. Fill all fields to switch to a new Firebase project.</p>
                           {Object.keys(currentFirebaseConfig).map(key => (
                               <div key={key} style={{marginBottom: '10px'}}>
                                   <label style={styles.fbInputLabel}>{key}</label>
                                   <input
                                      type="text"
                                      style={styles.input}
                                      placeholder="Leave blank to use default"
                                      value={newFirebaseConfig[key as keyof FirebaseConfig] || ''}
                                      onChange={e => handleFbConfigChange(key as keyof FirebaseConfig, e.target.value)}
                                   />
                               </div>
                           ))}
                        </div>
                    </div>
                </div>

                <button style={styles.saveButton} onClick={handleSave} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Master Settings'}
                </button>
                {statusMessage && <p style={{...styles.statusMessage, color: statusMessage.startsWith('Error') ? '#ff6b6b' : 'var(--color-success)'}}>{statusMessage}</p>}
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
    container: { display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', background: 'var(--color-background-panel)' },
    header: { padding: '16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-main)', display: 'flex', alignItems: 'center', gap: '16px' },
    title: { margin: 0, color: 'var(--color-text-main)', flex: 1, fontSize: '1.2em' },
    backButton: { display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-main)', fontSize: '24px' },
    scrollableContent: { padding: '24px', flex: 1, overflowY: 'auto' },
    formGroup: { marginBottom: '20px' },
    label: { display: 'block', marginBottom: '8px', color: 'var(--color-primary)', fontSize: '16px', fontWeight: 500 },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    helpText: { fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' },
    warningBox: { background: 'rgba(255, 193, 7, 0.1)', border: '1px solid var(--color-marked)', color: 'var(--color-marked)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' },
    fbConfigContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    fbConfigHeader: { margin: '0 0 12px 0', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' },
    codeBlock: { background: 'var(--color-background-main)', padding: '12px', borderRadius: '8px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
    fbInputLabel: { display: 'block', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '4px' },
    saveButton: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text-light)', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },
    statusMessage: { marginTop: '16px', textAlign: 'center' },
};

export default MasterSettings;