import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Form,
  FormGroup,
  Grid,
  GridItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { useAccount } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

interface Cluster {
  id: number;
  account_id: number;
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
  arch: string | null;
  upgrade_available: string | null;
  synced_at: string;
}

const healthColor = (h: string | null) => {
  if (h === "healthy") return "green";
  if (h === "unhealthy") return "red";
  if (h === "warning") return "orange";
  return "grey";
};

const emptyForm = {
  external_cluster_id: "",
  display_name: "",
  openshift_version: "",
  cloud_provider: "",
  arch: "",
  console_url: "",
  master_nodes: "",
  compute_nodes: "",
  vcpu_total: "",
  memory_gb: "",
  health_state: "",
};

export function ClustersPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cluster | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cluster | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Cluster) => {
    setEditTarget(c);
    setForm({
      external_cluster_id: c.external_cluster_id,
      display_name: c.display_name ?? "",
      openshift_version: c.openshift_version ?? "",
      cloud_provider: c.cloud_provider ?? "",
      arch: c.arch ?? "",
      console_url: c.console_url ?? "",
      master_nodes: c.master_nodes?.toString() ?? "",
      compute_nodes: c.compute_nodes?.toString() ?? "",
      vcpu_total: c.vcpu_total?.toString() ?? "",
      memory_gb: c.memory_gb?.toString() ?? "",
      health_state: c.health_state ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.external_cluster_id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        external_cluster_id: form.external_cluster_id,
        display_name: form.display_name || null,
        openshift_version: form.openshift_version || null,
        cloud_provider: form.cloud_provider || null,
        arch: form.arch || null,
        console_url: form.console_url || null,
        health_state: form.health_state || null,
        master_nodes: form.master_nodes ? parseInt(form.master_nodes) : null,
        compute_nodes: form.compute_nodes ? parseInt(form.compute_nodes) : null,
        vcpu_total: form.vcpu_total ? parseInt(form.vcpu_total) : null,
        memory_gb: form.memory_gb ? parseFloat(form.memory_gb) : null,
      };
      if (editTarget) {
        await api.patch(`/clusters/${editTarget.id}`, payload);
      } else {
        await api.post("/clusters", payload, { params: { account_id: selectedAccountId } });
      }
      closeModal();
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/clusters/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Clusters — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate} style={{ marginRight: 8 }}>
                Add Cluster
              </Button>
            )}
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
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
              ? "No clusters registered. Click \"Sync from OCM\" to pull data, or add manually."
              : "Select an account to view clusters."}
          </EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Cluster</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Grid hasGutter style={{ marginTop: 16 }}>
          {clusters.map((c) => (
            <GridItem key={c.id} sm={12} md={6} lg={4}>
              <Card isCompact>
                <CardBody>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{c.display_name || c.external_cluster_id.slice(0, 8)}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Label color={healthColor(c.health_state)} isCompact>{c.health_state || "unknown"}</Label>
                      {canWrite && (
                        <>
                          <Button variant="plain" onClick={() => openEdit(c)} aria-label="Edit" style={{ padding: 4 }}><PencilAltIcon /></Button>
                          <Button variant="plain" isDanger onClick={() => setDeleteTarget(c)} aria-label="Delete" style={{ padding: 4 }}><TrashIcon /></Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                    {c.openshift_version && <span>OCP {c.openshift_version} · </span>}
                    {c.master_nodes != null && <span>M:{c.master_nodes} </span>}
                    {c.compute_nodes != null && <span>W:{c.compute_nodes} · </span>}
                    {c.vcpu_total != null && <span>{c.vcpu_total} vCPU · </span>}
                    {c.memory_gb != null && <span>{c.memory_gb} GB · </span>}
                    {c.cloud_provider && <span>{c.cloud_provider}</span>}
                    {c.arch && <span> ({c.arch})</span>}
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

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} variant="medium">
        <ModalHeader title={editTarget ? "Edit Cluster" : "Add Cluster"} />
        <ModalBody>
          <Form>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Cluster ID" isRequired fieldId="cl-id">
                <TextInput id="cl-id" value={form.external_cluster_id} onChange={(_e, v) => setForm({ ...form, external_cluster_id: v })} isDisabled={!!editTarget} placeholder="UUID or name" />
              </FormGroup>
              <FormGroup label="Display Name" fieldId="cl-name">
                <TextInput id="cl-name" value={form.display_name} onChange={(_e, v) => setForm({ ...form, display_name: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="OCP Version" fieldId="cl-ver">
                <TextInput id="cl-ver" value={form.openshift_version} onChange={(_e, v) => setForm({ ...form, openshift_version: v })} placeholder="4.14.5" />
              </FormGroup>
              <FormGroup label="Cloud Provider" fieldId="cl-cloud">
                <TextInput id="cl-cloud" value={form.cloud_provider} onChange={(_e, v) => setForm({ ...form, cloud_provider: v })} placeholder="AWS, Azure, Bare Metal..." />
              </FormGroup>
              <FormGroup label="Architecture" fieldId="cl-arch">
                <TextInput id="cl-arch" value={form.arch} onChange={(_e, v) => setForm({ ...form, arch: v })} placeholder="x86_64, aarch64..." />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Master Nodes" fieldId="cl-master">
                <TextInput id="cl-master" type="number" value={form.master_nodes} onChange={(_e, v) => setForm({ ...form, master_nodes: v })} />
              </FormGroup>
              <FormGroup label="Worker Nodes" fieldId="cl-worker">
                <TextInput id="cl-worker" type="number" value={form.compute_nodes} onChange={(_e, v) => setForm({ ...form, compute_nodes: v })} />
              </FormGroup>
              <FormGroup label="vCPU Total" fieldId="cl-vcpu">
                <TextInput id="cl-vcpu" type="number" value={form.vcpu_total} onChange={(_e, v) => setForm({ ...form, vcpu_total: v })} />
              </FormGroup>
              <FormGroup label="Memory (GB)" fieldId="cl-mem">
                <TextInput id="cl-mem" type="number" value={form.memory_gb} onChange={(_e, v) => setForm({ ...form, memory_gb: v })} />
              </FormGroup>
            </div>
            <FormGroup label="Console URL" fieldId="cl-console">
              <TextInput id="cl-console" value={form.console_url} onChange={(_e, v) => setForm({ ...form, console_url: v })} placeholder="https://console-openshift-console.apps..." />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.external_cluster_id}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Cluster" />
        <ModalBody>
          Are you sure you want to delete cluster <strong>{deleteTarget?.display_name || deleteTarget?.external_cluster_id}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
