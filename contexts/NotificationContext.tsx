import React, { createContext, useContext, useState, ReactNode } from 'react';

type NotificationType = 'info' | 'confirm' | 'warning' | 'error';

interface NotificationOptions {
    title?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    okText?: string;
    cancelText?: string;
}

interface NotificationContextType {
    isOpen: boolean;
    type: NotificationType;
    title: string;
    message: string | ReactNode;
    options: NotificationOptions;
    showNotification: (message: string | ReactNode, options?: NotificationOptions) => void;
    showConfirm: (message: string | ReactNode, options?: NotificationOptions) => void;
    closeNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState<NotificationType>('info');
    const [message, setMessage] = useState<string | ReactNode>('');
    const [title, setTitle] = useState('');
    const [options, setOptions] = useState<NotificationOptions>({});

    const showNotification = (msg: string | ReactNode, opts: NotificationOptions = {}) => {
        setMessage(msg);
        setType('info');
        setTitle(opts.title || 'localhost:3000 cho biết');
        setOptions(opts);
        setIsOpen(true);
    };

    const showConfirm = (msg: string | ReactNode, opts: NotificationOptions = {}) => {
        setMessage(msg);
        setType('confirm');
        setTitle(opts.title || 'localhost:3000 cho biết');
        setOptions(opts);
        setIsOpen(true);
    };

    const closeNotification = () => {
        setIsOpen(false);
    };

    return (
        <NotificationContext.Provider value={{
            isOpen, type, title, message, options,
            showNotification, showConfirm, closeNotification
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
