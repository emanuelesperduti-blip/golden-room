import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "gamespark-pwa-dismissed";
const LEGACY_DISMISS_KEY = "golden-room-pwa-dismissed";
const RESET_EVENT = "gamespark:pwa-reset-banner";

function clearDismissFlags() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DISMISS_KEY);
  window.localStorage.removeItem(LEGACY_DISMISS_KEY);
}

export function resetPwaBannerDismissal() {
  if (typeof window === "undefined") return;
  clearDismissFlags();
  window.dispatchEvent(new Event(RESET_EVENT));
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSecureContextState, setIsSecureContextState] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const android = /android/.test(ua);
    const mobile = /iphone|ipad|ipod|android|mobile/.test(ua);
    const secure = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);

    setIsStandalone(standalone);
    setIsInstalled(standalone);
    setIsIos(ios);
    setIsAndroid(android);
    setIsMobile(mobile);
    setIsSecureContextState(secure);
    setDismissed(
      window.localStorage.getItem(DISMISS_KEY) === "1" || window.localStorage.getItem(LEGACY_DISMISS_KEY) === "1",
    );

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      clearDismissFlags();
      setDismissed(false);
    };

    const onReset = () => {
      clearDismissFlags();
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(RESET_EVENT, onReset);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(RESET_EVENT, onReset);
    };
  }, []);

  const canPromptInstall = !!deferredPrompt;

  const installMode = useMemo<"native" | "ios" | "android-manual" | "android-https" | "none">(() => {
    if (isInstalled || isStandalone) return "none";
    if (canPromptInstall) return "native";
    if (isIos) return "ios";
    if (isAndroid && isSecureContextState) return "android-manual";
    if (isAndroid && !isSecureContextState) return "android-https";
    return "none";
  }, [canPromptInstall, isAndroid, isInstalled, isIos, isSecureContextState, isStandalone]);

  const shouldShowBanner = useMemo(() => {
    if (dismissed || isInstalled || isStandalone) return false;
    if (installMode !== "none") return true;
    return isMobile && canPromptInstall;
  }, [canPromptInstall, dismissed, installMode, isInstalled, isMobile, isStandalone]);

  async function install() {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const accepted = choice.outcome === "accepted";
    if (accepted) {
      setIsInstalled(true);
      clearDismissFlags();
      setDismissed(false);
    }
    setDeferredPrompt(null);
    return accepted;
  }

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
      window.localStorage.removeItem(LEGACY_DISMISS_KEY);
    }
    setDismissed(true);
  }

  return {
    canPromptInstall,
    install,
    dismiss,
    shouldShowBanner,
    isIos,
    isAndroid,
    isMobile,
    isStandalone,
    isInstalled,
    isSecureContext: isSecureContextState,
    installMode,
  };
}
