import { useEffect, useRef, useState } from "react";

type GoogleLoginButtonProps = {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

const GOOGLE_SCRIPT_ID = "google-identity-services-script";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existing = document.getElementById(
    GOOGLE_SCRIPT_ID,
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Không thể tải Google Identity Services.")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Không thể tải Google Identity Services."));
    document.head.appendChild(script);
  });
}

export function GoogleLoginButton({
  onCredential,
  onError,
  disabled = false,
}: GoogleLoginButtonProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setLoading(false);
      onError?.("Thiếu VITE_GOOGLE_CLIENT_ID.");
      return;
    }

    let mounted = true;
    setLoading(true);
    loadGoogleScript()
      .then(() => {
        if (!mounted) return;
        if (!window.google?.accounts?.id || !buttonRef.current) {
          onError?.("Google Identity Services chưa sẵn sàng.");
          return;
        }
        buttonRef.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: (response) => {
            const credential = response.credential?.trim();
            if (!credential) {
              onError?.("Không nhận được credential từ Google.");
              return;
            }
            onCredential(credential);
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
          logo_alignment: "left",
        });
      })
      .catch((error) => {
        onError?.(
          error instanceof Error
            ? error.message
            : "Không thể khởi tạo đăng nhập Google.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [onCredential, onError]);

  return (
    <div className="space-y-2">
      <div
        ref={buttonRef}
        className={disabled ? "pointer-events-none opacity-50" : ""}
      />
      {loading ? (
        <p className="text-center text-xs text-muted-foreground">
          Đang tải đăng nhập Google...
        </p>
      ) : null}
    </div>
  );
}
