"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@amader/admin-ui";

/**
 * Reads a barcode with the device camera (phone/tablet/laptop) for shops
 * without a hardware scanner. The decoder is loaded only when this opens.
 * Camera access needs https (or localhost), which the POS always has.
 */
export function CameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(onDetected);
  useEffect(() => {
    done.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled || !video.current) return;
        const reader = new BrowserMultiFormatReader();
        let found = false;
        const controls = await reader.decodeFromConstraints(
          // Back camera on phones; any camera on a laptop.
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (result, _err, ctl) => {
            // No barcode in this frame yet, or already handled.
            if (!result || found) return;
            found = true;
            ctl.stop();
            done.current(result.getText());
          },
        );
        if (cancelled || found) controls.stop();
        else stop = () => controls.stop();
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission was blocked. Allow the camera for this site in the browser's address bar, then try again."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not start the camera.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Scan with camera"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Scan with camera</h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={video}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
              />
              {/* Aiming guide */}
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-emerald-400" />
            </div>
            <p className="mt-3 text-center text-sm text-gray-600">
              Hold the barcode inside the green box. It adds itself when read.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
