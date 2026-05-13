import { useEffect, useState } from "react";
import {
  PageSection,
  Content,
  Spinner,
} from "@patternfly/react-core";
import api from "../services/api";

interface Row {
  id: number;
  account_id: number;
  account_name: string;
  account_number: string;
  description: string;
  initiative_type: string | null;
  product: string | null;
  status: string;
  tam_name: string | null;
}

export function ManagerActionPlansPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const page = 1;
  const perPage = 50;

  useEffect(() => {
    setLoading(true);
    api
      .get("/manager/action-plans", { params: { page, size: perPage } })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Action plans — portfolio</Content>
          <Content component="p">Initiatives across all accounts available to your role.</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        {loading ? (
          <Spinner aria-label="Loading" />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="pf-v6-c-table pf-m-grid-md" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Initiative</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>TAM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.account_name} <small>(#{r.account_number})</small></td>
                    <td>{r.description}</td>
                    <td>{r.initiative_type || "—"}</td>
                    <td>{r.product || "—"}</td>
                    <td>{r.status}</td>
                    <td>{r.tam_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </>
  );
}
