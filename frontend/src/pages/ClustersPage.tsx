import { useState, useEffect, useCallback } from "react";
import {
  Title, Spinner, EmptyState, EmptyStateBody, Label,
  Card, CardBody, Grid, GridItem, Button, Alert,
  Toolbar, ToolbarContent, ToolbarItem,
} from "@patternfly/react-core";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import { useAccount } from "../context/AccountContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

interface Cluster {
  id: number;
  display_name: string | null;
  external_cluster_id: string;
  openshift_version: string | null;
  health_state: string | null;
  master_nodes: number | null;
  compute_nodes: number | null;
  vcpu_total: number | null;
  memory_gb: number | null;
  critical_alerts: number | null;
  console_url: string | null;
  cloud_provider: string | null;
  upgrade_available: string | null;
}

export function ClustersPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/clusters", { params }).then(({ data }) => setClusters(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("clusters");
    if (result) fetchData();
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  const healthColor = (h: string | null) => {
    if (h === "healthy") return "green";
    if (h === "unhealthy") return "red";
    if (h === "warning") return "orange";
    return "grey";
  };

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Clusters — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {selectedAccountId && (
              <Button
                variant="secondary"
                icon={<SyncAltIcon />}
                isLoading={syncing}
                isDisabled={syncing}
                onClick={handleSync}
              >
                Sync from OCM
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}
      {clusters.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {selectedAccountId
              ? "No clusters registered. Click \"Sync from OCM\" to pull data."
              : "Select an account to view clusters."}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <Grid hasGutter style={{ marginTop: 16 }}>
          {clusters.map((c) => (
            <GridItem key={c.id} sm={12} md={6} lg={4}>
              <Card isCompact>
                <CardBody>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{c.display_name || c.external_cluster_id.slice(0, 8)}</strong>
                    <Label color={healthColor(c.health_state)} isCompact>{c.health_state || "unknown"}</Label>
                  </div>
                  <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                    {c.openshift_version && <span>OCP {c.openshift_version} · </span>}
                    {c.master_nodes != null && <span>M:{c.master_nodes} </span>}
                    {c.compute_nodes != null && <span>W:{c.compute_nodes} · </span>}
                    {c.vcpu_total != null && <span>{c.vcpu_total} vCPU · </span>}
                    {c.memory_gb != null && <span>{c.memory_gb} GB · </span>}
                    {c.cloud_provider && <span>{c.cloud_provider}</span>}
                  </div>
                  {(c.critical_alerts ?? 0) > 0 && (
                    <Label color="red" isCompact style={{ marginTop: 8 }}>
                      {c.critical_alerts} critical alerts
                    </Label>
                  )}
                  {c.upgrade_available && (
                    <Label color="blue" isCompact style={{ marginTop: 8, marginLeft: 4 }}>
                      Upgrade: {c.upgrade_available}
                    </Label>
                  )}
                  {c.console_url && (
                    <div style={{ marginTop: 8 }}>
                      <a href={c.console_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85em" }}>Console</a>
                    </div>
                  )}
                </CardBody>
              </Card>
            </GridItem>
          ))}
        </Grid>
      )}
    </>
  );
}
