import { useState, useEffect, useCallback } from "react";
import {
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  TextArea,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  Table, Thead, Tbody, Tr, Th, Td,
} from "@patternfly/react-table";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { useAccount } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface Risk {
  id: number;
  account_id: number;
  short_name: string;
  description: string | null;
  probability: string | null;
  impact: string | null;
  customer_area: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const impactColor = (i: string | null) => {
  if (i === "Critical") return "red";
  if (i === "High") return "orange";
  if (i === "Medium") return "gold";
  return "grey";
};

const probColor = (p: string | null) => {
  if (p === "High") return "red";
  if (p === "Medium") return "gold";
  return "green";
};

const statusColor = (s: string) => {
  if (s === "Open") return "orange";
  if (s === "Mitigated") return "blue";
  if (s === "Closed") return "green";
  return "grey";
};

const PROBABILITIES = ["", "Low", "Medium", "High"];
const IMPACTS = ["", "Low", "Medium", "High", "Critical"];
const STATUSES = ["Open", "Mitigated", "Closed"];

const emptyForm = {
  short_name: "",
  description: "",
  probability: "",
  impact: "",
  customer_area: "",
  status: "Open",
};

export function RisksPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Risk | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Risk | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/risks", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: Risk) => {
    setEditTarget(r);
    setForm({
      short_name: r.short_name,
      description: r.description ?? "",
      probability: r.probability ?? "",
      impact: r.impact ?? "",
      customer_area: r.customer_area ?? "",
      status: r.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.short_name) return;
    setSaving(true);
    try {
      const payload = {
        short_name: form.short_name,
        description: form.description || null,
        probability: form.probability || null,
        impact: form.impact || null,
        customer_area: form.customer_area || null,
        status: form.status,
      };
      if (editTarget) {
        await api.patch(`/risks/${editTarget.id}`, payload);
      } else {
        await api.post("/risks", payload, { params: { account_id: selectedAccountId } });
      }
      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.delete(`/risks/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const filtered = statusFilter === "all" ? items : items.filter((r) => r.status === statusFilter);
  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Risks — {scope}</Title></ToolbarItem>
          <ToolbarItem>
            <FormSelect value={statusFilter} onChange={(_e, v) => setStatusFilter(v)} aria-label="Status filter" style={{ width: 160 }}>
              <FormSelectOption value="all" label="All statuses" />
              {STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s} />)}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Risk</Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No risks registered{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Risk</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Risks" variant="compact">
          <Thead><Tr>
            <Th>Name</Th><Th>Description</Th><Th>Probability</Th><Th>Impact</Th><Th>Area</Th><Th>Status</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td dataLabel="Name"><strong>{r.short_name}</strong></Td>
                <Td dataLabel="Description">{r.description ?? "—"}</Td>
                <Td dataLabel="Probability">
                  {r.probability ? <Label isCompact color={probColor(r.probability)}>{r.probability}</Label> : "—"}
                </Td>
                <Td dataLabel="Impact">
                  {r.impact ? <Label isCompact color={impactColor(r.impact)}>{r.impact}</Label> : "—"}
                </Td>
                <Td dataLabel="Area">{r.customer_area ?? "—"}</Td>
                <Td dataLabel="Status"><Label isCompact color={statusColor(r.status)}>{r.status}</Label></Td>
                {canWrite && (
                  <Td isActionCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button variant="plain" onClick={() => openEdit(r)} aria-label="Edit"><PencilAltIcon /></Button>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(r)} aria-label="Delete"><TrashIcon /></Button>
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
        <ModalHeader title={editTarget ? "Edit Risk" : "Add Risk"} />
        <ModalBody>
          <Form>
            <FormGroup label="Name" isRequired fieldId="risk-name">
              <TextInput id="risk-name" value={form.short_name} onChange={(_e, v) => setForm({ ...form, short_name: v })} />
            </FormGroup>
            <FormGroup label="Description" fieldId="risk-desc">
              <TextArea id="risk-desc" value={form.description} onChange={(_e, v) => setForm({ ...form, description: v })} rows={3} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Probability" fieldId="risk-prob">
                <FormSelect id="risk-prob" value={form.probability} onChange={(_e, v) => setForm({ ...form, probability: v })}>
                  {PROBABILITIES.map((p) => <FormSelectOption key={p} value={p} label={p || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Impact" fieldId="risk-impact">
                <FormSelect id="risk-impact" value={form.impact} onChange={(_e, v) => setForm({ ...form, impact: v })}>
                  {IMPACTS.map((i) => <FormSelectOption key={i} value={i} label={i || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <FormGroup label="Customer Area" fieldId="risk-area">
              <TextInput id="risk-area" value={form.customer_area} onChange={(_e, v) => setForm({ ...form, customer_area: v })} />
            </FormGroup>
            <FormGroup label="Status" fieldId="risk-status">
              <FormSelect id="risk-status" value={form.status} onChange={(_e, v) => setForm({ ...form, status: v })}>
                {STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s} />)}
              </FormSelect>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.short_name}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Risk" />
        <ModalBody>
          Are you sure you want to delete risk <strong>{deleteTarget?.short_name}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
