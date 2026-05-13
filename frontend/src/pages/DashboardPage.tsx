import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title, Card, CardBody, CardTitle, CardFooter,
  Grid, GridItem, Spinner, Alert, EmptyState, EmptyStateBody,
  Label, Button, Toolbar, ToolbarContent, ToolbarItem,
  DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription,
} from "@patternfly/react-core";
import {
  ExclamationTriangleIcon, BookOpenIcon, CalendarAltIcon,
  UsersIcon, CogIcon, ArrowRightIcon,
} from "@patternfly/react-icons";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import { useAccount } from "../context/AccountContext";
import { useSync } from "../hooks/useSync";
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
  const { selectedAccountId, selectedAccount, accounts } = useAccount();

  return selectedAccountId && selectedAccount
    ? <AccountDashboard accountId={selectedAccountId} account={selectedAccount} />
    : <GlobalDashboard totalAccounts={accounts.length} />;
}

function AccountDashboard({ accountId, account }: { accountId: number; account: any }) {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [touchpoints, setTouchpoints] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(accountId);

  const fetchAll = useCallback(() => {
    setLoading(true);
    const p = { account_id: accountId };
    Promise.all([
      api.get("/clusters", { params: p }),
      api.get("/risks", { params: p }),
      api.get("/action-plans", { params: p }),
      api.get("/touchpoints", { params: p }),
      api.get("/entitlements", { params: p }),
    ]).then(([cl, ri, ap, tp, en]) => {
      setClusters(cl.data);
      setRisks(ri.data);
      setActionPlans(ap.data);
      setTouchpoints(tp.data);
      setEntitlements(en.data);
    }).finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSyncAll = async () => {
    await triggerSync("all");
    fetchAll();
  };

  if (loading) return <Spinner aria-label="Loading" />;

  const unhealthy = clusters.filter((c) => c.health_state === "unhealthy" || (c.critical_alerts ?? 0) > 0);
  const openRisks = risks.filter((r) => r.status === "Open");
  const completedPlans = actionPlans.filter((a) => a.status === "Done" || a.status === "Completed");
  const lastTouchpoint = touchpoints[0];
  const expiringEntitlements = entitlements.filter((e) => {
    if (!e.end_date) return false;
    const diff = (new Date(e.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 90;
  });

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Title headingLevel="h1" size="2xl">{account.name}</Title>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSyncAll}>
              Sync All
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}

      <Grid hasGutter style={{ marginTop: 8 }}>
        {/* Summary */}
        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>Account Summary</CardTitle>
            <CardBody>
              <DescriptionList isCompact>
                <DescriptionListGroup>
                  <DescriptionListTerm>Account Number</DescriptionListTerm>
                  <DescriptionListDescription>{account.account_number}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Region</DescriptionListTerm>
                  <DescriptionListDescription>{account.region || "—"}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Country</DescriptionListTerm>
                  <DescriptionListDescription>{account.country || "—"}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>TAM Type</DescriptionListTerm>
                  <DescriptionListDescription>{account.tam_type || "—"}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>
        </GridItem>

        {/* Cluster Health */}
        <GridItem md={4} sm={6}>
          <Card isFullHeight isClickable onClick={() => navigate("/clusters")}>
            <CardTitle>Cluster Health</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "Red Hat Display, sans-serif" }}>
                {clusters.length}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                clusters registered
              </div>
              {unhealthy.length > 0 && (
                <Label color="red" isCompact style={{ marginTop: 8 }}>
                  {unhealthy.length} unhealthy
                </Label>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* Action Plan */}
        <GridItem md={4} sm={6}>
          <Card isFullHeight isClickable onClick={() => navigate("/action-plan")}>
            <CardTitle>Action Plan</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "Red Hat Display, sans-serif" }}>
                {completedPlans.length}/{actionPlans.length}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                initiatives completed
              </div>
              {actionPlans.length > 0 && (
                <div style={{ marginTop: 8, background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 4, height: 8 }}>
                  <div style={{
                    width: `${(completedPlans.length / actionPlans.length) * 100}%`,
                    height: "100%", background: "#3E8635", borderRadius: 4, transition: "width 0.6s ease",
                  }} />
                </div>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* Risks */}
        <GridItem md={4} sm={6}>
          <Card isFullHeight isClickable onClick={() => navigate("/risks")}>
            <CardTitle>Active Risks</CardTitle>
            <CardBody>
              {openRisks.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No open risks</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {openRisks.slice(0, 5).map((r) => (
                    <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Label
                        color={r.impact === "Critical" ? "red" : r.impact === "High" ? "orange" : "grey"}
                        isCompact
                      >
                        {r.impact}
                      </Label>
                      <span style={{ fontSize: "0.85rem" }}>{r.short_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* Last Touchpoint */}
        <GridItem md={4} sm={6}>
          <Card isFullHeight isClickable onClick={() => navigate("/touchpoints")}>
            <CardTitle>Last Touchpoint</CardTitle>
            <CardBody>
              {lastTouchpoint ? (
                <>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>{lastTouchpoint.touchpoint_date}</div>
                  <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)", marginTop: 4 }}>
                    {lastTouchpoint.topics || "—"}
                  </div>
                  <div style={{ fontSize: "0.8rem", marginTop: 4 }}>{lastTouchpoint.participants || "—"}</div>
                </>
              ) : (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No touchpoints recorded</div>
              )}
            </CardBody>
          </Card>
        </GridItem>

        {/* Expiring Entitlements */}
        <GridItem md={4} sm={6}>
          <Card isFullHeight isClickable onClick={() => navigate("/entitlements")}>
            <CardTitle>Entitlements</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2.5rem", fontWeight: 700, fontFamily: "Red Hat Display, sans-serif" }}>
                {entitlements.length}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                active entitlements
              </div>
              {expiringEntitlements.length > 0 && (
                <Label color="orange" isCompact style={{ marginTop: 8 }}>
                  {expiringEntitlements.length} expiring in 90 days
                </Label>
              )}
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </>
  );
}

function GlobalDashboard({ totalAccounts }: { totalAccounts: number }) {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [byType, setByType] = useState<ChartDataPoint[]>([]);
  const [byCustomer, setByCustomer] = useState<ChartDataPoint[]>([]);
  const [byProduct, setByProduct] = useState<ChartDataPoint[]>([]);
  const [recentGuides, setRecentGuides] = useState<RecentGuide[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/by-type"),
      api.get("/analytics/by-customer"),
      api.get("/analytics/by-product"),
      api.get("/analytics/recent-guides"),
      api.get("/clusters"),
    ]).then(([ov, bt, bc, bp, rg, cl]) => {
      setOverview(ov.data);
      setByType(bt.data);
      setByCustomer(bc.data);
      setByProduct(bp.data);
      setRecentGuides(rg.data);
      setClusters(cl.data);
      setLoading(false);
    }).catch((err) => {
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load dashboard data");
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner aria-label="Loading" />;
  if (error) return <Alert variant="danger" title="Failed to load dashboard" isInline>{error}</Alert>;
  if (!overview) {
    return (
      <EmptyState headingLevel="h2" titleText="No data available" icon={ExclamationTriangleIcon}>
        <EmptyStateBody>Dashboard analytics could not be retrieved.</EmptyStateBody>
      </EmptyState>
    );
  }

  const unhealthyClusters = clusters.filter((c: any) => c.health_state === "unhealthy" || (c.critical_alerts ?? 0) > 0);

  const statCards = [
    { label: "Accounts", value: totalAccounts, icon: <UsersIcon />, color: "#0066CC" },
    { label: "Total Guides", value: overview.total_guides, icon: <BookOpenIcon />, color: "#3E8635" },
    { label: "This Month", value: overview.guides_this_month, icon: <CalendarAltIcon />, color: "#EC7A08" },
    { label: "Active Providers", value: overview.active_providers, icon: <CogIcon />, color: "#6753AC" },
  ];

  const maxByType = Math.max(...byType.map((d) => d.value), 1);
  const maxByCustomer = Math.max(...byCustomer.map((d) => d.value), 1);
  const maxByProduct = Math.max(...byProduct.map((d) => d.value), 1);
  const barColors = ["#0066CC", "#CC0000", "#3E8635", "#EC7A08", "#6753AC", "#009596", "#8B0000", "#A30000"];

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>Dashboard — Global</Title>

      <Grid hasGutter>
        {statCards.map((stat) => (
          <GridItem key={stat.label} md={3} sm={6}>
            <Card isFullHeight>
              <CardBody>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: stat.color, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "1.3rem",
                  }}>
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

        {/* Unhealthy clusters alert */}
        {unhealthyClusters.length > 0 && (
          <GridItem md={12}>
            <Alert variant="warning" title={`${unhealthyClusters.length} unhealthy cluster(s) across accounts`} isInline>
              {unhealthyClusters.slice(0, 5).map((c: any) => (
                <div key={c.id}>{c.display_name || c.external_cluster_id} — {c.health_state} ({c.critical_alerts ?? 0} alerts)</div>
              ))}
            </Alert>
          </GridItem>
        )}

        <GridItem md={8} sm={12}>
          <Card isFullHeight>
            <CardTitle>Recent Guides</CardTitle>
            <CardBody style={{ padding: 0 }}>
              {recentGuides.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--pf-t--global--text--color--subtle)" }}>No guides created yet</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {recentGuides.map((g) => (
                      <tr key={g.id} style={{ borderBottom: "1px solid var(--pf-t--global--border--color--default)", cursor: "pointer" }} onClick={() => navigate(`/guides/${g.id}`)}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 500 }}>{g.title}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--pf-t--global--text--color--subtle)", marginTop: 2 }}>
                            {g.customer?.name} · {g.product?.name}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <Label color={g.document_type?.name === "RCA" ? "red" : "blue"} isCompact>{g.document_type?.name}</Label>
                        </td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "var(--pf-t--global--text--color--subtle)", fontSize: "0.85rem" }}>{g.touchpoint_date}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <Label color={g.status === "generated" ? "green" : g.status === "error" ? "red" : "grey"} isCompact>{g.status}</Label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
            <CardFooter>
              <Button variant="link" onClick={() => navigate("/guides")} icon={<ArrowRightIcon />} iconPosition="end">View all guides</Button>
            </CardFooter>
          </Card>
        </GridItem>

        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>By Document Type</CardTitle>
            <CardBody>
              {byType.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byType.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span><span style={{ fontWeight: 600 }}>{d.value}</span>
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
            <CardTitle>By Customer</CardTitle>
            <CardBody>
              {byCustomer.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byCustomer.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span><span style={{ fontWeight: 600 }}>{d.value}</span>
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
            <CardTitle>By Product</CardTitle>
            <CardBody>
              {byProduct.length === 0 ? (
                <div style={{ color: "var(--pf-t--global--text--color--subtle)" }}>No data</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {byProduct.map((d, i) => (
                    <div key={d.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                        <span>{d.label}</span><span style={{ fontWeight: 600 }}>{d.value}</span>
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
