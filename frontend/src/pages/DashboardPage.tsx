import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Card,
  CardBody,
  CardTitle,
  CardFooter,
  Grid,
  GridItem,
  Spinner,
  Alert,
  EmptyState,
  EmptyStateBody,
  Label,
  Button,
} from "@patternfly/react-core";
import {
  ExclamationTriangleIcon,
  BookOpenIcon,
  CalendarAltIcon,
  UsersIcon,
  CogIcon,
  ArrowRightIcon,
} from "@patternfly/react-icons";
import api from "../services/api";
import type { AnalyticsOverview, ChartDataPoint } from "../types/models";

interface RecentGuide {
  id: number;
  title: string;
  touchpoint_date: string;
  status: string;
  customer?: { name: string };
  product?: { name: string };
  document_type?: { name: string };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [byType, setByType] = useState<ChartDataPoint[]>([]);
  const [byCustomer, setByCustomer] = useState<ChartDataPoint[]>([]);
  const [byProduct, setByProduct] = useState<ChartDataPoint[]>([]);
  const [recentGuides, setRecentGuides] = useState<RecentGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/by-type"),
      api.get("/analytics/by-customer"),
      api.get("/analytics/by-product"),
      api.get("/analytics/recent-guides"),
    ])
      .then(([ov, bt, bc, bp, rg]) => {
        setOverview(ov.data);
        setByType(bt.data);
        setByCustomer(bc.data);
        setByProduct(bp.data);
        setRecentGuides(rg.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load dashboard data");
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
      <EmptyState headingLevel="h2" titleText="No data available" icon={ExclamationTriangleIcon}>
        <EmptyStateBody>Dashboard analytics could not be retrieved.</EmptyStateBody>
      </EmptyState>
    );
  }

  const statCards = [
    { label: "Total Guides", value: overview.total_guides, icon: <BookOpenIcon />, color: "#0066CC" },
    { label: "This Month", value: overview.guides_this_month, icon: <CalendarAltIcon />, color: "#3E8635" },
    { label: "Customers", value: overview.total_customers, icon: <UsersIcon />, color: "#EC7A08" },
    { label: "Active Providers", value: overview.active_providers, icon: <CogIcon />, color: "#6753AC" },
  ];

  const maxByType = Math.max(...byType.map((d) => d.value), 1);
  const maxByCustomer = Math.max(...byCustomer.map((d) => d.value), 1);
  const maxByProduct = Math.max(...byProduct.map((d) => d.value), 1);

  const barColors = ["#0066CC", "#CC0000", "#3E8635", "#EC7A08", "#6753AC", "#009596", "#8B0000", "#A30000"];

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      <Grid hasGutter>
        {statCards.map((stat) => (
          <GridItem key={stat.label} md={3} sm={6}>
            <Card isFullHeight>
              <CardBody>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: stat.color, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: "1.3rem",
                    }}
                  >
                    {stat.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                      {stat.label}
                    </div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, fontFamily: "Red Hat Display, sans-serif" }}>
                      {stat.value}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </GridItem>
        ))}

        <GridItem md={8} sm={12}>
          <Card isFullHeight>
            <CardTitle>Recent Guides</CardTitle>
            <CardBody style={{ padding: 0 }}>
              {recentGuides.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--pf-t--global--text--color--subtle)" }}>
                  No guides created yet
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {recentGuides.map((g) => (
                      <tr
                        key={g.id}
                        style={{ borderBottom: "1px solid var(--pf-t--global--border--color--default)", cursor: "pointer" }}
                        onClick={() => navigate(`/guides/${g.id}`)}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 500 }}>{g.title}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--pf-t--global--text--color--subtle)", marginTop: 2 }}>
                            {g.customer?.name} · {g.product?.name}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <Label color={g.document_type?.name === "RCA" ? "red" : "blue"} isCompact>
                            {g.document_type?.name}
                          </Label>
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--pf-t--global--text--color--subtle)", fontSize: "0.85rem" }}>
                          {g.touchpoint_date}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Label
                            color={g.status === "generated" ? "green" : g.status === "error" ? "red" : "grey"}
                            isCompact
                          >
                            {g.status}
                          </Label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
            <CardFooter>
              <Button variant="link" onClick={() => navigate("/guides")} icon={<ArrowRightIcon />} iconPosition="end">
                View all guides
              </Button>
            </CardFooter>
          </Card>
        </GridItem>

        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>Guides by Document Type</CardTitle>
            <CardBody>
              {byType.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byType.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span>
                        <span style={{ fontWeight: 600 }}>{d.value}</span>
                      </div>
                      <div style={{ background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(d.value / maxByType) * 100}%`, height: "100%", background: barColors[i % barColors.length], borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </GridItem>

        <GridItem md={6} sm={12}>
          <Card isFullHeight>
            <CardTitle>Guides by Customer</CardTitle>
            <CardBody>
              {byCustomer.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byCustomer.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span>
                        <span style={{ fontWeight: 600 }}>{d.value}</span>
                      </div>
                      <div style={{ background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(d.value / maxByCustomer) * 100}%`, height: "100%", background: barColors[i % barColors.length], borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </GridItem>

        <GridItem md={6} sm={12}>
          <Card isFullHeight>
            <CardTitle>Guides by Product</CardTitle>
            <CardBody>
              {byProduct.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byProduct.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span>
                        <span style={{ fontWeight: 600 }}>{d.value}</span>
                      </div>
                      <div style={{ background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${(d.value / maxByProduct) * 100}%`, height: "100%", background: barColors[i % barColors.length], borderRadius: 4, transition: "width 0.6s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </>
  );
}
