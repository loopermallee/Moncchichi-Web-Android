import React, { useEffect, useState } from 'react';
import { ICONS } from '../constants';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: 'bg-moncchichi-surfaceAlt border-moncchichi-success text-moncchichi-success',
        error: 'bg-moncchichi-surfaceAlt border-moncchichi-error text-moncchichi-error',
        info: 'bg-moncchichi-surfaceAlt border-moncchichi-accent text-moncchichi-accent',
    };

    const icon = {
        success: ICONS.CheckCircle,
        error: ICONS.XCircle,
        info: ICONS.Glasses,
    }[type];

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-top-5 duration-300 ${bgColors[type]}`}>
            <div>{icon}</div>
            <span className="text-sm font-medium text-moncchichi-text">{message}</span>
        </div>
    );
};

export default Toast;