import React, { useEffect, useState } from 'react';

/**
 * A floating notification component that appears briefly on screen.
 * @param {object} props - Component props
 * @param {string} props.message - The text message to display.
 * @param {string} props.type - The type of message ('success' or 'error').
 * @param {function} props.onClose - Function to call when the toast should disappear.
 */
const Toast = ({ message, type, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Effect to control the visibility and auto-hide
    useEffect(() => {
        if (message) {
            // 1. Show the toast immediately
            setIsVisible(true);

            // 2. Set a timer to close the toast after 3 seconds
            const timer = setTimeout(() => {
                setIsVisible(false);
                // Wait for the fade-out transition (0.3s) before calling the parent's onClose
                setTimeout(onClose, 300);
            }, 3000);

            // Cleanup function to clear the timer if the component unmounts
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) {
        return null;
    }

    // Determine the CSS class based on the type prop
    const typeClass = type === 'error' ? 'toast-error' : 'toast-success';
    const containerClass = isVisible ? 'toast-container show' : 'toast-container';

    return (
        <div className={containerClass}>
            <div className={`toast ${typeClass}`}>
                {/* Optional icon based on type */}
                <span>{type === 'error' ? '⚠️' : '✅'}</span>
                <span>{message}</span>
            </div>
        </div>
    );
};

export default Toast;
