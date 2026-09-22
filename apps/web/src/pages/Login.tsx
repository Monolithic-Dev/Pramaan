import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { requestOtp, verifyOtp } from "../api/client.js";
import { authErrorKey, AuthError, useAuth } from "../auth/AuthContext.js";
import { LogoMark } from "../components/layout/Brand.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Icon } from "../ui/Icon.js";
import { Alert, Button, Field, Input, Segmented } from "../ui/kit.js";

type Who = "citizen" | "officer";
type Mode = "signin" | "signup" | "phone";

export default function Login() {
  const { t, countryCode, language } = useLanguage();
  const { signIn, signUp, signInWithToken, status, me } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [who, setWho] = useState<Who>(params.get("as") === "officer" ? "officer" : "citizen");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequestId, setOtpRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (who === "officer") setMode("signin");
  }, [who]);

  if (status === "authenticated" && me) {
    return <Navigate to={params.get("next") ?? (me.kind === "officer" ? "/console" : "/my")} replace />;
  }

  const afterLogin = (kind: "officer" | "citizen") => {
    const next = params.get("next");
    navigate(next && next.startsWith(kind === "officer" ? "/console" : "/my") ? next : kind === "officer" ? "/console" : "/my", { replace: true });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "phone") {
        if (!otpRequestId) {
          setOtpRequestId((await requestOtp(phone.trim(), countryCode)).request_id);
        } else {
          const { citizen_token } = await verifyOtp(otpRequestId, otp.trim(), countryCode);
          afterLogin((await signInWithToken(citizen_token)).kind);
        }
      } else {
        const profile = { preferred_language: language, country_code: countryCode };
        const result = mode === "signup" ? await signUp(email.trim(), password, profile) : await signIn(email.trim(), password);
        if (who === "officer" && result.kind !== "officer") {
          setError(t("auth.err.notOfficer"));
          return;
        }
        afterLogin(result.kind);
      }
    } catch (err) {
      setError(t(err instanceof AuthError ? authErrorKey(err.code) : mode === "phone" ? "auth.err.phone" : "auth.err.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-140px)] max-w-6xl items-stretch gap-0 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-12">
      {/* Brand panel */}
      <div className="hero-grid relative hidden overflow-hidden rounded-l-3xl p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="dotted absolute inset-0 opacity-20" />
        <div className="relative">
          <LogoMark size={48} />
          <h2 className="mt-8 text-3xl font-extrabold leading-tight">{who === "officer" ? t("login.officer.title") : t("login.citizen.title")}</h2>
          <p className="mt-3 text-brand-100">{who === "officer" ? t("login.officer.body") : t("login.citizen.body")}</p>
        </div>
        <ul className="relative mt-10 space-y-3 text-sm">
          {(who === "officer" ? ["login.o1", "login.o2", "login.o3"] : ["login.c1", "login.c2", "login.c3"]).map((k) => (
            <li key={k} className="flex items-start gap-3">
              <Icon name="checkCircle" size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              {t(k)}
            </li>
          ))}
        </ul>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-10 lg:rounded-l-none lg:rounded-r-3xl">
        <Segmented
          value={who}
          onChange={setWho}
          className="w-full [&>button]:flex-1"
          options={[
            { value: "citizen", label: t("login.tab.citizen") },
            { value: "officer", label: t("login.tab.officer") },
          ]}
        />

        <h1 className="mt-6 text-2xl font-bold text-slate-900">
          {who === "officer" ? t("login.officer.heading") : mode === "signup" ? t("login.signup") : t("login.signin")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {who === "officer" ? t("login.officer.hint") : mode === "signup" ? t("login.signup.hint") : t("login.signin.hint")}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          {mode !== "phone" ? (
            <>
              <Field label={t("auth.email")} htmlFor="email">
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </Field>
              <Field label={t("auth.password")} htmlFor="password" hint={mode === "signup" ? t("auth.passwordHint") : undefined}>
                <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("status.phone")} htmlFor="phone">
                <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" disabled={Boolean(otpRequestId)} />
              </Field>
              {otpRequestId && (
                <Field label={t("status.otp")} htmlFor="otp">
                  <Input id="otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value)} />
                </Field>
              )}
            </>
          )}

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" size="lg" loading={busy} disabled={mode === "phone" ? !phone : !email || !password}>
            {mode === "phone"
              ? otpRequestId ? t("status.verify") : t("status.sendCode")
              : mode === "signup" ? t("login.createAccount") : t("nav.signIn")}
          </Button>
        </form>

        {who === "citizen" && (
          <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm">
            {mode === "signin" && (
              <p className="text-slate-600">
                {t("login.noAccount")}{" "}
                <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setMode("signup")}>
                  {t("login.createAccount")}
                </button>
              </p>
            )}
            {mode !== "signin" && (
              <p className="text-slate-600">
                {t("login.haveAccount")}{" "}
                <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode("signin"); setOtpRequestId(null); }}>
                  {t("nav.signIn")}
                </button>
              </p>
            )}
            {mode !== "phone" && (
              <button type="button" className="flex items-center gap-2 font-medium text-slate-600 hover:text-brand-700" onClick={() => setMode("phone")}>
                <Icon name="phone" size={16} /> {t("login.usePhone")}
              </button>
            )}
            <p className="pt-2 text-xs text-slate-500">{t("login.anonNote")}</p>
          </div>
        )}
        {who === "officer" && <p className="mt-6 border-t border-slate-100 pt-5 text-xs text-slate-500">{t("login.officer.note")}</p>}
      </div>
    </div>
  );
}
