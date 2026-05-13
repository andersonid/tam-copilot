import { useAuth } from "../context/AuthContext";
import { useAccount } from "../context/AccountContext";
import { EngagementPage } from "./EngagementPage";
import { ManagerEngagementPage } from "./ManagerEngagementPage";

/**
 * Single `/engagement` route: portfolio view (manager; admin with no account selected)
 * vs. per-account data (TAM/viewer; admin with an account selected).
 */
export function EngagementRoutePage() {
  const { role } = useAuth();
  const { selectedAccountId } = useAccount();

  if (role === "manager") {
    return <ManagerEngagementPage />;
  }
  if (role === "admin") {
    return selectedAccountId ? <EngagementPage /> : <ManagerEngagementPage />;
  }
  return <EngagementPage />;
}
