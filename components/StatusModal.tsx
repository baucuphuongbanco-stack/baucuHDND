import React from 'react';
import { useNotification } from '../contexts/NotificationContext';

export const StatusModal: React.FC = () => {
    const { isOpen, type, title, message, options, closeNotification } = useNotification();

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (options.onConfirm) options.onConfirm();
        closeNotification();
    };

    const handleCancel = () => {
        if (options.onCancel) options.onCancel();
        closeNotification();
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[500px] rounded-[1.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200">

                {/* Header (URL-style) */}
                <div className="px-6 pt-6 pb-2">
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                </div>

                {/* Body */}
                <div className="px-6 py-4 flex-1">
                    <div className="text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                        {message}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-6 pt-2 flex justify-end gap-3">
                    {/* OK BUTTON */}
                    <button
                        onClick={handleConfirm}
                        className="px-10 py-2.5 bg-[#5d5600] text-white rounded-full font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md border-2 border-[#4a4500]"
                    >
                        {options.okText || 'OK'}
                    </button>

                    {/* CANCEL BUTTON (Only for confirm type) */}
                    {type === 'confirm' && (
                        <button
                            onClick={handleCancel}
                            className="px-10 py-2.5 bg-[#f9e285] text-[#5d5600] rounded-full font-black text-sm uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all shadow-sm"
                        >
                            {options.cancelText || 'Huỷ'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
