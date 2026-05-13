import { useState, useEffect } from "react";
import { Title, Spinner, EmptyState, EmptyStateBody, Card, CardBody } from "@patternfly/react-core";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function TouchpointsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/touchpoints", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Title headingLevel="h1">Touchpoints — {scope}</Title>
      {items.length === 0 ? (
        <EmptyState><EmptyStateBody>No touchpoints recorded.</EmptyStateBody></EmptyState>
      ) : (
        <div style={{ marginTop: 16 }}>
          {items.map((t) => (
            <Card key={t.id} isCompact style={{ marginBottom: 12 }}>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{t.touchpoint_date}</strong>
                  {t.customer_area && <span style={{ opacity: 0.7 }}>{t.customer_area}</span>}
                </div>
                {t.participants && <div style={{ marginTop: 4, fontSize: "0.9em", opacity: 0.8 }}>Participants: {t.participants}</div>}
                {t.topics && <div style={{ marginTop: 4 }}>{t.topics}</div>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
