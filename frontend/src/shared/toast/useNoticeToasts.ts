import { useEffect, useRef } from "react";
import { useToast, type ToastTone } from "./ToastContext";

interface ToastNoticeLike {
  text: string;
  tone?: "info" | "warning" | "success" | "error";
}

function toToastTone(tone?: ToastNoticeLike["tone"]): ToastTone {
  if (tone === "warning") return "warning";
  if (tone === "success") return "success";
  if (tone === "error") return "error";
  return "info";
}

export function useNoticeToasts(
  notices: Array<ToastNoticeLike | null | undefined>,
  title?: string,
): void {
  const { pushToast } = useToast();
  const previousFingerprintsRef = useRef(new Set<string>());

  useEffect(() => {
    const currentFingerprints = new Set<string>();

    notices.forEach((notice) => {
      if (!notice?.text.trim()) {
        return;
      }

      const fingerprint = `${notice.tone ?? "info"}::${notice.text}`;
      currentFingerprints.add(fingerprint);

      if (!previousFingerprintsRef.current.has(fingerprint)) {
        pushToast({
          title,
          description: notice.text,
          tone: toToastTone(notice.tone),
        });
      }
    });

    previousFingerprintsRef.current = currentFingerprints;
  }, [notices, pushToast, title]);
}
