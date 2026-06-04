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

interface Entitlement {
  id: number;
  account_id: number;
  entitlement_name: string;
  sku: string | null;
  service_level: string | null;
  support_level: string | null;
  start_date: string | null;
  end_date: string | null;
  quantity: number | null;
  synced_at: string;
}

const isExpiring = (d: string | null) => {
  if (!d) return false;
  const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 90;
};

const isExpired = (d: string | null) => d ? new Date(d).getTime() < Date.now() : false;

const emptyForm = {
  entitlement_name: "",
  sku: "",
  service_level: "",
  support_level: "",
  start_date: "",
  end_date: "",
  quantity: "1",
};

export function EntitlementsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";
  const [items, setItems] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Entitlement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entitlement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/entitlements", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("entitlements");
    if (result) fetchData();
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (e: Entitlement) => {
    setEditTarget(e);
    setForm({
      entitlement_name: e.entitlement_name,
      sku: e.sku ?? "",
      service_level: e.service_level ?? "",
      support_level: e.support_level ?? "",
      start_date: e.start_date ?? "",
      end_date: e.end_date ?? "",
      quantity: e.quantity?.toString() ?? "1",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.entitlement_name) return;
    setSaving(true);
    try {
      const payload = {
        entitlement_name: form.entitlement_name,
        sku: form.sku || null,
        service_level: form.service_level || null,
        support_level: form.support_level || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        quantity: form.quantity ? parseInt(form.quantity) : null,
      };
      if (editTarget) {
        await api.patch(`/entitlements/${editTarget.id}`, payload);
      } else {
        await api.post("/entitlements", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/entitlements/${deleteTarget.id}`);
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
          <ToolbarItem><Title headingLevel="h1">Entitlements — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate} style={{ marginRight: 8 }}>
                Add Entitlement
              </Button>
            )}
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync subscriptions (OCM)
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
              ? "No entitlements recorded. Click \"Sync subscriptions\" or add manually."
              : "Select an account to view entitlements."}
          </EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Entitlement</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Entitlements" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr>
            <Th>Name</Th><Th>SKU</Th><Th>Service Level</Th><Th>Support</Th><Th>Start</Th><Th>End</Th><Th>Qty</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td dataLabel="Name"><strong>{i.entitlement_name}</strong></Td>
                <Td dataLabel="SKU">{i.sku ?? "—"}</Td>
                <Td dataLabel="Service Level">{i.service_level ?? "—"}</Td>
                <Td dataLabel="Support">{i.support_level ?? "—"}</Td>
                <Td dataLabel="Start">{i.start_date ?? "—"}</Td>
                <Td dataLabel="End">
                  {i.end_date ?? "—"}
                  {isExpired(i.end_date) && <Label color="red" isCompact style={{ marginLeft: 8 }}>Expired</Label>}
                  {isExpiring(i.end_date) && <Label color="orange" isCompact style={{ marginLeft: 8 }}>Expiring</Label>}
                </Td>
                <Td dataLabel="Qty">{i.quantity ?? "—"}</Td>
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
        <ModalHeader title={editTarget ? "Edit Entitlement" : "Add Entitlement"} />
        <ModalBody>
          <Form>
            <FormGroup label="Entitlement Name" isRequired fieldId="ent-name">
              <TextInput id="ent-name" value={form.entitlement_name} onChange={(_e, v) => setForm({ ...form, entitlement_name: v })} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="SKU" fieldId="ent-sku">
                <TextInput id="ent-sku" value={form.sku} onChange={(_e, v) => setForm({ ...form, sku: v })} />
              </FormGroup>
              <FormGroup label="Quantity" fieldId="ent-qty">
                <TextInput id="ent-qty" type="number" value={form.quantity} onChange={(_e, v) => setForm({ ...form, quantity: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Service Level" fieldId="ent-sl">
                <TextInput id="ent-sl" value={form.service_level} onChange={(_e, v) => setForm({ ...form, service_level: v })} placeholder="Premium, Standard..." />
              </FormGroup>
              <FormGroup label="Support Level" fieldId="ent-sup">
                <TextInput id="ent-sup" value={form.support_level} onChange={(_e, v) => setForm({ ...form, support_level: v })} placeholder="L1-L3, Self-Support..." />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Start Date" fieldId="ent-start">
                <TextInput id="ent-start" type="date" value={form.start_date} onChange={(_e, v) => setForm({ ...form, start_date: v })} />
              </FormGroup>
              <FormGroup label="End Date" fieldId="ent-end">
                <TextInput id="ent-end" type="date" value={form.end_date} onChange={(_e, v) => setForm({ ...form, end_date: v })} />
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.entitlement_name}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Entitlement" />
        <ModalBody>
          Are you sure you want to delete <strong>{deleteTarget?.entitlement_name}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
