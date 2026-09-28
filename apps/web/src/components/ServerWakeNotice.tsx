import { useEffect, useState } from "react";
import { BASE_URL } from "../api/client.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Spinner } from "../ui/kit.js";

const HEALTH_URL = `${BASE_URL.replace(/\/v1\/?$/, "")}/healthz`;
/** Longer than this and the API is almost certainly booting, not just slow. */
const SHOW_AFTER_MS = 2500;
const GIVE_UP_AFTER_MS = 3 * 60_000;

/**
 * Free hosting (Render) puts the API to sleep after 15 idle minutes and the first request then takes
 * 30 to 60 seconds. Without a word of explanation that looks like a broken site, so ping the API as
 * soon as the app opens and, if it is slow to answer, say what is happening until it is awake.
 */
export function ServerWakeNotice() {
  const { t } = useLanguage();
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let done = false;
    const started = Date.now();
    const show = setTimeout(() => !done && setWaking(true), SHOW_AFTER_MS);

    async function poll() {
      // A booting service may refuse connections or answer 502 before it is ready: keep asking.
      while (!done && Date.now() - started < GIVE_UP_AFTER_MS) {
        try {
          const res = await fetch(HEALTH_URL, { cache: "no-store", signal: AbortSignal.timeout(70_000) });
          // Read the (tiny) body: an unread fetch body stays an open request in the browser.
          await res.text();
          if (res.ok) break;
        } catch {
          // not up yet
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      done = true;
      clearTimeout(show);
      setWaking(false);
    }
    void poll();
    return () => {
      done = true;
      clearTimeout(show);
    };
  }, []);

  if (!waking) return null;
  return (
    <div role="status" className="no-print fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 md:bottom-6">
      <div className="flex max-w-md items-start gap-3 rounded-2xl bg-brand-950 px-4 py-3 text-white shadow-lift">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-saffron-400"><Spinner size={18} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("wake.title")}</p>
          <p className="mt-0.5 text-xs leading-snug text-brand-100">{t("wake.body")}</p>
        </div>
      </div>
    </div>
  );
}
