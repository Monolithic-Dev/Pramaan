import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import type { Permissions } from "../api/api.js";
import { useLanguage } from "../i18n/LanguageProvider.js";
import { Button, EmptyState, Spinner } from "../ui/kit.js";
import { useAuth } from "./AuthContext.js";

function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-brand-700">
      <Spinner size={32} />
    </div>
  );
}

/** Route guard: sends anonymous visitors to sign-in (and back afterwards) and each kind of user
 *  to their own area. The server enforces every permission again; this only avoids dead ends. */
export function RequireAuth({
  kind,
  permission,
  children,
}: {
  kind: "citizen" | "officer";
  permission?: keyof Permissions;
  children: ReactNode;
}) {
  const { status, me, can } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (status === "loading") return <FullPageSpinner />;
  if (status === "anonymous" || !me) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}&as=${kind}`} replace />;
  }
  if (me.kind !== kind) return <Navigate to={me.kind === "officer" ? "/console" : "/my"} replace />;
  if (permission && !can(permission)) {
    return (
      <EmptyState
        icon="lock"
        title={t("guard.forbiddenTitle")}
        body={t("guard.forbiddenBody")}
        action={
          <Link to="/console">
            <Button variant="secondary">{t("guard.backToOverview")}</Button>
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
