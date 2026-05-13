import { useState, useEffect, useCallback } from "react";
import {
  Title, Spinner, EmptyState, EmptyStateBody, Label,
  Tabs, Tab, TabTitleText, Button, Alert,
  Toolbar, ToolbarContent, ToolbarItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import { useAccount } from "../context/AccountContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

export function ContactsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | number>("customer");
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/contacts", { params }).then(({ data }) => setContacts(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("contacts");
    if (result) fetchData();
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  const filtered = contacts.filter((c) => c.team === activeTab);

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Contacts — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync from Hydra
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}
      <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key)} style={{ marginTop: 16 }}>
        <Tab eventKey="customer" title={<TabTitleText>Customer Team</TabTitleText>} />
        <Tab eventKey="redhat" title={<TabTitleText>Red Hat Team</TabTitleText>} />
      </Tabs>
      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {activeTab === "customer" && selectedAccountId
              ? "No customer contacts. Click \"Sync from Hydra\" to pull data."
              : "No contacts in this category."}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Contacts" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Title</Th><Th>Area</Th><Th>Flags</Th></Tr></Thead>
          <Tbody>
            {filtered.map((c) => (
              <Tr key={c.id}>
                <Td><strong>{c.name}</strong></Td>
                <Td>{c.email}</Td>
                <Td>{c.phone}</Td>
                <Td>{c.title}</Td>
                <Td>{c.area}</Td>
                <Td>
                  {c.is_tam_contact && <Label color="blue" isCompact style={{ marginRight: 4 }}>TAM</Label>}
                  {c.is_org_admin && <Label color="purple" isCompact>Admin</Label>}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
