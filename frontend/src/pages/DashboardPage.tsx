import { useEffect, useState } from "react";
import {
  Title,
  Card,
  CardBody,
  CardTitle,
  Grid,
  GridItem,
  Spinner,
  Alert,
  EmptyState,
  EmptyStateBody,
} from "@patternfly/react-core";
import { ExclamationTriangleIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { AnalyticsOverview } from "../types/models";

export function DashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/analytics/overview")
      .then((r) => {
        setOverview(r.data);
        setLoading(false);
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ?? err?.message ?? "Failed to load dashboard data";
        setError(msg);
        setLoading(false);
      });
  }, []);

  if (loading) return <Spinner aria-label="Loading dashboard" />;

  if (error) {
    return (
      <Alert variant="danger" title="Failed to load dashboard" isInline>
        {error}
      </Alert>
    );
  }

  if (!overview) {
    return (
      <EmptyState
        headingLevel="h2"
        titleText="No data available"
        icon={ExclamationTriangleIcon}
      >
        <EmptyStateBody>
          Dashboard analytics could not be retrieved. Try refreshing the page.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>
        Dashboard
      </Title>
      <Grid hasGutter>
        {[
          { label: "Total Guides", value: overview.total_guides ?? 0 },
          { label: "This Month", value: overview.guides_this_month ?? 0 },
          { label: "Customers", value: overview.total_customers ?? 0 },
          { label: "Active Providers", value: overview.active_providers ?? 0 },
        ].map((stat) => (
          <GridItem key={stat.label} md={3}>
            <Card isFullHeight>
              <CardTitle>{stat.label}</CardTitle>
              <CardBody>
                <span
                  style={{
                    fontSize: "2.4rem",
                    fontWeight: 700,
                    fontFamily: "Red Hat Display, sans-serif",
                  }}
                >
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
