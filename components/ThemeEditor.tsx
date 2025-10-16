import React, { useState, useMemo, ChangeEvent } from 'react';
import { Theme, ThemeColors } from '../types';
import { ImageUploadModal } from './ImageUploadModal';
import { UserIcon, BotIcon, SendIcon } from './icons/Icons';

const ROYAL_DARK_COLORS: ThemeColors = {
    primary: '#ffd700', backgroundMain: '#14141e', backgroundPanel: '#1a1a24', backgroundHeader: 'rgba(20, 20, 30, 0.75)',
    backgroundInput: '#2a2a3c', backgroundBubbleUser: '#2a2a3c', backgroundBubbleAdmin: '#ffd700', textMain: '#f0f0f0',
    textMuted: '#888', textLight: '#14141e', border: 'rgba(255, 215, 0, 0.2)', unreadDot: '#ffd700', success: '#28a745', marked: '#ffc107',
    markedHighlight: 'rgba(255, 193, 7, 0.3)'
};

const TELEGRAM_NIGHT_COLORS: ThemeColors = {
    primary: '#5288c1', backgroundMain: '#0e1621', backgroundPanel: '#17212b', backgroundHeader: 'rgba(23, 33, 43, 0.75)',
    backgroundInput: '#0e1621', backgroundBubbleUser: 'linear-gradient(to bottom, #3a5f84, #1e3a55)', backgroundBubbleAdmin: 'linear-gradient(to bottom, #182533, #111a21)', textMain: '#ffffff',
    textMuted: '#707579', textLight: '#ffffff', border: 'rgba(82, 136, 193, 0.2)', unreadDot: '#5288c1', success: '#4dbb5f', marked: '#f9ab00',
    markedHighlight: 'rgba(82, 136, 193, 0.3)'
};

const COSMIC_RAY_COLORS: ThemeColors = {
    primary: '#4facfe',
    backgroundMain: '#0f0c29',
    backgroundPanel: '#1c1b3a',
    backgroundHeader: 'rgba(28, 27, 58, 0.75)',
    backgroundInput: '#0f0c29',
    backgroundBubbleUser: 'linear-gradient(to right, #4facfe, #00f2fe)',
    backgroundBubbleAdmin: 'linear-gradient(to right, #ff7e5f, #feb47b)',
    textMain: '#ffffff',
    textMuted: '#a2a2c2',
    textLight: '#000000',
    border: 'rgba(79, 172, 254, 0.2)',
    unreadDot: '#4facfe',
    success: '#00f2fe',
    marked: '#ff7e5f',
    markedHighlight: 'rgba(255, 126, 95, 0.3)'
};

const VIBRANT_GRADIENT_COLORS: ThemeColors = {
    primary: '#12c2e9', backgroundMain: '#0f2027', backgroundPanel: '#203a43', backgroundHeader: 'rgba(32, 58, 67, 0.75)',
    backgroundInput: '#0f2027', backgroundBubbleUser: 'linear-gradient(to right, #005c97, #363795)', backgroundBubbleAdmin: '#272727', textMain: '#ffffff',
    textMuted: '#bdc3c7', textLight: '#ffffff', border: 'rgba(18, 194, 233, 0.2)', unreadDot: '#12c2e9', success: '#64ffda', marked: '#f64f59',
    markedHighlight: 'rgba(246, 79, 89, 0.3)'
};

const GAME_OVER_COLORS: ThemeColors = {
    primary: '#ff0055', backgroundMain: '#0d0221', backgroundPanel: '#1d1d3a', backgroundHeader: 'rgba(29, 29, 58, 0.75)',
    backgroundInput: '#0d0221', backgroundBubbleUser: 'linear-gradient(to right, #ff0055, #ff6a00)', backgroundBubbleAdmin: '#240046', textMain: '#ffffff',
    textMuted: '#a2a2c2', textLight: '#ffffff', border: 'rgba(255, 0, 85, 0.2)', unreadDot: '#ff0055', success: '#00f5d4', marked: '#ff6a00',
    markedHighlight: 'rgba(255, 106, 0, 0.3)'
};

const PRESETS = [
    { name: 'Royal Dark', theme: { colors: ROYAL_DARK_COLORS } },
    { name: 'Telegram Animated', theme: { colors: TELEGRAM_NIGHT_COLORS, backgroundAnimationClass: 'telegram-animated-bg' } },
    { name: 'Cosmic Ray', theme: { colors: COSMIC_RAY_COLORS, backgroundAnimationClass: 'cosmic-ray-bg' } },
    { name: 'Game Over', theme: { colors: GAME_OVER_COLORS, chatBackgroundImageUrl: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ff0055' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` } }
];

const ColorPicker: React.FC<{ label: string; color: string; onChange: (color: string) => void }> = ({ label, color, onChange }) => (
    <div style={styles.colorPickerWrapper}>
        <label style={{fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{label}</label>
        <input type="color" value={color.startsWith('linear-gradient') ? '#ffffff' : color} onChange={(e) => onChange(e.target.value)} style={styles.colorInput} />
    </div>
);

const ThemePreview: React.FC<{ theme: Theme }> = React.memo(({ theme }) => {
    const styleVariables = useMemo(() => ({
        '--p-color-primary': theme.colors.primary, '--p-color-background-main': theme.colors.backgroundMain, '--p-color-background-panel': theme.colors.backgroundPanel,
        '--p-color-background-header': theme.colors.backgroundHeader, '--p-color-background-input': theme.colors.backgroundInput, '--p-color-background-bubble-user': theme.colors.backgroundBubbleUser,
        '--p-color-background-bubble-admin': theme.colors.backgroundBubbleAdmin, '--p-color-text-main': theme.colors.textMain, '--p-color-text-muted': theme.colors.textMuted,
        '--p-color-text-light': theme.colors.textLight, '--p-color-border': theme.colors.border, '--p-font-family': `'${theme.fontFamily || 'Poppins'}', sans-serif`,
        '--p-blur-effect': theme.blurEffectEnabled ? '10px' : '0px', '--p-background-chat-color': theme.chatBackgroundColor || 'transparent',
        '--p-background-chat-image': theme.chatBackgroundImageUrl || 'none', '--p-background-chat-opacity': String(theme.chatBackgroundImageOpacity ?? 0.1),
        '--p-message-corner-radius': `${theme.messageCornerRadius ?? 18}px`, '--p-message-text-size': `${theme.messageTextSize ?? 15}px`,
    } as React.CSSProperties), [theme]);

    return (
        <div style={{...styles.previewContainer, fontFamily: styleVariables['--p-font-family'], backgroundColor: styleVariables['--p-color-background-main']}}>
            <div style={{...styles.previewChat, background: styleVariables['--p-color-background-panel'], border: `1px solid ${styleVariables['--p-color-border']}`}}>
                <header style={{...styles.previewHeader, background: styleVariables['--p-color-background-header'], borderBottom: `1px solid ${styleVariables['--p-color-border']}`, backdropFilter: `blur(${styleVariables['--p-blur-effect']})`}}>
                    <h3 style={{color: styleVariables['--p-color-primary'], fontSize: '16px', margin: 0}}>Support Chat</h3>
                </header>
                <main style={{...styles.previewMessagesArea, background: styleVariables['--p-background-chat-color']}}>
                    <div style={{...styles.previewChatBg, backgroundImage: styleVariables['--p-background-chat-image'], opacity: styleVariables['--p-background-chat-opacity']}}></div>
                    <div style={{...styles.previewMessage, ...styles.previewAdminMessage}}>
                        <div style={{...styles.previewAvatar, background: styleVariables['--p-color-text-muted']}}><BotIcon style={{color: styleVariables['--p-color-background-panel']}} /></div>
                        <div style={{...styles.previewBubble, background: styleVariables['--p-color-background-bubble-admin'], color: styleVariables['--p-color-text-light'], borderRadius: styleVariables['--p-message-corner-radius']}}>
                           <p style={{...styles.previewMessageText, fontSize: styleVariables['--p-message-text-size']}}> Hello! How can I assist you today?</p>
                        </div>
                    </div>
                    <div style={{...styles.previewMessage, ...styles.previewUserMessage}}>
                        <div style={{...styles.previewBubble, background: styleVariables['--p-color-background-bubble-user'], color: styleVariables['--p-color-text-main'], borderRadius: styleVariables['--p-message-corner-radius']}}>
                            <p style={{...styles.previewMessageText, fontSize: styleVariables['--p-message-text-size']}}>I have a question about my account.</p>
                        </div>
                        <div style={{...styles.previewAvatar, background: styleVariables['--p-color-primary']}}><UserIcon style={{color: styleVariables['--p-color-text-light']}}/></div>
                    </div>
                </main>
                <footer style={{...styles.previewFooter, borderTop: `1px solid ${styleVariables['--p-color-border']}`}}>
                    <div style={{...styles.previewInput, background: styleVariables['--p-color-background-input']}}></div>
                    <div style={{...styles.previewSend, background: styleVariables['--p-color-primary']}}><SendIcon style={{color: styleVariables['--p-color-text-light']}} /></div>
                </footer>
            </div>
        </div>
    );
});

const ThemePresetThumbnail: React.FC<{ preset: any, isSelected: boolean, onClick: () => void }> = ({ preset, isSelected, onClick }) => {
    const bgStyle = preset.theme.backgroundAnimationClass ? {} : { background: preset.theme.colors.backgroundMain };
    return (
        <div style={styles.thumbnailOuter} onClick={onClick}>
            <div className={preset.theme.backgroundAnimationClass || ''} style={{...styles.thumbnail, ...bgStyle, border: isSelected ? `2px solid ${preset.theme.colors.primary}` : `2px solid var(--color-border)` }}>
                <div style={{...styles.thumbBubble, alignSelf: 'flex-end', background: preset.theme.colors.backgroundBubbleUser }}></div>
                <div style={{...styles.thumbBubble, alignSelf: 'flex-start', background: preset.theme.colors.backgroundBubbleAdmin }}></div>
            </div>
            <p style={{...styles.thumbnailLabel, color: isSelected ? preset.theme.colors.primary : 'var(--color-text-muted)'}}>{preset.name}</p>
        </div>
    );
};

interface ThemeEditorProps { initialTheme: Theme; apiKey: string; onSave: (newTheme: Theme) => void; onClose: () => void; }
const ThemeEditor: React.FC<ThemeEditorProps> = ({ initialTheme, apiKey, onSave, onClose }) => {
    const [theme, setTheme] = useState<Theme>(initialTheme);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [imageTarget, setImageTarget] = useState<'mainBg' | 'chatBg' | null>(null);
    const [advColorsOpen, setAdvColorsOpen] = useState(false);

    const handleUpdate = <K extends keyof Theme>(key: K, value: Theme[K] | number | boolean) => setTheme(prev => ({ ...prev, [key]: value as any }));
    const handleColorChange = (key: keyof ThemeColors, value: string) => setTheme(prev => ({ ...prev, mode: 'custom', colors: { ...prev.colors, [key]: value } }));
    const handleApplyPreset = (preset: {name: string, theme: Partial<Theme>}) => setTheme(prev => ({ ...prev, mode: preset.name.toLowerCase().replace(' ', '-'), ...preset.theme, ...(!preset.theme.backgroundAnimationClass && { backgroundImageUrl: '' }) }));

    const handleOpenImageModal = (target: 'mainBg' | 'chatBg') => {
        if (!apiKey) { alert("Please set the Media Upload API Key in General Settings to enable image uploads."); return; }
        setImageTarget(target); setIsImageModalOpen(true);
    };
    const handleImageSave = (url: string) => {
        if (imageTarget === 'mainBg') { handleUpdate('backgroundImageUrl', url); handleUpdate('backgroundAnimationClass', ''); } 
        else if (imageTarget === 'chatBg') { handleUpdate('chatBackgroundImageUrl', url); }
        setIsImageModalOpen(false);
    };

    const mainBgStyle = useMemo(() => theme.backgroundAnimationClass ? {} : { backgroundImage: theme.backgroundImageUrl ? `url(${theme.backgroundImageUrl})` : 'none', backgroundColor: theme.colors.backgroundMain, backgroundSize: 'cover', backgroundPosition: 'center' }, [theme.backgroundAnimationClass, theme.backgroundImageUrl, theme.colors.backgroundMain]);
    
    return (
        <div className="theme-editor-modal">
            <ImageUploadModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} onImageSave={handleImageSave} apiKey={apiKey} />
            <div className="theme-editor-container">
                <header className="theme-editor-header"><h2>Chat Settings</h2><div><button onClick={onClose}>Cancel</button><button className="save-btn" onClick={() => onSave(theme)}>Save Theme</button></div></header>
                <main className="theme-editor-main">
                    <div className="theme-editor-controls">
                        <div style={styles.controlSection}>
                            <div style={styles.formGroup}>
                                <label style={styles.sliderLabel}><span>Message text size</span><span>{theme.messageTextSize ?? 15}</span></label>
                                <input type="range" min="12" max="20" step="1" style={styles.slider} value={theme.messageTextSize ?? 15} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate('messageTextSize', parseInt(e.target.value, 10))}/>
                            </div>
                        </div>
                        <div style={styles.controlSection}>
                            <h4 style={styles.controlTitle}>Color Theme</h4>
                            <div style={styles.presetsContainer}>
                                {PRESETS.map(p => <ThemePresetThumbnail key={p.name} preset={p} isSelected={theme.mode === p.name.toLowerCase().replace(' ', '-')} onClick={() => handleApplyPreset(p)} />)}
                            </div>
                        </div>
                        <div style={styles.controlSection}>
                            <h4 style={styles.controlTitle}>Chat Background</h4>
                            <div style={styles.formGroup}>
                                <div style={styles.imageInputGroup}><input type="text" style={styles.input} value={theme.chatBackgroundImageUrl || ''} onChange={e => handleUpdate('chatBackgroundImageUrl', e.target.value)} placeholder="Image URL..." /><button style={styles.uploadButton} onClick={() => handleOpenImageModal('chatBg')}>Upload</button></div>
                            </div>
                             <div style={styles.formGroup}>
                                <label style={styles.sliderLabel}><span>Background Opacity</span><span>{Math.round((theme.chatBackgroundImageOpacity ?? 0.1) * 100)}%</span></label>
                                <input type="range" min="0" max="1" step="0.01" style={styles.slider} value={theme.chatBackgroundImageOpacity ?? 0.1} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate('chatBackgroundImageOpacity', parseFloat(e.target.value))}/>
                             </div>
                        </div>
                         <div style={styles.controlSection}>
                            <div style={styles.formGroup}>
                                <label style={styles.sliderLabel}><span>Message corners</span><span>{theme.messageCornerRadius ?? 18}</span></label>
                                <input type="range" min="0" max="25" step="1" style={styles.slider} value={theme.messageCornerRadius ?? 18} onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdate('messageCornerRadius', parseInt(e.target.value, 10))}/>
                            </div>
                        </div>
                         <div style={styles.controlSection}>
                             <button style={styles.collapsibleButton} onClick={() => setAdvColorsOpen(!advColorsOpen)}>Advanced Color Settings {advColorsOpen ? '▲' : '▼'}</button>
                             {advColorsOpen && <div style={styles.themeGrid}>{Object.entries(theme.colors).map(([key, value]) => (<ColorPicker key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} color={value} onChange={(color) => handleColorChange(key as keyof ThemeColors, color)} />))}</div>}
                         </div>
                    </div>
                    <div className={`theme-editor-preview ${theme.backgroundAnimationClass || ''}`} style={mainBgStyle}><ThemePreview theme={theme} /></div>
                </main>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    controlSection: { marginBottom: '16px', paddingTop: '16px', borderTop: `1px solid var(--color-border)` },
    controlTitle: { margin: '0 0 16px 0', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '14px' },
    formGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '8px', color: 'var(--color-text-muted)', fontSize: '14px' },
    sliderLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-text-main)', fontSize: '16px' },
    slider: { width: '100%' },
    input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '14px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    presetsContainer: { display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' },
    thumbnailOuter: { cursor: 'pointer', textAlign: 'center', flexShrink: 0 },
    thumbnail: { width: '80px', height: '120px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px', boxSizing: 'border-box', backgroundSize: 'cover', backgroundPosition: 'center', transition: 'border-color 0.2s' },
    thumbnailLabel: { margin: '8px 0 0 0', fontSize: '12px', transition: 'color 0.2s' },
    thumbBubble: { width: '60%', height: '18px', borderRadius: '8px' },
    imageInputGroup: { display: 'flex', gap: '10px' },
    uploadButton: { padding: '0 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', cursor: 'pointer' },
    collapsibleButton: { width: '100%', padding: '12px', background: 'none', border: 'none', color: 'var(--color-primary)', textAlign: 'left', fontSize: '16px', cursor: 'pointer' },
    themeGrid: { marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' },
    colorPickerWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-background-input)', padding: '6px', borderRadius: '6px', border: '1px solid var(--color-border)' },
    colorInput: { width: '20px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer' },
    previewContainer: { transition: 'all 0.3s ease', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    previewChat: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '380px', height: '100%', maxHeight: '650px', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', overflow: 'hidden', color: 'var(--p-color-text-main)' },
    previewHeader: { padding: '12px 16px', flexShrink: 0 },
    previewMessagesArea: { flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', overflow: 'hidden' },
    previewChatBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundSize: 'cover', backgroundPosition: 'center' },
    previewMessage: { display: 'flex', alignItems: 'flex-end', gap: '8px', maxWidth: '80%', zIndex: 1 },
    previewUserMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    previewAdminMessage: { alignSelf: 'flex-start' },
    previewAvatar: { width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    previewBubble: { padding: '1px', wordBreak: 'break-word' },
    previewMessageText: { margin: 0, padding: '8px 12px' },
    previewFooter: { display: 'flex', padding: '12px', gap: '10px', alignItems: 'center', flexShrink: 0 },
    previewInput: { flex: 1, height: '40px', borderRadius: '20px' },
    previewSend: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

export default ThemeEditor;