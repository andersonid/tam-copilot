import { useEffect, useState } from "react";
import {
  Title,
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Spinner,
} from "@patternfly/react-core";
import api from "../services/api";
import type { AnalyticsOverview } from "../types/models";

export function DashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/overview").then((r) => {
      setOverview(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>
        Dashboard
      </Title>
      <Grid hasGutter>
        {[
          { label: "Total Guides", value: overview?.total_guides ?? 0 },
          { label: "This Month", value: overview?.guides_this_month ?? 0 },
          { label: "Customers", value: overview?.total_customers ?? 0 },
          { label: "Active Providers", value: overview?.active_providers ?? 0 },
        ].map((stat) => (
          <GridItem key={stat.label} md={3}>
            <Card isFullHeight>
              <CardTitle>{stat.label}</CardTitle>
              <CardBody>
                <span style={{ fontSize: "2.4rem", fontWeight: 700, fontFamily: "Red Hat Display, sans-serif" }}>
                  {stat.value}
                </span>
              </CardBody>
            </Card>
          </GridItem>
        ))}
      </Grid>
    </>
  );
}
