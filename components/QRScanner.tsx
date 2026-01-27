
import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  fps?: number;
  qrbox?: number;
  aspectRatio?: number;
  disableFlip?: boolean;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
  disableFlip = false
}) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps, 
        qrbox,
        aspectRatio,
        disableFlip
      },
      /* verbose= */ false
    );

    scanner.render(onScanSuccess, (error) => {
        if (onScanError) {
            onScanError(error);
        }
    });

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [onScanSuccess, onScanError, fps, qrbox, aspectRatio, disableFlip]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border-4 border-primary/20 shadow-xl bg-white">
      <div id="qr-reader" className="w-full"></div>
      <div className="p-4 bg-slate-50 text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Quét mã QR trên CCCD để tìm kiếm nhanh
        </p>
      </div>
    </div>
  );
};
