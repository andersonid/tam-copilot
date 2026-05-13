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

export function LifecyclePage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/lifecycle", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("lifecycle");
    if (result) fetchData();
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  const phaseColor = (p: string | null) => {
    if (!p) return "grey";
    const lower = p.toLowerCase();
    if (lower.includes("full")) return "green";
    if (lower.includes("maintenance")) return "orange";
    if (lower.includes("extended")) return "blue";
    if (lower.includes("end")) return "red";
    return "grey";
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Product Lifecycle — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync Lifecycle
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
              ? "No lifecycle data. Click \"Sync Lifecycle\" to pull data."
              : "Select an account to view lifecycle data."}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Lifecycle" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Product</Th><Th>Version</Th><Th>Current Phase</Th><Th>GA</Th><Th>Full Support End</Th><Th>Maintenance End</Th><Th>EUS End</Th></Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td><strong>{i.product_name}</strong></Td>
                <Td>{i.version}</Td>
                <Td><Label color={phaseColor(i.current_phase)} isCompact>{i.current_phase || "—"}</Label></Td>
                <Td>{i.ga_date}</Td>
                <Td>{i.full_support_end}</Td>
                <Td>{i.maintenance_end}</Td>
                <Td>{i.eus_end || "—"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
