
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { database, serverTimestamp } from '../firebase';
import { ref, onValue, off, push, update, set, remove, get } from 'firebase/database';
import { User, Message, AppConfig } from '../types';
import { SendIcon, BotIcon, UserIcon, CheckIcon, ReplyIcon, CloseIcon, PaperclipIcon, MenuIcon, TrashIcon, EditIcon, MailIcon, InfoIcon, ArchiveIcon, BroomIcon, UserXIcon, SparklesIcon, PinIcon, StarIcon } from './icons/Icons';
import { uploadFile } from '../utils/mediaUploader';
import { formatTimestamp } from '../utils/formatTimestamp';
import { GoogleGenAI, Type } from "@google/genai";

interface AdminChatViewProps {
    user: User;
    onDeselect: () => void;
    onBack: () => void;
}
const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes
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

const AdminChatView: React.FC<AdminChatViewProps> = ({ user, onDeselect, onBack }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isUserTyping, setIsUserTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [appConfig, setAppConfig] = useState<Partial<AppConfig>>({});
    const [uploadError, setUploadError] = useState('');
    const [liveUser, setLiveUser] = useState<User>(user);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    const [contextMenuMsg, setContextMenuMsg] = useState<Message | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
    const [confirmation, setConfirmation] = useState<{ title: string; text: string; onConfirm: () => Promise<void>; danger?: boolean } | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [initialReadTimestamp, setInitialReadTimestamp] = useState(0);
    const prevMessagesRef = useRef<Message[]>([]);
    const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

    const [imagePreview, setImagePreview] = useState<{ file: File, url: string } | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const stopTyping = useCallback(() => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        set(ref(database, `typing_status/${user.id}/isAdminTyping`), false);
    }, [user.id]);

    useEffect(() => {
        const configRef = ref(database, 'app_config');
        const onConfigChange = onValue(configRef, (snapshot) => setAppConfig(snapshot.val() || {}));
        
        const userRef = ref(database, `users/${user.id}`);
        get(userRef).then((snapshot) => {
            if (snapshot.exists()) {
                setInitialReadTimestamp(snapshot.val().adminReadTimestamp || 0);
            }
        });
        const onUserChange = onValue(userRef, (snapshot) => setLiveUser(snapshot.val() || user));
        if (!user.isClosed) {
            update(userRef, { adminReadTimestamp: serverTimestamp(), unreadCount: 0 });
        }
        
        const messagesRef = ref(database, `chats/${user.id}`);
        const onMessagesChange = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val();
            const loadedMessages = data ? Object.entries(data)
                .filter(([key]) => key !== 'pinned')
                .map(([key, value]) => ({ id: key, ...(value as Message) }))
                .sort((a, b) => a.timestamp - b.timestamp) : [];
            setMessages(loadedMessages);
        });

        const typingRef = ref(database, `typing_status/${user.id}/isUserTyping`);
        const onTypingChange = onValue(typingRef, (snapshot) => setIsUserTyping(snapshot.val() === true));

        window.addEventListener('beforeunload', stopTyping);
        
        return () => {
            off(configRef, 'value', onConfigChange);
            off(userRef, 'value', onUserChange);
            off(messagesRef, 'value', onMessagesChange);
            off(typingRef, 'value', onTypingChange);
            stopTyping();
            window.removeEventListener('beforeunload', stopTyping);
        };
    }, [user.id, user.isClosed, stopTyping]);

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
        // Cleanup object URL on component unmount
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview.url);
            }
        };
    }, [imagePreview]);

    const generateSuggestions = useCallback(async () => {
        if (isGeneratingSuggestions) return;
        setIsGeneratingSuggestions(true);
        setSuggestedReplies([]);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const history = messages
                .slice(-10)
                .map(m => `${m.sender === 'user' ? user.name : 'Agent'}: ${m.text || '(media)'}`)
                .join('\n');
    
            const prompt = `Based on this support chat history, suggest 3 short, professional replies for the Agent.
    Return ONLY a JSON object with a "suggestions" key containing an array of strings. For example: {"suggestions": ["First reply.", "Second reply."]}.
    
    Chat History:
    ${history}`;
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            suggestions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ['suggestions']
                    }
                }
            });
            
            const jsonText = response.text.trim();
            const parsed = JSON.parse(jsonText);
            if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
                setSuggestedReplies(parsed.suggestions.slice(0, 3));
            }
        } catch (e) {
            console.error("Error generating suggestions:", e);
        } finally {
            setIsGeneratingSuggestions(false);
        }
    }, [messages, user.name, isGeneratingSuggestions]);

    useEffect(() => {
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const lastMessageIsNew = lastMessage && !prevMessagesRef.current.find(m => m.id === lastMessage.id);

        if (lastMessage && lastMessage.sender === 'user' && lastMessageIsNew) {
            // NOTE: Automatic suggestions are disabled per user request. They are now manual-only.
            // generateSuggestions(); 
        }
        prevMessagesRef.current = messages;
    }, [messages, generateSuggestions]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    useEffect(() => {
        if (editingMessage) {
            setInput(editingMessage.text);
            textareaRef.current?.focus();
        } else {
            setInput('');
        }
    }, [editingMessage]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isUserTyping]);
    
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

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (suggestedReplies.length > 0) setSuggestedReplies([]);
        if (editingMessage) return;
        set(ref(database, `typing_status/${user.id}/isAdminTyping`), true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(stopTyping, 2000);
    };

    const sendMessage = useCallback(async (text: string, mediaUrl?: string) => {
        const trimmedText = text.trim();
        if (!trimmedText && !mediaUrl) return;
        stopTyping();
        setUploadError('');
        setSuggestedReplies([]);

        const newMessageRef = push(ref(database, `chats/${user.id}`));
        const newMessageData: Omit<Message, 'id'> = {
            text: trimmedText, sender: 'admin', timestamp: serverTimestamp() as any, readByUser: false
        };
        if (mediaUrl) { newMessageData.mediaUrl = mediaUrl; newMessageData.mediaType = 'image'; }
        if (replyingTo) {
            newMessageData.replyTo = {
                messageId: replyingTo.id, messageText: replyingTo.text, senderName: replyingTo.sender === 'user' ? user.name : (appConfig.agentName || 'Admin'),
            };
        }
        try {
            await set(newMessageRef, newMessageData);
            await update(ref(database, `users/${user.id}`), { lastActivity: serverTimestamp() });
            setInput('');
            setReplyingTo(null);
            cancelImagePreview();
        } catch (error) { console.error('Failed to send admin message:', error); } 
    }, [user.id, user.name, replyingTo, stopTyping, appConfig.agentName]);

    const handleUpdateMessage = async () => {
        if (!editingMessage || !input.trim()) return;
        setIsSending(true);
        try {
            await update(ref(database, `chats/${user.id}/${editingMessage.id}`), { text: input.trim(), editedAt: serverTimestamp() });
            setEditingMessage(null);
        } catch (error) { console.error('Failed to update message:', error); } 
        finally { setIsSending(false); }
    };

    const handleSend = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        if (isSending || liveUser?.isClosed) return;
    
        if (editingMessage) {
            await handleUpdateMessage();
            return;
        }
    
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
        if (e.key === 'Escape') { setEditingMessage(null); setReplyingTo(null); cancelImagePreview(); }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!appConfig.mediaUploadsEnabled) {
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
    
    const isOnline = (u: User) => u && u.lastActivity && (Date.now() - u.lastActivity < ONLINE_THRESHOLD);

    const handleDeleteUser = async () => {
        setIsActionLoading(true);
        try {
            const updates: { [key: string]: null } = {
                [`/users/${user.id}`]: null,
                [`/chats/${user.id}`]: null,
                [`/typing_status/${user.id}`]: null,
                [`/feedback/${user.id}`]: null,
            };
            await update(ref(database), updates);
            setConfirmation(null);
            onDeselect();
        } catch (error) {
            console.error("Action failed:", error);
            alert("An error occurred while deleting the user.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleClearChat = async () => {
        setIsActionLoading(true);
        try {
            await remove(ref(database, `chats/${user.id}`));
            setConfirmation(null);
        } catch (error) {
            console.error("Action failed:", error);
            alert("An error occurred while clearing the chat.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCloseChat = async () => {
        setIsActionLoading(true);
        try {
            await update(ref(database, `users/${user.id}`), { isClosed: true, lastActivity: serverTimestamp() });
            setConfirmation(null);
        } catch (error) {
            console.error("Action failed:", error);
            alert("An error occurred while closing the chat.");
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleToggleMedia = () => {
        // default is enabled (true), so toggle to false if it's currently undefined or true
        const newStatus = liveUser.mediaUploadsEnabled === false; // toggles false to true, and (true | undefined) to false
        update(ref(database, `users/${user.id}`), { mediaUploadsEnabled: newStatus });
    };

    const handleMarkUnread = async () => {
        setContextMenuMsg(null);
        try {
            await update(ref(database, `users/${user.id}`), { unreadCount: 1, adminReadTimestamp: null });
        } catch (error) {
            console.error("Failed to mark as unread:", error);
            alert("Could not mark as unread.");
        }
    };

    const confirmDeleteMessage = async () => {
        if (!showDeleteConfirm) return;
        try {
            await remove(ref(database, `chats/${user.id}/${showDeleteConfirm}`));
        } catch (error) {
            console.error("Failed to delete message:", error);
            alert("Could not delete the message.");
        } finally {
            setShowDeleteConfirm(null);
        }
    };
    
    const handleReaction = (message: Message, emoji: string) => {
        const reactionsRef = ref(database, `chats/${user.id}/${message.id}/reactions`);
        get(reactionsRef).then(snapshot => {
            const currentReactions = snapshot.val() || {};
            const myId = 'admin'; // Admin's ID for reactions
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

    const handleEdit = (message: Message) => {
        setEditingMessage(message);
        setContextMenuMsg(null);
    };

    const handlePinMessage = async (message: Message) => {
        const pinRef = ref(database, `chats/${user.id}/pinned/${message.id}`);
        const isPinned = pinnedMessages.some(p => p.id === message.id);
        try {
            if (isPinned) {
                await remove(pinRef);
            } else {
                await set(pinRef, true);
            }
            setContextMenuMsg(null);
        } catch (e) { console.error("Pinning failed", e); }
    };
    
    const handleHighlightMessage = async (message: Message) => {
        const msgRef = ref(database, `chats/${user.id}/${message.id}`);
        try {
            await update(msgRef, { isHighlightedByAdmin: !message.isHighlightedByAdmin });
            setContextMenuMsg(null);
        } catch (e) { console.error("Highlighting failed", e); }
    };

    const formatDate = (timestamp: number | undefined) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    }
    
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

    const handleSuggestionClick = (reply: string) => {
        setInput(reply);
        setSuggestedReplies([]);
        textareaRef.current?.focus();
    };

    const AdminAvatar = () => (
        appConfig.agentProfileImageUrl ?
            <img src={appConfig.agentProfileImageUrl} alt="Agent" style={{...styles.avatar, objectFit: 'cover'}} /> :
            <div style={{...styles.avatar, ...styles.adminAvatar}}><BotIcon/></div>
    );
    
    const isUserOnlineForDeletion = isOnline(liveUser);

    return (
        <div style={styles.chatContainer}>
            <header style={styles.header}>
                <button onClick={onBack} style={styles.backButton} className="mobile-back-button">←</button>
                <div style={styles.headerInfo}>
                    <h3 style={styles.headerTitle}>Chat with {user.name}</h3>
                    <p style={styles.headerStatus}>{isUserTyping ? 'typing...' : (isOnline(liveUser) ? 'Online' : 'Offline')}</p>
                </div>
                <div style={styles.headerActions}>
                     <button onClick={() => setIsProfileModalOpen(true)} style={styles.menuButton} title="User Info"><InfoIcon/></button>
                     <button onClick={() => setIsActionsModalOpen(true)} style={styles.menuButton}><MenuIcon/></button>
                </div>
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
            <main style={styles.messagesArea} className="chat-background-container">
                <div style={{...styles.chatBackground, backgroundImage: `var(--image-background-chat)`, opacity: `var(--opacity-background-chat)`}}></div>
                <div style={styles.chatContent}>
                     {messages.length === 0 && !isUserTyping && appConfig.welcomeMessage ? (
                        <div style={styles.welcomeMessageContainer}>
                            <p style={styles.welcomeMessageText}>{appConfig.welcomeMessage}</p>
                        </div>
                    ) : messages.length === 0 && !isUserTyping && (
                        <div style={styles.placeholder}>No messages yet.</div>
                    )}
                    {messages.map(msg => (
                        <div key={msg.id} id={`message-${msg.id}`} style={{ ...styles.messageWrapper, ...(msg.sender === 'admin' ? styles.adminMessage : styles.userMessage) }} className={`message-container-hover ${msg.sender === 'user' && initialReadTimestamp > 0 && msg.timestamp > initialReadTimestamp ? 'persistent-highlight' : ''}`}>
                             <button className="message-menu-button" onClick={(e) => { e.stopPropagation(); setContextMenuMsg(msg); }}><MenuIcon height={16} width={16} /></button>
                            <div style={{...styles.avatar, ...(msg.sender === 'admin' ? styles.adminAvatar : styles.userAvatar)}}>
                                {msg.sender === 'admin' ? <AdminAvatar /> : <UserIcon/>}
                            </div>
                            <div className="message-content">
                                {msg.replyTo && ( <div style={styles.replyBox} onClick={() => handleReplyClick(msg.replyTo!.messageId)}><strong>{msg.replyTo.senderName}</strong><p style={styles.replyText}>{msg.replyTo.messageText || 'Image'}</p></div> )}
                                <div style={{...styles.messageBubble, ...(msg.sender === 'admin' ? styles.adminBubble : styles.userBubble)}} className={msg.isHighlightedByAdmin ? 'highlighted-bubble' : ''}>
                                    {msg.mediaUrl && <img src={msg.mediaUrl} alt="uploaded" style={styles.sentImage}/>}
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
                                    {msg.sender === 'admin' && (
                                        <span style={styles.ticks}>
                                            <CheckIcon style={{color: msg.readByUser ? 'var(--color-success)' : 'var(--color-text-muted)'}} />
                                            <CheckIcon style={{ marginLeft: '-10px', color: msg.readByUser ? 'var(--color-success)' : 'transparent' }} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isUserTyping && (
                        <div style={{ ...styles.messageWrapper, ...styles.userMessage }}>
                            <div style={{ ...styles.avatar, ...styles.userAvatar }}><UserIcon /></div>
                            <div style={{...styles.messageBubble, ...styles.userBubble, ...styles.typingIndicator}}>
                                <span>.</span><span>.</span><span>.</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>
            <footer style={{ position: 'relative', flexShrink: 0 }}>
                <div style={styles.suggestionsWrapper}>
                    {isGeneratingSuggestions && <div style={styles.suggestionsLoading}>✨ Generating...</div>}
                    {!isGeneratingSuggestions && suggestedReplies.length > 0 && (
                        <div style={styles.suggestionsContainer}>
                            {suggestedReplies.map((reply, index) => (
                                <button key={index} style={styles.suggestionButton} onClick={() => handleSuggestionClick(reply)}>
                                    {reply}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {(replyingTo || editingMessage) && (
                    <div style={styles.replyingToArea}>
                        <div>
                            <small>{editingMessage ? 'Editing Message' : `Replying to ${replyingTo?.sender === 'user' ? user.name : 'You'}`}</small>
                            <p style={styles.replyingToText}>{editingMessage?.text || replyingTo?.text || 'Image'}</p>
                        </div>
                        <button onClick={() => { setReplyingTo(null); setEditingMessage(null); }} style={styles.cancelReplyButton}><CloseIcon/></button>
                    </div>
                )}
                {!editingMessage && imagePreview && (
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
                    {!editingMessage && (
                        <>
                            {!input.trim() && !imagePreview && appConfig.aiSuggestionsEnabled && (
                                <button type="button" onClick={generateSuggestions} style={styles.attachButton} disabled={isSending || liveUser?.isClosed || isGeneratingSuggestions} title="Generate AI Suggestions">
                                    <SparklesIcon />
                                </button>
                            )}
                            {!imagePreview && appConfig.mediaUploadsEnabled && ( 
                                <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.attachButton} disabled={isSending || liveUser?.isClosed}>
                                    <PaperclipIcon />
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} accept="image/*"/>
                                </button> 
                            )}
                        </>
                    )}
                    <textarea ref={textareaRef} rows={1} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={liveUser?.isClosed ? "This chat has been closed" : "Reply to user..."} style={styles.textarea} disabled={isSending || liveUser?.isClosed} />
                    <button type="button" onClick={handleSend} style={styles.sendButton} disabled={isSending || (input.trim() === '' && !imagePreview) || liveUser?.isClosed}>
                        {editingMessage ? <CheckIcon /> : <SendIcon />}
                    </button>
                </div>
            </footer>
            
            {contextMenuMsg && (
                <div style={styles.contextMenuBackdrop} onClick={() => setContextMenuMsg(null)}>
                    <div style={styles.contextMenuSheet} onClick={e => e.stopPropagation()}>
                        <div style={styles.reactionPicker}>
                            {REACTION_EMOJIS.map(emoji => 
                                <button key={emoji} onClick={() => handleReaction(contextMenuMsg, emoji)} style={styles.reactionButton}>{emoji}</button>
                            )}
                        </div>
                        <ul style={styles.contextMenuSheetActions}>
                            <li style={styles.contextMenuItem} onClick={() => handleReply(contextMenuMsg)}><ReplyIcon width={20} height={20} /> Reply</li>
                            <li style={styles.contextMenuItem} onClick={() => handlePinMessage(contextMenuMsg)}><PinIcon width={20} height={20} /> {pinnedMessages.some(p => p.id === contextMenuMsg.id) ? 'Unpin' : 'Pin'} Message</li>
                            <li style={styles.contextMenuItem} onClick={() => handleHighlightMessage(contextMenuMsg)}><StarIcon width={20} height={20} /> {contextMenuMsg.isHighlightedByAdmin ? 'Remove Highlight' : 'Highlight'}</li>
                            <li style={styles.contextMenuItem} onClick={handleMarkUnread}><MailIcon width={20} height={20}/> Mark as Unread</li>
                            {contextMenuMsg.sender === 'admin' && (
                                <li style={styles.contextMenuItem} onClick={() => handleEdit(contextMenuMsg)}><EditIcon width={20} height={20} /> Edit</li>
                            )}
                            <li style={{...styles.contextMenuItem, color: '#ff6b6b'}} onClick={() => { setContextMenuMsg(null); setShowDeleteConfirm(contextMenuMsg.id); }}>
                                <TrashIcon width={20} height={20} /> Delete Message
                            </li>
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
                            <button style={{...styles.modalButton, ...styles.modalButtonDanger}} onClick={confirmDeleteMessage}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {isProfileModalOpen && (
                 <div style={styles.modalOverlay} onClick={() => setIsProfileModalOpen(false)}>
                    <div style={{...styles.modalContent, textAlign: 'left'}} onClick={e => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>{user.name}'s Profile</h3>
                        <div style={styles.profileDetails}>
                            <p><strong>Email:</strong> {user.email || 'Not provided'}</p>
                            <p><strong>Phone:</strong> {user.phone || 'Not provided'}</p>
                            <p><strong>Website:</strong> {user.website ? <a href={user.website} onClick={(e) => { e.preventDefault(); if(window.confirm(`Navigate to ${user.website}?`)) window.open(user.website, '_blank', 'noopener,noreferrer') }} style={{color: 'var(--color-primary)'}}>{user.website}</a> : 'Not provided'}</p>
                            <p><strong>Joined:</strong> {formatDate(user.createdAt)}</p>
                            <p><strong>Last Active:</strong> {formatDate(user.lastActivity)}</p>
                        </div>
                        <div style={{...styles.modalActions, marginTop: '24px'}}>
                            <button style={styles.modalButton} onClick={() => setIsProfileModalOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {isActionsModalOpen && (
                <div style={styles.modalOverlay} onClick={() => setIsActionsModalOpen(false)}>
                    <div style={styles.actionsModalContent} onClick={e => e.stopPropagation()}>
                        <h3 style={{...styles.modalTitle, marginBottom: '24px'}}>Chat Actions</h3>
                        
                        {appConfig.mediaUploadsEnabled && (
                            <div style={styles.actionItem}>
                                <PaperclipIcon style={styles.actionIcon} />
                                <div>
                                    <p style={styles.actionTitle}>Allow Media Uploads</p>
                                    <small style={styles.actionDescription}>Allow this user to upload images.</small>
                                </div>
                                <label className="toggle-switch" style={{marginLeft: 'auto'}}>
                                    <input type="checkbox" checked={liveUser.mediaUploadsEnabled !== false} onChange={handleToggleMedia} disabled={isActionLoading} />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        )}

                        <button style={styles.actionItem} onClick={() => { setIsActionsModalOpen(false); setConfirmation({ title: 'Close Chat', text: 'Are you sure you want to close this chat? The user will be prompted for feedback.', onConfirm: handleCloseChat }); }} disabled={liveUser.isClosed || isActionLoading}>
                            <ArchiveIcon style={styles.actionIcon} />
                            <div>
                                <p style={styles.actionTitle}>Close Chat</p>
                                <small style={styles.actionDescription}>End conversation and request user feedback.</small>
                            </div>
                        </button>
                        
                        <button style={styles.actionItem} onClick={() => { setIsActionsModalOpen(false); setConfirmation({ title: 'Clear History', text: 'Are you sure you want to delete all messages in this chat? This cannot be undone.', onConfirm: handleClearChat }); }} disabled={isActionLoading}>
                            <BroomIcon style={styles.actionIcon} />
                            <div>
                                <p style={styles.actionTitle}>Clear History</p>
                                <small style={styles.actionDescription}>Permanently delete all messages in this chat.</small>
                            </div>
                        </button>

                        <button style={{...styles.actionItem, ...styles.actionItemDanger}} onClick={() => { if (!isUserOnlineForDeletion) { setIsActionsModalOpen(false); setConfirmation({ title: 'Delete User', text: 'This will PERMANENTLY delete the user and all their chats and data. This action cannot be undone. Are you sure?', onConfirm: handleDeleteUser, danger: true }); } }} disabled={isActionLoading || isUserOnlineForDeletion}>
                            <UserXIcon style={styles.actionIcon} />
                            <div>
                                <p style={styles.actionTitle}>Delete User</p>
                                <small style={styles.actionDescription}>
                                    {isUserOnlineForDeletion ? "Cannot delete a user who is currently online." : "Permanently delete this user and all their data."}
                                </small>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {confirmation && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <h3 style={styles.modalTitle}>{confirmation.title}</h3>
                        <p style={styles.modalText}>{confirmation.text}</p>
                        <div style={styles.modalActions}>
                            <button style={styles.modalButton} onClick={() => setConfirmation(null)} disabled={isActionLoading}>Cancel</button>
                            <button
                                style={{...styles.modalButton, ...(confirmation.danger ? styles.modalButtonDanger : {})}}
                                onClick={confirmation.onConfirm}
                                disabled={isActionLoading}
                            >
                                {isActionLoading ? 'Processing...' : 'Confirm'}
                            </button>
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
                .userMessage .message-menu-button { right: -12px; }
                .adminMessage .message-menu-button { left: -12px; }
                .toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-background-input); transition: .4s; border-radius: 28px; border: 1px solid var(--color-border); }
                .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: var(--color-text-muted); transition: .4s; border-radius: 50%; }
                .toggle-switch input:checked + .slider { background-color: var(--color-primary); }
                .toggle-switch input:checked + .slider:before { transform: translateX(20px); background-color: var(--color-text-light); }
                .actionItem:disabled { opacity: 0.6; cursor: not-allowed; }
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
    chatContainer: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-background-panel)' },
    header: { padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-background-header)', backdropFilter: 'blur(var(--blur-effect)) saturate(180%)', WebkitBackdropFilter: 'blur(var(--blur-effect)) saturate(180%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
    headerInfo: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    headerTitle: { margin: 0, color: 'var(--color-text-main)', fontWeight: 500, fontSize: '1.1em' },
    headerStatus: { margin: '2px 0 0 0', color: 'var(--color-primary)', fontSize: '0.8em', height: '14px' },
    headerActions: { position: 'relative', display: 'flex', alignItems: 'center' },
    backButton: { display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-main)', fontSize: '24px', marginRight: '16px' },
    menuButton: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '8px' },
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
    welcomeMessageContainer: { margin: 'auto', padding: '20px', textAlign: 'center', maxWidth: '80%' },
    welcomeMessageText: { background: 'var(--color-background-input)', borderRadius: '12px', padding: '16px', color: 'var(--color-text-muted)', fontSize: '14px', lineHeight: 1.6, display: 'inline-block' },
    messageWrapper: { display: 'flex', alignItems: 'flex-end', maxWidth: '80%', position: 'relative' },
    adminMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    userMessage: { alignSelf: 'flex-start' },
    avatar: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '0 10px' },
    adminAvatar: { background: 'var(--color-primary)', color: 'var(--color-text-light)', padding: 0, border: '1px solid var(--color-border)' },
    userAvatar: { background: 'var(--color-text-muted)', color: 'var(--color-background-panel)' },
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
    ticks: { display: 'inline-block', verticalAlign: 'bottom', height: '16px' },
    reactionsContainer: { display: 'flex', gap: '4px', position: 'absolute', bottom: '-12px', zIndex: 2 },
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
    suggestionsWrapper: { position: 'absolute', bottom: '100%', right: '16px', left: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', paddingBottom: '8px', pointerEvents: 'none' },
    suggestionsLoading: { fontSize: '14px', color: 'var(--color-text-muted)', padding: '8px 14px', background: 'var(--color-background-panel)', borderRadius: '18px', border: '1px solid var(--color-border)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', pointerEvents: 'auto' },
    suggestionsContainer: { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', pointerEvents: 'auto' },
    suggestionButton: { padding: '8px 14px', borderRadius: '18px', border: '1px solid var(--color-border)', background: 'var(--color-background-panel)', color: 'var(--color-primary)', cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', pointerEvents: 'auto' },
    inputArea: { display: 'flex', padding: '16px', borderTop: '1px solid var(--color-border)', gap: '10px', alignItems: 'flex-end' },
    textarea: { flex: 1, padding: '12px 18px', borderRadius: '24px', border: '1px solid var(--color-border)', fontSize: '16px', outline: 'none', background: 'var(--color-background-input)', color: 'var(--color-text-main)', resize: 'none', overflowY: 'auto', maxHeight: '120px', fontFamily: 'inherit' },
    attachButton: { background: 'transparent', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0 },
    sendButton: { background: 'var(--color-primary)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', cursor: 'pointer', flexShrink: 0 },
    placeholder: { margin: 'auto', color: 'var(--color-text-muted)' },
    typingIndicator: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '10px 14px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(var(--blur-effect))', WebkitBackdropFilter: 'blur(var(--blur-effect))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modalContent: { background: 'var(--color-background-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
    actionsModalContent: { background: 'var(--color-background-panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--color-border)', width: '90%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '16px' },
    modalTitle: { margin: '0 0 16px 0', color: 'var(--color-primary)', textAlign: 'center' },
    modalText: { margin: '0 0 24px 0', color: 'var(--color-text-muted)' },
    modalActions: { display: 'flex', gap: '12px', justifyContent: 'center' },
    modalButton: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', color: 'var(--color-text-main)', fontSize: '16px', cursor: 'pointer' },
    modalButtonDanger: { background: '#d9534f', color: 'white', border: '1px solid #d9534f' },
    profileDetails: { color: 'var(--color-text-main)', wordBreak: 'break-all' },
    actionItem: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '8px', background: 'var(--color-background-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', cursor: 'pointer', textAlign: 'left', width: '100%' },
    actionItemDanger: { borderColor: 'rgba(217, 83, 79, 0.5)', color: '#d9534f' },
    actionIcon: { flexShrink: 0, width: '24px', height: '24px' },
    actionTitle: { margin: 0, fontSize: '1em', fontWeight: 500 },
    actionDescription: { margin: '2px 0 0 0', fontSize: '0.8em', color: 'var(--color-text-muted)' },
};

export default AdminChatView;
