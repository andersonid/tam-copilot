import { useEffect, useState } from "react";
import { PageSection, Content, Spinner, Grid, GridItem, Card, CardTitle, CardBody } from "@patternfly/react-core";
import api from "../services/api";

interface ChartPoint {
  label: string;
  value: number;
}

interface Reports {
  action_plans_by_status: ChartPoint[];
  action_plans_by_product: ChartPoint[];
}

export function ManagerReportsPage() {
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/manager/reports")
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Reports</Content>
          <Content component="p">Action plan distribution by status and by product.</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Grid hasGutter>
          <GridItem md={6}>
            <Card isFullHeight>
              <CardTitle>By status</CardTitle>
              <CardBody>
                {(data?.action_plans_by_status ?? []).map((d) => (
                  <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span>{d.label}</span>
                    <strong>{d.value}</strong>
                  </div>
                ))}
                {!data?.action_plans_by_status?.length && <span style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</span>}
              </CardBody>
            </Card>
          </GridItem>
          <GridItem md={6}>
            <Card isFullHeight>
              <CardTitle>By product (top)</CardTitle>
              <CardBody>
                {(data?.action_plans_by_product ?? []).map((d) => (
                  <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span>{d.label}</span>
                    <strong>{d.value}</strong>
                  </div>
                ))}
                {!data?.action_plans_by_product?.length && <span style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</span>}
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
}
