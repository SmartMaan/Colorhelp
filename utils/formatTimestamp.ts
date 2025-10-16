export const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString(navigator.language, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};
