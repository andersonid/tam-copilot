import { useState, useEffect } from "react";
import { Title, Spinner, EmptyState, EmptyStateBody, Label } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function ActionPlanPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/action-plans", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  const statusColor = (s: string) => {
    if (s === "Done") return "green";
    if (s === "Blocked") return "red";
    if (s === "On going") return "blue";
    if (s === "On Hold") return "orange";
    return "grey";
  };

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Title headingLevel="h1">Action Plan — {scope}</Title>
      {items.length === 0 ? (
        <EmptyState><EmptyStateBody>No action plan items.</EmptyStateBody></EmptyState>
      ) : (
        <Table aria-label="Action Plan" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr><Th>Description</Th><Th>Type</Th><Th>Product</Th><Th>Status</Th><Th>Quarter</Th><Th>Owner</Th></Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td>{i.description}</Td>
                <Td>{i.initiative_type}</Td>
                <Td>{i.product}</Td>
                <Td><Label color={statusColor(i.status)} isCompact>{i.status}</Label></Td>
                <Td>{i.start_year && `${i.start_year} ${i.start_quarter || ""}`}</Td>
                <Td>{i.customer_owner}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
