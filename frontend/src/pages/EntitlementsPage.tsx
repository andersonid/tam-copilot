import { useState, useEffect, useCallback } from "react";
import {
  Title, Spinner, EmptyState, EmptyStateBody, Label,
  Button, Alert, Toolbar, ToolbarContent, ToolbarItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import { useAccount } from "../context/AccountContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

export function EntitlementsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/entitlements", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("entitlements");
    if (result) fetchData();
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  const isExpiring = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 90;
  };
  const isExpired = (d: string | null) => d ? new Date(d).getTime() < Date.now() : false;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Entitlements — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync subscriptions (OCM)
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}
      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {selectedAccountId
              ? "No entitlements recorded. Click \"Sync subscriptions (OCM)\" to pull OpenShift subscriptions for this account's organization."
              : "Select an account to view entitlements."}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Entitlements" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Name</Th><Th>SKU</Th><Th>Service Level</Th><Th>Support</Th><Th>Start</Th><Th>End</Th><Th>Qty</Th></Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td><strong>{i.entitlement_name}</strong></Td>
                <Td>{i.sku}</Td>
                <Td>{i.service_level}</Td>
                <Td>{i.support_level}</Td>
                <Td>{i.start_date}</Td>
                <Td>
                  {i.end_date}
                  {isExpired(i.end_date) && <Label color="red" isCompact style={{ marginLeft: 8 }}>Expired</Label>}
                  {isExpiring(i.end_date) && <Label color="orange" isCompact style={{ marginLeft: 8 }}>Expiring</Label>}
                </Td>
                <Td>{i.quantity}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
