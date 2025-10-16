import React, { useState, useEffect, useMemo } from 'react';
import { database } from '../firebase';
import { ref, get, remove } from 'firebase/database';
import { Feedback } from '../types';
import { StarIcon, TrashIcon, UserIcon } from './icons/Icons';

const FeedbackManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [feedbackToDelete, setFeedbackToDelete] = useState<Feedback | null>(null);

    useEffect(() => {
        const fetchFeedback = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [feedbackSnap, usersSnap] = await Promise.all([
                    get(ref(database, 'feedback')),
                    get(ref(database, 'users'))
                ]);

                const usersMap = usersSnap.exists() ? usersSnap.val() : {};
                
                if (!feedbackSnap.exists()) {
                    setFeedback([]);
                    return;
                }

                const allFeedback: Feedback[] = [];
                feedbackSnap.forEach(userFeedbackSnap => {
                    const userId = userFeedbackSnap.key;
                    userFeedbackSnap.forEach(feedbackItemSnap => {
                        const activityId = feedbackItemSnap.key;
                        const data = feedbackItemSnap.val();
                        allFeedback.push({
                            id: `${userId}_${activityId}`,
                            userId: userId || 'Unknown',
                            userName: usersMap[userId!]?.name || 'Unknown User',
                            rating: data.rating,
                            comment: data.comment,
                            timestamp: data.timestamp,
                        });
                    });
                });
                
                allFeedback.sort((a, b) => b.timestamp - a.timestamp);
                setFeedback(allFeedback);

            } catch (err) {
                console.error("Failed to fetch feedback:", err);
                setError("Could not load feedback data. Please check your database connection.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchFeedback();
    }, []);

    const handleConfirmDelete = async () => {
        if (!feedbackToDelete) return;
        const [userId, activityId] = feedbackToDelete.id.split('_');
        
        try {
            await remove(ref(database, `feedback/${userId}/${activityId}`));
            setFeedback(prev => prev.filter(f => f.id !== feedbackToDelete.id));
            setFeedbackToDelete(null); // Close modal on success
        } catch (err) {
            console.error("Failed to delete feedback:", err);
            alert("An error occurred while deleting feedback.");
        }
    };
    
    const filteredFeedback = useMemo(() => {
        if (!searchTerm) return feedback;
        const lowercasedFilter = searchTerm.toLowerCase();
        return feedback.filter(item =>
            (item.userName && item.userName.toLowerCase().includes(lowercasedFilter)) ||
            (item.comment && item.comment.toLowerCase().includes(lowercasedFilter)) ||
            item.userId.toLowerCase().includes(lowercasedFilter)
        );
    }, [feedback, searchTerm]);

    const RatingStars: React.FC<{ rating: number }> = ({ rating }) => (
        <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => (
                <StarIcon key={star} fill={star <= rating ? 'var(--color-primary)' : 'none'} stroke={'var(--color-primary)'} width={18} height={18} />
            ))}
        </div>
    );

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <button onClick={onBack} style={styles.backButton}>←</button>
                <h2 style={styles.title}>User Feedback</h2>
            </header>
            
            <div style={styles.searchBar}>
                <input
                    type="text"
                    placeholder="Search by user, comment, or ID..."
                    style={styles.input}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div style={styles.listContainer}>
                {isLoading ? (
                    <div style={styles.placeholder}>Loading feedback...</div>
                ) : error ? (
                    <div style={{...styles.placeholder, color: '#ff6b6b'}}>{error}</div>
                ) : filteredFeedback.length === 0 ? (
                    <div style={styles.placeholder}>No feedback found.</div>
                ) : (
                    <ul style={styles.list}>
                        {filteredFeedback.map(item => (
                            <li key={item.id} style={styles.listItem}>
                                <div style={styles.itemHeader}>
                                    <div style={styles.userInfo}>
                                        <UserIcon width={20} height={20} />
                                        <span>{item.userName} <small>({item.userId})</small></span>
                                    </div>
                                    <span style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                                <div style={styles.ratingContainer}>
                                    <RatingStars rating={item.rating} />
                                </div>
                                {item.comment && <p style={styles.comment}>{item.comment}</p>}
                                <div style={styles.itemFooter}>
                                    <button onClick={() => setFeedbackToDelete(item)} style={styles.deleteButton}>
                                        <TrashIcon width={16} height={16} /> Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {feedbackToDelete && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <h3 style={styles.modalTitle}>Delete Feedback</h3>
                        <p style={styles.modalText}>
                            Are you sure you want to delete the feedback from <strong>{feedbackToDelete.userName}</strong>? This action cannot be undone.
                        </p>
                        <div style={styles.modalActions}>
                            <button style={styles.modalButton} onClick={() => setFeedbackToDelete(null)}>Cancel</button>
                            <button style={{...styles.modalButton, ...styles.modalButtonDanger}} onClick={handleConfirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: { display: 'flex', flexDirection: 'column', height: '100%' },
    header: { padding: '16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-main)', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 },
    title: { margin: 0, color: 'var(--color-primary)', flex: 1, fontSize: '1.2em' },
    backButton: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-main)', fontSize: '24px' },
    searchBar: { padding: '16px', borderBottom: '1px solid var(--color-border)' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '16px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    listContainer: { flex: 1, overflowY: 'auto' },
    placeholder: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', padding: '24px', textAlign: 'center' },
    list: { listStyle: 'none', margin: 0, padding: '16px' },
    listItem: { background: 'var(--color-background-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '16px' },
    itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    userInfo: { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-main)', fontWeight: 500 },
    timestamp: { fontSize: '12px', color: 'var(--color-text-muted)' },
    ratingContainer: { marginBottom: '12px' },
    comment: { margin: '0 0 16px 0', color: 'var(--color-text-main)', background: 'var(--color-background-input)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' },
    itemFooter: { display: 'flex', justifyContent: 'flex-end' },
    deleteButton: { background: 'none', border: '1px solid #d9534f', color: '#d9534f', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: 'var(--color-background-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
    modalTitle: { margin: '0 0 8px 0', color: 'var(--color-primary)' },
    modalText: { margin: '0 0 24px 0', color: 'var(--color-text-muted)', lineHeight: 1.5 },
    modalActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
    modalButton: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', fontSize: '16px', cursor: 'pointer' },
    modalButtonDanger: { background: '#d9534f', color: 'white', border: '1px solid #d9534f' },
};

export default FeedbackManager;