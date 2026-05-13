import { useState, useEffect } from "react";
import { Title, Spinner, EmptyState, EmptyStateBody, Label } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function IssuesPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/issues", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Title headingLevel="h1">Issues — {scope}</Title>
      {items.length === 0 ? (
        <EmptyState><EmptyStateBody>No issues tracked.</EmptyStateBody></EmptyState>
      ) : (
        <Table aria-label="Issues" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Key</Th><Th>Summary</Th><Th>Status</Th><Th>Priority</Th><Th>Assignee</Th></Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td><strong>{i.key}</strong></Td>
                <Td>{i.summary}</Td>
                <Td><Label isCompact>{i.status}</Label></Td>
                <Td>{i.priority}</Td>
                <Td>{i.assignee}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
