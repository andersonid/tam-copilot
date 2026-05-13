import { useState, useEffect } from "react";
import { Title, Spinner, EmptyState, EmptyStateBody, Label } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function RisksPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/risks", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  const impactColor = (i: string | null) => {
    if (i === "Critical") return "red";
    if (i === "High") return "orange";
    if (i === "Medium") return "yellow";
    return "grey";
  };

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Title headingLevel="h1">Risks — {scope}</Title>
      {items.length === 0 ? (
        <EmptyState><EmptyStateBody>No risks registered.</EmptyStateBody></EmptyState>
      ) : (
        <Table aria-label="Risks" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Name</Th><Th>Description</Th><Th>Probability</Th><Th>Impact</Th><Th>Area</Th><Th>Status</Th></Tr></Thead>
          <Tbody>
            {items.map((r) => (
              <Tr key={r.id}>
                <Td><strong>{r.short_name}</strong></Td>
                <Td>{r.description}</Td>
                <Td>{r.probability}</Td>
                <Td><Label color={impactColor(r.impact)} isCompact>{r.impact || "—"}</Label></Td>
                <Td>{r.customer_area}</Td>
                <Td><Label isCompact>{r.status}</Label></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
