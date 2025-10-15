export interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    lastActivity?: number;
    createdAt?: number; 
    adminReadTimestamp?: number;
    isMarked?: boolean;
    isClosed?: boolean;
    unreadCount?: number;
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'admin';
    timestamp: number;
    replyTo?: {
        messageId: string;
        messageText: string;
        senderName: string;
    };
    readByUser?: boolean;
    mediaUrl?: string;
    mediaType?: 'image' | 'file';
    reactions?: { [emoji: string]: string[] };
    editedAt?: number;
}

export interface AdminProfile {
    name: string;
    appName: string;
    status: 'online' | 'offline';
}

export interface AdminStatus {
    status: 'online' | 'offline' | 'away';
    lastSeen?: number;
}

export interface ThemeColors {
    primary: string;
    backgroundMain: string;
    backgroundPanel: string;
    backgroundHeader: string;
    backgroundInput: string;
    backgroundBubbleUser: string;
    backgroundBubbleAdmin: string;
    textMain: string;
    textMuted: string;
    textLight: string;
    border: string;
    unreadDot: string;
    success: string;
    marked: string;
    markedHighlight: string;
}

export interface Theme {
    mode: string;
    colors: ThemeColors;
}

export interface AppConfig {
    appName: string;
    agentName: string;
    agentStatus: 'online' | 'offline' | 'away';
    theme: Theme;
    mediaUploadsEnabled?: boolean;
    mediaUploadApiKey?: string;
    welcomeMessage?: string;
    helpSuggestions?: string[];
}