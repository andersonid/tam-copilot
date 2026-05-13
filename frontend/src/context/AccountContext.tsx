import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import api from "../services/api";

export interface AccountSummary {
  id: number;
  name: string;
  account_number: string;
  region: string | null;
  country: string | null;
  tam_type: string | null;
  is_active: boolean;
}

interface AccountContextState {
  /** null means "Global" — no account selected */
  selectedAccountId: number | null;
  selectedAccount: AccountSummary | null;
  accounts: AccountSummary[];
  loading: boolean;
  setSelectedAccountId: (id: number | null) => void;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextState>({
  selectedAccountId: null,
  selectedAccount: null,
  accounts: [],
  loading: false,
  setSelectedAccountId: () => {},
  refreshAccounts: async () => {},
});

const STORAGE_KEY = "tam_selected_account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountIdRaw] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  const setSelectedAccountId = useCallback((id: number | null) => {
    setSelectedAccountIdRaw(id);
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/accounts");
      setAccounts(data);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId) ?? null
    : null;

  return (
    <AccountContext.Provider
      value={{
        selectedAccountId,
        selectedAccount,
        accounts,
        loading,
        setSelectedAccountId,
        refreshAccounts,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export const useAccount = () => useContext(AccountContext);
