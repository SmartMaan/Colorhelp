import React, { useState, useRef, useEffect } from 'react';
import { uploadFile } from '../utils/mediaUploader';
import { PaperclipIcon } from './icons/Icons';

interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageSave: (url: string) => void;
    apiKey: string;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({ isOpen, onClose, onImageSave, apiKey }) => {
    const [tab, setTab] = useState<'upload' | 'url'>('upload');
    const [imageUrl, setImageUrl] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when modal is closed
            setTimeout(() => {
                setImageUrl('');
                setUploadError('');
                setIsUploading(false);
                setUploadProgress(0);
                setImagePreview(null);
                setFileToUpload(null);
            }, 300);
        }
    }, [isOpen]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setUploadError('Only image files are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setUploadError('Image size cannot exceed 5MB.');
            return;
        }
        setUploadError('');
        setImagePreview(URL.createObjectURL(file));
        setFileToUpload(file);
    };

    const handleUpload = async () => {
        if (!fileToUpload) return;
        setIsUploading(true);
        setUploadProgress(0);
        setUploadError('');
        try {
            const url = await uploadFile(fileToUpload, apiKey, setUploadProgress);
            onImageSave(url);
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleUrlSave = () => {
        if (imageUrl.trim()) {
            onImageSave(imageUrl.trim());
        } else {
            setUploadError('Please enter a valid URL.');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <h3 style={styles.modalTitle}>Set Image</h3>
                <div style={styles.tabContainer}>
                    <button style={{...styles.tabButton, ...(tab === 'upload' ? styles.activeTab : {})}} onClick={() => setTab('upload')}>Upload File</button>
                    <button style={{...styles.tabButton, ...(tab === 'url' ? styles.activeTab : {})}} onClick={() => setTab('url')}>From URL</button>
                </div>

                <div style={styles.tabContent}>
                    {tab === 'upload' ? (
                        <div style={styles.uploadArea}>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept="image/*" />
                            <button style={styles.fileSelectButton} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                <PaperclipIcon /> {fileToUpload ? fileToUpload.name : 'Choose Image'}
                            </button>
                            {imagePreview && <img src={imagePreview} alt="Preview" style={styles.imagePreview} />}
                            {isUploading && (
                                <div style={styles.progressBarContainer}>
                                    <div style={{...styles.progressBar, width: `${uploadProgress}%`}}></div>
                                </div>
                            )}
                            <button style={styles.saveButton} onClick={handleUpload} disabled={!fileToUpload || isUploading}>
                                {isUploading ? `Uploading ${Math.round(uploadProgress)}%...` : 'Upload & Save'}
                            </button>
                        </div>
                    ) : (
                        <div style={styles.urlArea}>
                            <input type="text" style={styles.input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" />
                             <button style={styles.saveButton} onClick={handleUrlSave}>Save Image URL</button>
                        </div>
                    )}
                </div>
                {uploadError && <p style={styles.errorText}>{uploadError}</p>}
                
                <div style={{...styles.modalActions, marginTop: '24px'}}>
                    <button style={styles.cancelButton} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: 'var(--color-background-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', width: '90%', maxWidth: '450px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column' },
    modalTitle: { margin: '0 0 16px 0', color: 'var(--color-primary)', textAlign: 'center' },
    tabContainer: { display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '20px' },
    tabButton: { flex: 1, background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: '12px', cursor: 'pointer', borderBottom: '2px solid transparent' },
    activeTab: { color: 'var(--color-primary)', borderBottom: '2px solid var(--color-primary)' },
    tabContent: { minHeight: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    uploadArea: { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    urlArea: { width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' },
    fileSelectButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '12px', borderRadius: '8px', border: '1px dashed var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', cursor: 'pointer' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    imagePreview: { maxHeight: '100px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain' },
    progressBarContainer: { width: '100%', height: '8px', background: 'var(--color-background-input)', borderRadius: '4px', overflow: 'hidden' },
    progressBar: { height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s' },
    saveButton: { width: '100%', padding: '14px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-text-light)', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
    errorText: { color: '#ff6b6b', fontSize: '14px', textAlign: 'center', marginTop: '12px' },
    modalActions: { display: 'flex', justifyContent: 'center' },
    cancelButton: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', fontSize: '16px', cursor: 'pointer' },
};
