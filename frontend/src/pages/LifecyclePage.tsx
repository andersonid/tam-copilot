import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Form,
  FormGroup,
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
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { useAccount } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

interface LifecycleItem {
  id: number;
  account_id: number | null;
  product_name: string;
  version: string;
  current_phase: string | null;
  ga_date: string | null;
  full_support_end: string | null;
  maintenance_end: string | null;
  eus_end: string | null;
  customer_environment: string | null;
  qty_installs: number | null;
  synced_at: string;
}

const phaseColor = (p: string | null) => {
  if (!p) return "grey";
  const lower = p.toLowerCase();
  if (lower.includes("full")) return "green";
  if (lower.includes("maintenance")) return "orange";
  if (lower.includes("extended")) return "blue";
  if (lower.includes("end")) return "red";
  return "grey";
};

const emptyForm = {
  product_name: "",
  version: "",
  current_phase: "",
  ga_date: "",
  full_support_end: "",
  maintenance_end: "",
  eus_end: "",
  customer_environment: "",
  qty_installs: "",
};

export function LifecyclePage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";
  const [items, setItems] = useState<LifecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LifecycleItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LifecycleItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/lifecycle", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("lifecycle");
    if (result) fetchData();
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: LifecycleItem) => {
    setEditTarget(item);
    setForm({
      product_name: item.product_name,
      version: item.version,
      current_phase: item.current_phase ?? "",
      ga_date: item.ga_date ?? "",
      full_support_end: item.full_support_end ?? "",
      maintenance_end: item.maintenance_end ?? "",
      eus_end: item.eus_end ?? "",
      customer_environment: item.customer_environment ?? "",
      qty_installs: item.qty_installs?.toString() ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.product_name || !form.version) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        product_name: form.product_name,
        version: form.version,
        current_phase: form.current_phase || null,
        ga_date: form.ga_date || null,
        full_support_end: form.full_support_end || null,
        maintenance_end: form.maintenance_end || null,
        eus_end: form.eus_end || null,
        customer_environment: form.customer_environment || null,
        qty_installs: form.qty_installs ? parseInt(form.qty_installs) : null,
      };
      if (editTarget) {
        delete payload.product_name;
        delete payload.version;
        await api.patch(`/lifecycle/${editTarget.id}`, payload);
      } else {
        await api.post("/lifecycle", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/lifecycle/${deleteTarget.id}`);
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
          <ToolbarItem><Title headingLevel="h1">Product Lifecycle — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate} style={{ marginRight: 8 }}>
                Add Product
              </Button>
            )}
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync Lifecycle
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}
      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {selectedAccountId
              ? "No lifecycle data. Click \"Sync Lifecycle\" or add products manually."
              : "Select an account to view lifecycle data."}
          </EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Product</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Lifecycle" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr>
            <Th>Product</Th><Th>Version</Th><Th>Phase</Th><Th>GA</Th><Th>Full Support</Th><Th>Maintenance</Th><Th>EUS</Th><Th>Environment</Th><Th>Qty</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td dataLabel="Product"><strong>{i.product_name}</strong></Td>
                <Td dataLabel="Version">{i.version}</Td>
                <Td dataLabel="Phase"><Label color={phaseColor(i.current_phase)} isCompact>{i.current_phase || "—"}</Label></Td>
                <Td dataLabel="GA">{i.ga_date ?? "—"}</Td>
                <Td dataLabel="Full Support">{i.full_support_end ?? "—"}</Td>
                <Td dataLabel="Maintenance">{i.maintenance_end ?? "—"}</Td>
                <Td dataLabel="EUS">{i.eus_end ?? "—"}</Td>
                <Td dataLabel="Environment">{i.customer_environment ?? "—"}</Td>
                <Td dataLabel="Qty">{i.qty_installs ?? "—"}</Td>
                {canWrite && (
                  <Td isActionCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button variant="plain" onClick={() => openEdit(i)} aria-label="Edit"><PencilAltIcon /></Button>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(i)} aria-label="Delete"><TrashIcon /></Button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} variant="medium">
        <ModalHeader title={editTarget ? "Edit Product Lifecycle" : "Add Product Lifecycle"} />
        <ModalBody>
          <Form>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <FormGroup label="Product Name" isRequired fieldId="lc-name">
                <TextInput id="lc-name" value={form.product_name} onChange={(_e, v) => setForm({ ...form, product_name: v })} isDisabled={!!editTarget} placeholder="Red Hat OpenShift Container Platform" />
              </FormGroup>
              <FormGroup label="Version" isRequired fieldId="lc-ver">
                <TextInput id="lc-ver" value={form.version} onChange={(_e, v) => setForm({ ...form, version: v })} isDisabled={!!editTarget} placeholder="4.14" />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Customer Environment" fieldId="lc-env">
                <TextInput id="lc-env" value={form.customer_environment} onChange={(_e, v) => setForm({ ...form, customer_environment: v })} placeholder="Production, Staging, Dev..." />
              </FormGroup>
              <FormGroup label="Qty Installs" fieldId="lc-qty">
                <TextInput id="lc-qty" type="number" value={form.qty_installs} onChange={(_e, v) => setForm({ ...form, qty_installs: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="GA Date" fieldId="lc-ga">
                <TextInput id="lc-ga" type="date" value={form.ga_date} onChange={(_e, v) => setForm({ ...form, ga_date: v })} />
              </FormGroup>
              <FormGroup label="Full Support End" fieldId="lc-full">
                <TextInput id="lc-full" type="date" value={form.full_support_end} onChange={(_e, v) => setForm({ ...form, full_support_end: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Maintenance End" fieldId="lc-maint">
                <TextInput id="lc-maint" type="date" value={form.maintenance_end} onChange={(_e, v) => setForm({ ...form, maintenance_end: v })} />
              </FormGroup>
              <FormGroup label="EUS End" fieldId="lc-eus">
                <TextInput id="lc-eus" type="date" value={form.eus_end} onChange={(_e, v) => setForm({ ...form, eus_end: v })} />
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.product_name || !form.version}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Lifecycle Entry" />
        <ModalBody>
          Are you sure you want to delete <strong>{deleteTarget?.product_name} {deleteTarget?.version}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
