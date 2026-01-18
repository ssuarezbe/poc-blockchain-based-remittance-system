export const logError = async (message: string, details?: any) => {
    try {
        await fetch('http://localhost:3000/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                level: 'error',
                message,
                details: {
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    ...details
                },
            }),
        });
    } catch (e) {
        console.error('Failed to send log to backend', e);
    }
};
