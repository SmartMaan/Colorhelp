import React, { useState, useEffect, useMemo } from 'react';
import { database, serverTimestamp } from '../firebase';
import { ref, onValue, off, update, set, onDisconnect, get } from 'firebase/database';
import { User } from '../types';
import AdminChatView from './AdminChatView';
import AdminSettings from './AdminSettings';
import FeedbackManager from './FeedbackManager';
import { PowerIcon, UserIcon, SettingsIcon, StarIcon, FeedbackIcon } from './icons/Icons';

interface AdminPanelProps {
    adminUser: User;
    onLogout: () => void;
    role: 'admin' | 'master';
}

type AdminView = 'users' | 'settings' | 'feedback';
type FilterType = 'all' | 'unread' | 'online' | 'marked' | 'closed';

const ONLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

const AdminPanel: React.FC<AdminPanelProps> = ({ adminUser, onLogout, role }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [view, setView] = useState<AdminView>('users');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    // Real-time admin presence management
    useEffect(() => {
        const statusRef = ref(database, 'admin_status');
        const presenceRef = ref(database, '.info/connected');

        const unsubscribe = onValue(presenceRef, (snap) => {
            if (snap.val() !== true) return;
            set(statusRef, { status: 'online' });
            onDisconnect(statusRef).set({ status: 'offline', lastSeen: serverTimestamp() });
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                set(statusRef, { status: 'away' });
            } else {
                get(presenceRef).then((snap) => {
                    if (snap.val() === true) set(statusRef, { status: 'online' });
                });
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            off(presenceRef, 'value', unsubscribe);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);


    useEffect(() => {
        const usersRef = ref(database, 'users');
        const unsubscribe = onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            // FIX: Reordered filter and map. First filter by key, then map to user objects.
            const loadedUsers: User[] = data ? Object.entries(data)
                .filter(([key, value]) => key !== 'admin' && key !== 'master' && value && typeof value === 'object')
                .map(([key, value]) => {
                    const userVal = value as Partial<User>;
                    return {
                        id: key,
                        name: userVal.name || 'Unnamed User', // Sanitize name
                        email: userVal.email || 'No Email',   // Sanitize email
                        phone: userVal.phone || '',
                        website: userVal.website || '',
                        lastActivity: userVal.lastActivity,
                        createdAt: userVal.createdAt,
                        adminReadTimestamp: userVal.adminReadTimestamp,
                        isMarked: userVal.isMarked,
                        isClosed: userVal.isClosed,
                        unreadCount: userVal.unreadCount,
                        mediaUploadsEnabled: userVal.mediaUploadsEnabled,
                    };
                })
                .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0)) : [];
            setUsers(loadedUsers);
        });
        return () => off(usersRef, 'value', unsubscribe);
    }, []);

    const handleLogoutClick = () => {
        set(ref(database, 'admin_status'), { status: 'offline', lastSeen: serverTimestamp() });
        onLogout();
    };

    const isOnline = (user: User) => user.lastActivity && (Date.now() - user.lastActivity < ONLINE_THRESHOLD);

    const totalUnreadCount = useMemo(() => {
        return users.reduce((total, user) => {
            if (user.isClosed) return total;
            return total + (user.unreadCount || 0);
        }, 0);
    }, [users]);
    
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const searchMatch = (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            if (!searchMatch) return false;

            if (activeFilter === 'closed') {
                return user.isClosed === true;
            }
            
            // For all other filters, ignore closed users
            if (user.isClosed) return false;

            switch (activeFilter) {
                case 'unread': return (user.unreadCount || 0) > 0;
                case 'online': return isOnline(user);
                case 'marked': return user.isMarked === true;
                default: return true; // 'all'
            }
        });
    }, [users, searchTerm, activeFilter]);

    const handleToggleMark = (e: React.MouseEvent, user: User) => {
        e.stopPropagation();
        update(ref(database, `users/${user.id}`), { isMarked: !user.isMarked });
    };
    
    const FilterButton: React.FC<{ filter: FilterType; label: string }> = ({ filter, label }) => (
        <button
            style={{ ...styles.filterButton, ...(activeFilter === filter ? styles.activeFilter : {}) }}
            onClick={() => setActiveFilter(filter)}
        >
            {label}
        </button>
    );

    const isChatViewActive = view !== 'users' || selectedUser !== null;

    if (!isChatViewActive) {
        return (
             <div style={styles.panelContainer} className="responsive-container">
                <div style={{...styles.sidebar, width: '100%', borderRight: 'none'}}>
                    <header style={styles.sidebarHeader}>
                        <h2>Users</h2>
                        <div>
                            <button onClick={() => setView('feedback')} style={styles.actionButton} title="View Feedback"><FeedbackIcon height={20} width={20} /></button>
                            <button onClick={() => setView('settings')} style={styles.actionButton} title="Settings"><SettingsIcon height={20} width={20} /></button>
                            <button onClick={handleLogoutClick} style={styles.actionButton} title="Logout"><PowerIcon height={20} width={20} /></button>
                        </div>
                    </header>
                    <div style={styles.searchAndFilter}>
                        <input type="text" placeholder="Search users..." style={styles.searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <div style={styles.filterContainer}>
                            <FilterButton filter="all" label="All" />
                            <FilterButton filter="unread" label={`Unread ${totalUnreadCount > 0 ? `(${totalUnreadCount})` : ''}`} />
                            <FilterButton filter="online" label="Online" />
                            <FilterButton filter="marked" label="Marked" />
                            <FilterButton filter="closed" label="Closed" />
                        </div>
                    </div>
                    <ul style={styles.userList}>
                        {filteredUsers.map(user => (
                            <li key={user.id} onClick={() => { setSelectedUser(user); }} className="user-list-item-hoverable" style={{...styles.userListItem, ...(user.isClosed ? { opacity: 0.6 } : {})}}>
                                <div style={{position: 'relative'}}>
                                    <UserIcon style={{flexShrink: 0}} />
                                    {isOnline(user) && !user.isClosed && <div style={styles.onlineDot}></div>}
                                </div>
                                <div style={styles.userInfo}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                        <span style={{ fontWeight: (user.unreadCount || 0) > 0 ? 'bold' : 'normal', color: (user.unreadCount || 0) > 0 ? 'var(--color-primary)' : 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.name}</span>
                                        {(user.unreadCount || 0) > 0 && <div style={styles.unreadCountBadge}>{user.unreadCount}</div>}
                                </div>
                                <small style={{color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{user.email}</small>
                                </div>
                                {!user.isClosed && (
                                    <button onClick={(e) => handleToggleMark(e, user)} style={{...styles.markButton, color: user.isMarked ? 'var(--color-marked)' : 'var(--color-text-muted)'}}>
                                        <StarIcon fill={user.isMarked ? 'currentColor' : 'none'}/>
                                    </button>
                                )}
                            </li>
                        ))}
                        {filteredUsers.length === 0 && <li style={styles.noUsers}>No users match filters.</li>}
                    </ul>
                     <style>{` .user-list-item-hoverable:hover { background-color: rgba(255, 215, 0, 0.05); } `}</style>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.panelContainer} className="responsive-container">
            <div style={{...styles.chatView, width: '100%'}}>
                 {view === 'settings' ? (
                    <AdminSettings onBack={() => setView('users')} />
                ) : view === 'feedback' ? (
                    <FeedbackManager onBack={() => setView('users')} />
                ) : selectedUser ? (
                    <AdminChatView user={selectedUser} onDeselect={() => setSelectedUser(null)} onBack={() => setSelectedUser(null)} />
                ) : (
                    // This is a fallback that should ideally not be visible.
                    <div style={styles.placeholder}>Loading content...</div>
                )}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    panelContainer: { width: '100%', maxWidth: '1000px', height: '90vh', background: 'var(--color-background-panel)', borderRadius: '16px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', overflow: 'hidden', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', position: 'relative' },
    sidebar: { width: '350px', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', background: 'var(--color-background-main)' },
    sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-primary)'},
    actionButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-primary)' },
    searchAndFilter: { padding: '12px', borderBottom: '1px solid var(--color-border)' },
    searchInput: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-background-input)', fontSize: '14px', color: 'var(--color-text-main)', outline: 'none', boxSizing: 'border-box' },
    filterContainer: { display: 'flex', gap: '8px', marginTop: '12px' },
    filterButton: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', fontSize: '12px' },
    activeFilter: { background: 'var(--color-primary)', color: 'var(--color-text-light)', borderColor: 'var(--color-primary)' },
    userList: { listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto', flex: 1 },
    userListItem: { display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', gap: '12px', transition: 'background-color 0.2s, opacity 0.3s' },
    selectedUser: { backgroundColor: 'rgba(255, 215, 0, 0.1)' },
    userInfo: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
    onlineDot: { width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)', position: 'absolute', bottom: 0, right: 0, border: '2px solid var(--color-background-main)' },
    unreadCountBadge: { background: 'var(--color-primary)', color: 'var(--color-text-light)', borderRadius: '50%', minWidth: '20px', height: '20px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 4px' },
    markButton: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginLeft: 'auto' },
    chatView: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' },
    placeholder: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '18px', textAlign: 'center' },
    noUsers: { padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }
};

export default AdminPanel;