export interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    lastActivity?: number;
    createdAt?: number; 
    adminReadTimestamp?: number;
    website?: string;
    isMarked?: boolean;
    isClosed?: boolean;
    unreadCount?: number;
    mediaUploadsEnabled?: boolean;
    promo?: string;
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
    isHighlightedByAdmin?: boolean;
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

export interface Feedback {
    id: string; // Composite key: `${userId}_${activityTimestamp}`
    userId: string;
    userName?: string;
    rating: number;
    comment: string;
    timestamp: number;
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
    fontFamily?: string;
    backgroundImageUrl?: string;
    backgroundAnimationClass?: string;
    blurEffectEnabled?: boolean;
    chatBackgroundColor?: string;
    chatBackgroundImageUrl?: string;
    chatBackgroundImageOpacity?: number;
    messageCornerRadius?: number;
    messageTextSize?: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AppConfig {
    appName: string;
    agentName: string;
    agentProfileImageUrl?: string;
    agentStatus: 'online' | 'offline' | 'away';
    theme: Theme;
    mediaUploadsEnabled?: boolean;
    mediaUploadApiKey?: string;
    welcomeMessage?: string;
    helpSuggestions?: string[];
    aiSuggestionsEnabled?: boolean;
    firebaseConfig?: FirebaseConfig;
}

export interface UData {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    promo?: string;
    ref_c?: string;
    [key: string]: any;
}

export interface UBank {
    [key: string]: any;
}

export interface UPay {
    [key: string]: any;
}

export interface UWithdraw {
    [key: string]: any;
}