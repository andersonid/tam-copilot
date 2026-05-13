import { useState, useEffect } from "react";
import { Title, Spinner, EmptyState, EmptyStateBody } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function EngagementPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/engagements", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Title headingLevel="h1">Engagement — {scope}</Title>
      {items.length === 0 ? (
        <EmptyState><EmptyStateBody>No engagement data recorded.</EmptyStateBody></EmptyState>
      ) : (
        <Table aria-label="Engagement" variant="compact" style={{ marginTop: 16 }}>
          <Thead>
            <Tr>
              <Th>Area</Th><Th>Year</Th><Th>Adoption</Th><Th>Knowledge</Th><Th>Turnover</Th>
              <Th>Q1</Th><Th>Q2</Th><Th>Q3</Th><Th>Q4</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((e) => (
              <Tr key={e.id}>
                <Td><strong>{e.customer_area}</strong></Td>
                <Td>{e.year}</Td>
                <Td>{e.adoption_difficulty}</Td>
                <Td>{e.customer_knowledge}</Td>
                <Td>{e.team_turnover}</Td>
                <Td>{e.q1_engagement}</Td>
                <Td>{e.q2_engagement}</Td>
                <Td>{e.q3_engagement}</Td>
                <Td>{e.q4_engagement}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
