import { useEffect, useState } from "react";
import { PageSection, Content, Spinner } from "@patternfly/react-core";
import api from "../services/api";

interface Row {
  account_id: number;
  account_name: string;
  account_number: string;
  year: number;
  customer_area: string;
  py_engagement: string | null;
  q1_engagement: string | null;
  q2_engagement: string | null;
  q3_engagement: string | null;
  q4_engagement: string | null;
}

function cellColor(v: string | null) {
  if (!v) return undefined;
  const x = v.toLowerCase();
  if (x === "high") return "#3E8635";
  if (x === "medium") return "#EC7A08";
  if (x === "low") return "#C9190B";
  return undefined;
}

export function ManagerEngagementPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/manager/engagement")
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Engagement — portfolio view</Content>
          <Content component="p">Quarterly levels (Low / Medium / High) by customer area.</Content>
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
                  <th>Area</th>
                  <th>Year</th>
                  <th>Prior year</th>
                  <th>Q1</th>
                  <th>Q2</th>
                  <th>Q3</th>
                  <th>Q4</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.account_id}-${r.customer_area}-${r.year}`}>
                    <td>{r.account_name} <small>(#{r.account_number})</small></td>
                    <td>{r.customer_area}</td>
                    <td>{r.year}</td>
                    <td style={{ color: cellColor(r.py_engagement) }}>{r.py_engagement || "—"}</td>
                    <td style={{ color: cellColor(r.q1_engagement) }}>{r.q1_engagement || "—"}</td>
                    <td style={{ color: cellColor(r.q2_engagement) }}>{r.q2_engagement || "—"}</td>
                    <td style={{ color: cellColor(r.q3_engagement) }}>{r.q3_engagement || "—"}</td>
                    <td style={{ color: cellColor(r.q4_engagement) }}>{r.q4_engagement || "—"}</td>
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
