
import React from 'react';

/**
 * DevTool Component
 * 
 * A utility component strictly for development/demo environments.
 * It provides a floating action button to trigger automatic form filling
 * across the application, helping developers bypass repetitive data entry steps.
 * 
 * Usage:
 * Listens for the 'app-dev-autofill' custom event in form components (Login, DataEntry, etc.)
 */
export const DevTool: React.FC = () => {
  const triggerAutofill = () => {
    // Dispatch custom event to let active forms populate themselves
    const event = new CustomEvent('app-dev-autofill');
    window.dispatchEvent(event);
  };

  return (
    <button
      onClick={triggerAutofill}
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-5 py-3 bg-slate-800 text-white rounded-full shadow-2xl hover:bg-slate-700 transition-all active:scale-95 group border border-slate-700"
      title="Tự động điền dữ liệu mẫu (Chỉ dùng cho Demo)"
    >
      <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">magic_button</span>
      <span className="text-note font-medium uppercase tracking-[0.1em]">Tự động điền Form</span>
    </button>
  );
};
