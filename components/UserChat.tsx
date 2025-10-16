
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { database, serverTimestamp } from '../firebase';
import { ref, onValue, off, push, update, set, get, increment, remove } from 'firebase/database';
import { User, Message, AppConfig } from '../types';
import { SendIcon, PowerIcon, UserIcon, CheckIcon, ReplyIcon, CloseIcon, PaperclipIcon, StarIcon, MenuIcon, TrashIcon, FrownIcon, MehIcon, SmileIcon, PinIcon } from './icons/Icons';
import { uploadFile } from '../utils/mediaUploader';
import { formatTimestamp } from '../utils/formatTimestamp';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮'];

const renderWithLinks = (text: string) => {
    if (!text) return <>{text}</>;

    // Regex for URLs (with protocol or www), emails, and common phone number formats.
    const linkRegex = /((?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*)|(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)|((?:\b\+?\d{1,3}[-.\s]*)?\(?\d{3}\)?[-.\s]*\d{3}[-.\s]*\d{4}\b)/g;

    const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, type: 'url' | 'email' | 'tel') => {
        e.preventDefault();
        if (type === 'url') {
            if (window.confirm(`You are about to navigate to an external link:\n\n${href}\n\nDo you want to continue?`)) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        } else {
            // For mailto: and tel:, let the browser/OS handle it directly without confirmation.
            window.location.href = href;
        }
    };
    
    // FIX: Replaced `JSX.Element` with `React.ReactElement` to resolve "Cannot find namespace 'JSX'" error.
    const elements: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    
    for (const match of text.matchAll(linkRegex)) {
        const [fullMatch, url, email, phone] = match;
        const matchIndex = match.index || 0;

        // Add the text before the match
        if (matchIndex > lastIndex) {
            elements.push(text.substring(lastIndex, matchIndex));
        }
        
        // FIX: Replaced `JSX.Element` with `React.ReactElement` to resolve "Cannot find namespace 'JSX'" error.
        let element: React.ReactElement;

        if (url) {
            const href = url.startsWith('www.') ? `http://${url}` : url;
            element = <a key={matchIndex} href={href} onClick={(e) => onLinkClick(e, href, 'url')} style={{ color: 'var(--color-link)', textDecoration: 'underline', cursor: 'pointer' }} target="_blank" rel="noopener noreferrer">{url}</a>;
        } else if (email) {
            const href = `mailto:${email}`;
            element = <a key={matchIndex} href={href} onClick={(e) => onLinkClick(e, href, 'email')} style={{ color: 'var(--color-link)', textDecoration: 'underline', cursor: 'pointer' }}>{email}</a>;
        } else if (phone && phone.replace(/\D/g, '').length >= 7) { // Basic validation for digit count
             const href = `tel:${phone.replace(/[^\d+]/g, '')}`;
             element = <a key={matchIndex} href={href} onClick={(e) => onLinkClick(e, href, 'tel')} style={{ color: 'var(--color-link)', textDecoration: 'underline', cursor: 'pointer' }}>{phone}</a>;
        } else {
             // This case should ideally not be hit with this regex structure, but as a fallback, treat it as plain text.
            elements.push(fullMatch);
            lastIndex = matchIndex + fullMatch.length;
            continue;
        }
        
        elements.push(element);
        lastIndex = matchIndex + fullMatch.length;
    }

    // Add any remaining text after the last match
    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
    }

    return <>{elements}</>;
};


interface UserChatProps {
    user: User;
    onLogout: () => void;
}

const UserChat: React.FC<UserChatProps> = ({ user, onLogout }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [appConfig, setAppConfig] = useState<Partial<AppConfig>>({});
    const [isAdminTyping, setIsAdminTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const observer = useRef<IntersectionObserver | null>(null);
    const [uploadError, setUploadError] = useState('');
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [liveUser, setLiveUser] = useState<User>(user);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Message | null>(null);
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

    const [imagePreview, setImagePreview] = useState<{ file: File, url: string } | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const stopTyping = useCallback(() => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
        const typingRef = ref(database, `typing_status/${user.id}/isUserTyping`);
        set(typingRef, false);
    }, [user.id]);

     useEffect(() => {
        const userRef = ref(database, `users/${user.id}`);
        const unsubscribeUser = onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                setLiveUser({ id: user.id, ...userData });
                if (userData.isClosed) {
                    const feedbackRef = ref(database, `feedback/${user.id}/${userData.lastActivity}`);
                    get(feedbackRef).then(feedbackSnap => {
                       setFeedbackSubmitted(feedbackSnap.exists());
                    });
                } else {
                    setFeedbackSubmitted(false);
                }
            }
        });

        const configRef = ref(database, 'app_config');
        const unsubscribeConfig = onValue(configRef, (snapshot) => {
            setAppConfig(snapshot.val() || { appName: 'Support Chat', agentName: 'Agent' });
        });
        
        const messagesRef = ref(database, `chats/${user.id}`);
        const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            const loadedMessages = data ? Object.entries(data)
                .filter(([key]) => key !== 'pinned')
                .map(([key, value]) => ({ id: key, ...(value as Message) }))
                .sort((a, b) => a.timestamp - b.timestamp) : [];
            setMessages(loadedMessages);
        });

        const typingRef = ref(database, `typing_status/${user.id}/isAdminTyping`);
        const unsubscribeTyping = onValue(typingRef, (snapshot) => {
            setIsAdminTyping(snapshot.val() === true);
        });

        window.addEventListener('beforeunload', stopTyping);
        
        return () => {
            off(userRef, 'value', unsubscribeUser);
            off(configRef, 'value', unsubscribeConfig);
            off(messagesRef, 'value', unsubscribeMessages);
            off(typingRef, 'value', unsubscribeTyping);
            stopTyping();
            window.removeEventListener('beforeunload', stopTyping);
        };
    }, [user.id, stopTyping]);
    
    // Effect for Pinned Messages
    useEffect(() => {
        const pinnedRef = ref(database, `chats/${user.id}/pinned`);
        const unsubscribe = onValue(pinnedRef, (snapshot) => {
            if (snapshot.exists()) {
                const pinnedIds = Object.keys(snapshot.val());
                const newPinnedMessages = messages
                    .filter(msg => pinnedIds.includes(msg.id))
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setPinnedMessages(newPinnedMessages);
                setCurrentPinnedIndex(0);
            } else {
                setPinnedMessages([]);
            }
        });
        return () => unsubscribe();
    }, [user.id, messages]);

    useEffect(() => {
        const updateUserActivity = () => {
             if (document.hasFocus()) {
                const userRef = ref(database, `users/${user.id}`);
                update(userRef, { lastActivity: serverTimestamp() });
             }
        };
        updateUserActivity();
        const intervalId = setInterval(updateUserActivity, 30 * 1000);
        window.addEventListener('focus', updateUserActivity);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', updateUserActivity);
        };
    }, [user.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isAdminTyping]);
    
    // Effect to clean up object URL on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview.url);
            }
        };
    }, [imagePreview]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const typingRef = ref(database, `typing_status/${user.id}/isUserTyping`);
        set(typingRef, true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => { set(typingRef, false); }, 2000);
    };

    const cancelImagePreview = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview.url);
        }
        setImagePreview(null);
        setUploadProgress(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const sendMessage = useCallback(async (text: string, mediaUrl?: string) => {
        const trimmedText = text.trim();
        if (!trimmedText && !mediaUrl) return;

        stopTyping();
        setUploadError('');

        const newMessageRef = push(ref(database, `chats/${user.id}`));
        const newMessageData: Omit<Message, 'id'> = {
            text: trimmedText,
            sender: 'user',
            timestamp: serverTimestamp() as any,
        };
        
        if (mediaUrl) {
            newMessageData.mediaUrl = mediaUrl;
            newMessageData.mediaType = 'image';
        }
        
        if (replyingTo) {
            newMessageData.replyTo = {
                messageId: replyingTo.id,
                messageText: replyingTo.text,
                senderName: replyingTo.sender === 'user' ? user.name : (appConfig.agentName || 'Agent'),
            };
        }

        try {
            const updates: { [key: string]: any } = {};
            updates[`/chats/${user.id}/${newMessageRef.key}`] = newMessageData;
            updates[`/users/${user.id}/lastActivity`] = serverTimestamp();
            updates[`/users/${user.id}/adminReadTimestamp`] = null;
            updates[`/users/${user.id}/unreadCount`] = increment(1);
            updates[`/users/${user.id}/isClosed`] = false;
            
            await update(ref(database), updates);

            setInput('');
            setReplyingTo(null);
            cancelImagePreview();
        } catch (error) { console.error('Failed to send message:', error); } 
    }, [user.id, user.name, replyingTo, appConfig.agentName, stopTyping]);

    const handleSend = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        if (isSending) return;
    
        if (imagePreview) {
            if (!appConfig.mediaUploadApiKey) {
                setUploadError('File uploads are not configured by the admin.');
                return;
            }
            setIsSending(true);
            setUploadProgress(0);
            try {
                const imageUrl = await uploadFile(
                    imagePreview.file,
                    appConfig.mediaUploadApiKey,
                    (progress) => setUploadProgress(progress)
                );
                await sendMessage(input.trim(), imageUrl);
            } catch (error) {
                setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
            } finally {
                setIsSending(false);
                setUploadProgress(null);
            }
        } else if (input.trim() !== '') {
            setIsSending(true);
            await sendMessage(input);
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!appConfig.mediaUploadsEnabled || liveUser.mediaUploadsEnabled === false) {
            setUploadError('File uploads have been disabled.');
            return;
        }
        if (!file.type.startsWith('image/')) {
            setUploadError('Only image files are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setUploadError('Image size cannot exceed 5MB.');
            return;
        }
        setUploadError('');
        setImagePreview({ file, url: URL.createObjectURL(file) });
    };
    
    useEffect(() => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageId = (entry.target as HTMLElement).dataset.messageId;
                    const message = messages.find(m => m.id === messageId);
                    if (message && message.sender === 'admin' && !message.readByUser) {
                        set(ref(database, `chats/${user.id}/${messageId}/readByUser`), true);
                    }
                }
            });
        }, { threshold: 0.8 });
        document.querySelectorAll('.admin-message-bubble').forEach(el => observer.current?.observe(el));
        return () => observer.current?.disconnect();
    }, [messages, user.id]);

    const handleReaction = (message: Message, emoji: string) => {
        const reactionsRef = ref(database, `chats/${user.id}/${message.id}/reactions`);
        get(reactionsRef).then(snapshot => {
            const currentReactions = snapshot.val() || {};
            const myId = user.id;
            const hadReaction = currentReactions[emoji]?.includes(myId);

            Object.keys(currentReactions).forEach(key => {
                currentReactions[key] = (currentReactions[key] || []).filter((id: string) => id !== myId);
                if (currentReactions[key].length === 0) delete currentReactions[key];
            });
            
            if (!hadReaction) {
                if (!currentReactions[emoji]) currentReactions[emoji] = [];
                currentReactions[emoji].push(myId);
            }
            set(reactionsRef, currentReactions);
        });
        setContextMenuMsg(null);
    };
    
    const handleReply = (message: Message) => {
        setReplyingTo(message);
        setContextMenuMsg(null);
    };
    
    const handleDeleteMessage = async () => {
        if (!showDeleteConfirm) return;
        try {
            await remove(ref(database, `chats/${user.id}/${showDeleteConfirm.id}`));
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error("Failed to delete message:", error);
            alert("Could not delete the message.");
        }
    };

    const handleReopenChat = () => {
        update(ref(database, `users/${user.id}`), { isClosed: false, lastActivity: serverTimestamp() });
        setFeedbackRating(0);
        setFeedbackComment('');
        setFeedbackSubmitted(false);
    };
    
    const handleFeedbackSubmit = () => {
        if (feedbackRating === 0) { alert("Please select a rating."); return; }
        set(ref(database, `feedback/${user.id}/${liveUser.lastActivity || Date.now()}`), {
            rating: feedbackRating,
            comment: feedbackComment,
            timestamp: serverTimestamp()
        }).then(() => setFeedbackSubmitted(true));
    };

    const handleReplyClick = (messageId: string) => {
        const element = document.getElementById(`message-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('temp-highlight');
            setTimeout(() => {
                element.classList.remove('temp-highlight');
            }, 1500);
        }
    };
    
    const handleSuggestionClick = async (suggestion: string) => {
        if(isSending) return;
        setIsSending(true);
        await sendMessage(suggestion);
        setIsSending(false);
    };

    const AdminAvatar = () => (
        appConfig.agentProfileImageUrl ?
            <img src={appConfig.agentProfileImageUrl} alt="Agent" style={{...styles.avatar, objectFit: 'cover'}} /> :
            <div style={{...styles.avatar, ...styles.adminAvatar}}><UserIcon/></div>
    );

    if (liveUser.isClosed) {
        return (
            <div style={styles.chatContainer} className="responsive-container">
                <header style={styles.header}>
                    <h3 style={styles.headerTitle}>{appConfig.appName || 'Support Chat'}</h3>
                    <button onClick={onLogout} style={styles.logoutButton} title="Logout"><PowerIcon height={20} width={20} /></button>
                </header>
                <div style={styles.feedbackContainer}>
                    {feedbackSubmitted ? (
                        <>
                            <h3 style={styles.feedbackTitle}>Thank you for your feedback!</h3>
                            <p style={styles.feedbackText}>We appreciate you taking the time to share your thoughts.</p>
                        </>
                    ) : (
                        <>
                            <h3 style={styles.feedbackTitle}>Chat Closed</h3>
                            <p style={styles.feedbackText}>How would you rate your support experience?</p>
                            <div style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star} onClick={() => setFeedbackRating(star)} style={styles.starButton}>
                                        <StarIcon fill={star <= feedbackRating ? 'var(--color-primary)' : 'none'} stroke={'var(--color-primary)'} width={32} height={32} />
                                    </button>
                                ))}
                            </div>
                            <div style={styles.feedbackSmileys}>
                                <FrownIcon style={{ ...styles.smiley, opacity: feedbackRating > 0 && feedbackRating < 3 ? 1 : 0.3, color: '#ff6b6b' }} />
                                <MehIcon style={{ ...styles.smiley, opacity: feedbackRating === 3 ? 1 : 0.3, color: '#ffc107' }} />
                                <SmileIcon style={{ ...styles.smiley, opacity: feedbackRating > 3 ? 1 : 0.3, color: '#28a745' }} />
                            </div>
                            <textarea
                                style={styles.feedbackTextarea}
                                placeholder="Tell us more... (optional)"
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value)}
                            />
                            <button onClick={handleFeedbackSubmit} style={styles.feedbackSubmitButton}>Submit Feedback</button>
                        </>
                    )}
                    <button onClick={handleReopenChat} style={styles.reopenButton}>Need more help? Start a new chat</button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.chatContainer} className="responsive-container">
            <header style={styles.header}>
                <div>
                    <h3 style={styles.headerTitle}>{appConfig.appName || 'Support Chat'}</h3>
                    <div style={styles.agentStatus}>
                        {isAdminTyping ? `${appConfig.agentName || 'Agent'} is typing...` : (appConfig.agentName || 'Agent')}
                    </div>
                </div>
                <button onClick={onLogout} style={styles.logoutButton} title="Logout"><PowerIcon height={20} width={20} /></button>
            </header>
            {pinnedMessages.length > 0 && (
                <div className="pinned-message-bar" onClick={() => handleReplyClick(pinnedMessages[currentPinnedIndex].id)}>
                    <PinIcon style={{ color: 'var(--color-primary)', flexShrink: 0 }} width={18} height={18}/>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <strong style={{ color: 'var(--color-primary)', fontSize: '13px' }}>Pinned Message</strong>
                        <p style={styles.pinnedText}>{pinnedMessages[currentPinnedIndex].text || 'Image'}</p>
                    </div>
                    {pinnedMessages.length > 1 && (
                        <div className="pinned-nav">
                            <button onClick={(e) => { e.stopPropagation(); setCurrentPinnedIndex(i => (i - 1 + pinnedMessages.length) % pinnedMessages.length) }}>{'<'}</button>
                            <span>{currentPinnedIndex + 1}/{pinnedMessages.length}</span>
                            <button onClick={(e) => { e.stopPropagation(); setCurrentPinnedIndex(i => (i + 1) % pinnedMessages.length) }}>{'>'}</button>
                        </div>
                    )}
                </div>
            )}
            <main style={styles.messagesArea} className="chat-background-container" onClick={() => contextMenuMsg && setContextMenuMsg(null)}>
                <div style={{...styles.chatBackground, backgroundImage: `var(--image-background-chat)`, opacity: `var(--opacity-background-chat)`}}></div>
                <div style={styles.chatContent}>
                    {messages.length === 0 && !isAdminTyping && (
                        <div style={styles.welcomeContainer}>
                            {appConfig.welcomeMessage && <p style={styles.welcomeMessageText}>{appConfig.welcomeMessage}</p>}
                            {appConfig.helpSuggestions && appConfig.helpSuggestions.length > 0 && (
                                <div style={styles.suggestionButtonsWrapper}>
                                    {appConfig.helpSuggestions.map((suggestion, index) => (
                                        <button key={index} style={styles.suggestionButton} onClick={() => handleSuggestionClick(suggestion)} disabled={isSending}>
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} id={`message-${msg.id}`} style={{ ...styles.messageWrapper, ...(msg.sender === 'user' ? styles.userMessage : styles.adminMessage) }} className={`message-container-hover ${msg.sender === 'admin' && !msg.readByUser ? 'persistent-highlight' : ''}`}>
                            <button className="message-menu-button" onClick={(e) => { e.stopPropagation(); setContextMenuMsg(msg); }}><MenuIcon height={16} width={16} /></button>
                            <div style={{...styles.avatar, ...(msg.sender === 'user' ? styles.userAvatar : {})}}>
                                {msg.sender === 'user' ? <UserIcon/> : <AdminAvatar />}
                            </div>
                            <div className={`message-content ${msg.sender === 'admin' ? 'admin-message-bubble' : ''}`} data-message-id={msg.id}>
                                {msg.replyTo && (
                                    <div style={styles.replyBox} onClick={() => handleReplyClick(msg.replyTo!.messageId)}>
                                        <strong>{msg.replyTo.senderName}</strong>
                                        <p style={styles.replyText}>{msg.replyTo.messageText || 'Image'}</p>
                                    </div>
                                )}
                                <div style={{...styles.messageBubble, ...(msg.sender === 'user' ? styles.userBubble : styles.adminBubble)}} className={msg.isHighlightedByAdmin ? 'highlighted-bubble' : ''}>
                                    {msg.mediaUrl && <img src={msg.mediaUrl} alt="uploaded content" style={styles.sentImage}/>}
                                    {msg.text && <p style={styles.messageText}>{renderWithLinks(msg.text)}</p>}
                                </div>
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                    <div style={styles.reactionsContainer}>
                                        {Object.entries(msg.reactions).map(([emoji, userIds]) => Array.isArray(userIds) && userIds.length > 0 && (
                                            <div key={emoji} style={styles.reactionBadge}>
                                                {emoji} {userIds.length}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={styles.messageInfo}>
                                     {msg.isHighlightedByAdmin && <StarIcon style={{ color: 'var(--color-marked)' }} width={14} height={14} />}
                                     {pinnedMessages.some(p => p.id === msg.id) && <PinIcon style={{ color: 'var(--color-text-muted)' }} width={12} height={12} />}
                                    <span style={styles.timestamp}>{formatTimestamp(msg.timestamp)}</span>
                                    {msg.editedAt && <span style={styles.editedIndicator}>(edited)</span>}
                                    {msg.sender === 'user' && (
                                        <span style={styles.ticks}>
                                            <CheckIcon style={{color: liveUser.adminReadTimestamp && liveUser.adminReadTimestamp > msg.timestamp ? 'var(--color-success)' : 'var(--color-text-muted)'}} />
                                            <CheckIcon style={{ marginLeft: '-10px', color: liveUser.adminReadTimestamp && liveUser.adminReadTimestamp > msg.timestamp ? 'var(--color-success)' : 'transparent' }} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                     {isAdminTyping && (
                        <div style={{ ...styles.messageWrapper, ...styles.adminMessage }}>
                            <div style={{...styles.avatar, ...styles.adminAvatar}}><AdminAvatar /></div>
                            <div style={{...styles.messageBubble, ...styles.adminBubble, ...styles.typingIndicator}}>
                                <span>.</span><span>.</span><span>.</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>
             {replyingTo && (
                <div style={styles.replyingToArea}>
                    <div>
                        <small>Replying to <strong>{replyingTo.sender === 'user' ? user.name : (appConfig.agentName || 'Agent')}</strong></small>
                        <p style={styles.replyingToText}>{replyingTo.text || 'Image'}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={styles.cancelReplyButton}><CloseIcon/></button>
                </div>
            )}
             {imagePreview && (
                <div style={styles.imagePreviewContainer}>
                    <img src={imagePreview.url} alt="preview" style={styles.previewImage}/>
                    <button onClick={cancelImagePreview} style={styles.cancelPreviewButton}><CloseIcon/></button>
                    {uploadProgress !== null && (
                        <div style={styles.progressOverlay}>
                            <div style={{...styles.progressBar, width: `${uploadProgress}%`}}></div>
                            <span style={styles.progressText}>{Math.round(uploadProgress)}%</span>
                        </div>
                    )}
                </div>
            )}
             {uploadError && <div style={styles.errorArea}>{uploadError}</div>}
            <div style={styles.inputArea} className="chat-input-area">
                 {!imagePreview && appConfig.mediaUploadsEnabled && liveUser.mediaUploadsEnabled !== false && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.attachButton} disabled={isSending}>
                        <PaperclipIcon />
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept="image/*"/>
                    </button>
                )}
                <textarea ref={textareaRef} rows={1} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Type a message..." style={styles.textarea} disabled={isSending} />
                <button type="button" onClick={handleSend} style={styles.sendButton} disabled={isSending || (input.trim() === '' && !imagePreview)}>
                    <SendIcon />
                </button>
            </div>

            {contextMenuMsg && (
                <div style={styles.contextMenuBackdrop} onClick={() => setContextMenuMsg(null)}>
                    <div style={styles.contextMenuSheet} onClick={e => e.stopPropagation()}>
                        <div style={styles.reactionPicker}>
                            {REACTION_EMOJIS.map(emoji => 
                                <button key={emoji} onClick={() => handleReaction(contextMenuMsg, emoji)} style={styles.reactionButton}>{emoji}</button>
                            )}
                        </div>
                        <ul style={styles.contextMenuSheetActions}>
                            <li style={styles.contextMenuItem} onClick={() => handleReply(contextMenuMsg)}>
                                <ReplyIcon width={20} height={20} /> Reply
                            </li>
                             {contextMenuMsg.sender === 'user' && (
                                <li style={{...styles.contextMenuItem, color: '#ff6b6b'}} onClick={() => { setContextMenuMsg(null); setShowDeleteConfirm(contextMenuMsg); }}>
                                    <TrashIcon width={20} height={20} /> Delete Message
                                </li>
                             )}
                        </ul>
                    </div>
                </div>
            )}
            
            {showDeleteConfirm && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <h3 style={styles.modalTitle}>Delete Message</h3>
                        <p style={styles.modalText}>Are you sure? This message will be permanently deleted.</p>
                        <div style={styles.modalActions}>
                            <button style={styles.modalButton} onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
                            <button style={{...styles.modalButton, ...styles.modalButtonDanger}} onClick={handleDeleteMessage}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

             <style>{`
                @keyframes typing-dot { 0% { transform: translateY(0); } 25% { transform: translateY(-3px); } 50% { transform: translateY(0); } }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .typing-indicator span { display: inline-block; animation: typing-dot 1.2s infinite ease-in-out; }
                .typing-indicator span:nth-of-type(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-of-type(3) { animation-delay: 0.4s; }
                .message-menu-button {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background: var(--color-background-input);
                    border: 1px solid var(--color-border);
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-muted);
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s;
                    z-index: 5;
                }
                .message-container-hover:hover .message-menu-button { opacity: 1; }
                .userMessage .message-menu-button { left: -12px; }
                .adminMessage .message-menu-button { right: -12px; }
             `}</style>
        </div>
    );
};

const multiLineEllipsis: React.CSSProperties = {
    margin: 0,
    fontSize: '13px',
    color: 'var(--color-text-muted)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
};

const pinnedTextEllipsis: React.CSSProperties = {
    ...multiLineEllipsis,
    WebkitLineClamp: 1,
    fontSize: '12px'
};

const styles: { [key: string]: React.CSSProperties } = {
    chatContainer: { display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '500px', height: '90vh', background: 'var(--color-background-panel)', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', overflow: 'hidden', border: '1px solid var(--color-border)', },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--color-background-header)', backdropFilter: 'blur(var(--blur-effect)) saturate(180%)', WebkitBackdropFilter: 'blur(var(--blur-effect)) saturate(180%)', borderBottom: '1px solid var(--color-border)', flexShrink: 0 },
    headerTitle: { margin: 0, color: 'var(--color-primary)', fontWeight: 500 },
    agentStatus: { color: 'var(--color-text-muted)', fontSize: '12px', marginTop: '4px', height: '14px' },
    logoutButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-primary)' },
    pinnedText: pinnedTextEllipsis,
    messagesArea: { 
        flex: 1, 
        position: 'relative',
        overflow: 'hidden', 
        backgroundColor: 'var(--color-background-chat)' 
    },
    chatBackground: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0,
    },
    chatContent: {
        position: 'relative',
        zIndex: 1,
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '4px',
        boxSizing: 'border-box',
    },
    welcomeContainer: { margin: 'auto', padding: '20px', textAlign: 'center', maxWidth: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    welcomeMessageText: { background: 'var(--color-background-input)', borderRadius: '12px', padding: '16px', color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.6, display: 'inline-block' },
    suggestionButtonsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' },
    suggestionButton: { padding: '10px 16px', borderRadius: '20px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', cursor: 'pointer', transition: 'background-color 0.2s ease' },
    messageWrapper: { display: 'flex', alignItems: 'flex-end', maxWidth: '80%', position: 'relative', gap: '10px' },
    userMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    adminMessage: { alignSelf: 'flex-start' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    userAvatar: { background: 'var(--color-primary)', color: 'var(--color-text-light)' },
    adminAvatar: { background: 'var(--color-text-muted)', color: 'var(--color-background-panel)', padding: 0, border: '1px solid var(--color-border)' },
    messageBubble: { borderRadius: 'var(--message-corner-radius, 18px)', color: 'var(--color-text-main)', wordBreak: 'break-word', position: 'relative' },
    adminBubble: { background: 'var(--color-background-bubble-admin)', color: 'var(--color-text-light)' },
    userBubble: { background: 'var(--color-background-bubble-user)' },
    messageText: { margin: 0, padding: '10px 14px', fontSize: 'var(--message-text-size, 15px)', whiteSpace: 'pre-wrap' },
    sentImage: { maxWidth: '100%', borderRadius: '16px', display: 'block', padding: '3px' },
    messageInfo: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '2px', paddingRight: '6px', gap: '8px' },
    timestamp: { color: 'var(--color-text-muted)', fontSize: '11px' },
    editedIndicator: { color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic' },
    replyBox: { padding: '8px 12px', margin: '4px 0 8px 0', borderLeft: '3px solid var(--color-primary)', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', cursor: 'pointer' },
    replyText: multiLineEllipsis,
    ticks: { display: 'inline-block', verticalAlign: 'bottom', height: '16px', color: 'var(--color-text-muted)' },
    reactionsContainer: { display: 'flex', gap: '4px', position: 'absolute', bottom: '-12px', left: '10px', zIndex: 2 },
    reactionBadge: { background: 'var(--color-background-input)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2px 6px', fontSize: '12px' },
    contextMenuBackdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', zIndex: 9, },
    contextMenuSheet: { position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--color-background-panel)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.3)', zIndex: 10, animation: 'slideUp 0.3s ease-out' },
    contextMenuSheetActions: { listStyle: 'none', margin: 0, padding: '8px 0 0 0', display: 'flex', flexDirection: 'column' },
    contextMenuItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', background: 'none', border: 'none', color: 'var(--color-text-main)', textAlign: 'left' },
    reactionPicker: { display: 'flex', gap: '8px', padding: '8px', borderRadius: '16px', borderBottom: '1px solid var(--color-border)', justifyContent: 'center' },
    reactionButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s' },
    replyingToArea: { padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    replyingToText: { ...multiLineEllipsis, maxWidth: '250px' },
    cancelReplyButton: { background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' },
    errorArea: { padding: '8px 16px', background: 'rgba(255, 50, 50, 0.2)', color: 'white', textAlign: 'center' },
    imagePreviewContainer: { padding: '8px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--color-border)', position: 'relative' },
    previewImage: { maxHeight: '80px', borderRadius: '8px' },
    cancelPreviewButton: { position: 'absolute', top: '12px', left: '20px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    progressOverlay: { position: 'absolute', top: '8px', left: '16px', height: '80px', width: 'auto', background: 'rgba(0,0,0,0.6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' },
    progressBar: { position: 'absolute', bottom: 0, left: 0, height: '4px', background: 'var(--color-primary)', borderRadius: '0 0 8px 8px', transition: 'width 0.1s' },
    progressText: { color: 'white', fontWeight: 500 },
    inputArea: { display: 'flex', padding: '16px', borderTop: '1px solid var(--color-border)', gap: '10px', alignItems: 'flex-end' },
    textarea: { flex: 1, padding: '12px 18px', borderRadius: '24px', border: '1px solid var(--color-border)', fontSize: '16px', outline: 'none', background: 'var(--color-background-input)', color: 'var(--color-text-main)', resize: 'none', overflowY: 'auto', maxHeight: '120px', fontFamily: 'inherit' },
    attachButton: { background: 'transparent', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 },
    sendButton: { background: 'var(--color-primary)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', cursor: 'pointer', transition: 'transform 0.2s', flexShrink: 0 },
    typingIndicator: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '10px 14px' },
    feedbackContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', gap: '16px' },
    feedbackTitle: { color: 'var(--color-primary)', margin: '0 0 8px 0' },
    feedbackText: { color: 'var(--color-text-muted)', margin: '0 0 16px 0', maxWidth: '300px' },
    starsContainer: { display: 'flex', gap: '8px' },
    starButton: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-primary)' },
    feedbackSmileys: { display: 'flex', gap: '24px', margin: '8px 0 16px 0', height: '40px', alignItems: 'center' },
    smiley: { width: '36px', height: '36px', transition: 'opacity 0.3s, transform 0.3s' },
    feedbackTextarea: { width: '100%', maxWidth: '350px', minHeight: '80px', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--color-border)', fontSize: '16px', outline: 'none', background: 'var(--color-background-input)', color: 'var(--color-text-main)' },
    feedbackSubmitButton: { background: 'var(--color-primary)', color: 'var(--color-text-light)', border: 'none', width: 'auto', borderRadius: '12px', padding: '12px 24px', height: 'auto', fontSize: '16px', fontWeight: 500, cursor: 'pointer' },
    reopenButton: { marginTop: '24px', background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-primary)', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: 'var(--color-background-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
    modalTitle: { margin: '0 0 8px 0', color: 'var(--color-primary)' },
    modalText: { margin: '0 0 24px 0', color: 'var(--color-text-muted)' },
    modalActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
    modalButton: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', fontSize: '16px', cursor: 'pointer' },
    modalButtonDanger: { background: '#d9534f', color: 'white', border: '1px solid #d9534f' },
};

export default UserChat;
