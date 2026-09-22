import { hasMinimumRole } from "../middleware/auth.js";

// The single source of truth for what each role may do. The API enforces these on every route
// and returns the resolved set from GET /me so the web app can hide controls it would only get a
// 403 for; the UI never invents permissions of its own.
//
//   citizen             report issues, track their own reports, export/erase their own data
//   field_officer       read the console for their jurisdiction (issues, map, analytics, forecasts)
//   district_collector  + verify/dispute issues, emergency override, recommend and run projects
//   state_admin         + equity audit, states, officer accounts, audit log
export interface Permissions {
  view_console: boolean;
  update_issue_status: boolean;
  emergency_override: boolean;
  manage_projects: boolean;
  view_equity: boolean;
  manage_states: boolean;
  manage_officers: boolean;
  view_audit_log: boolean;
}

export function permissionsFor(role: string | null): Permissions {
  const officer = role !== null && hasMinimumRole(role, "field_officer");
  const collector = role !== null && hasMinimumRole(role, "district_collector");
  const admin = role !== null && hasMinimumRole(role, "state_admin");
  return {
    view_console: officer,
    update_issue_status: collector,
    emergency_override: collector,
    manage_projects: collector,
    view_equity: admin,
    manage_states: admin,
    manage_officers: admin,
    view_audit_log: admin,
  };
}
