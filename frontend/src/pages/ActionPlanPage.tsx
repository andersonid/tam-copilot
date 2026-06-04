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

interface ActionPlanItem {
  id: number;
  account_id: number;
  description: string;
  initiative_type: string | null;
  problem: string | null;
  expected_outcome: string | null;
  business_impact: string | null;
  risk_level: string | null;
  customer_owner: string | null;
  customer_area: string | null;
  contact_classification: string | null;
  tam_name: string | null;
  dee_name: string | null;
  product: string | null;
  status: string;
  start_year: number | null;
  start_quarter: string | null;
  close_year: number | null;
  close_quarter: string | null;
  details_html: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const statusColor = (s: string) => {
  if (s === "Done") return "green";
  if (s === "Blocked") return "red";
  if (s === "On going") return "blue";
  if (s === "On Hold") return "orange";
  if (s === "Not started yet") return "grey";
  return "grey";
};

const STATUSES = ["Not started yet", "On going", "On Hold", "Blocked", "Done"];
const INITIATIVE_TYPES = ["", "Reactive", "Proactive", "Strategic", "Operational"];
const QUARTERS = ["", "Q1", "Q2", "Q3", "Q4"];

const emptyForm = {
  description: "",
  initiative_type: "",
  problem: "",
  expected_outcome: "",
  business_impact: "",
  risk_level: "",
  customer_owner: "",
  customer_area: "",
  tam_name: "",
  dee_name: "",
  product: "",
  status: "Not started yet",
  start_year: "",
  start_quarter: "",
  close_year: "",
  close_quarter: "",
};

export function ActionPlanPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<ActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ActionPlanItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActionPlanItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/action-plans", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: ActionPlanItem) => {
    setEditTarget(item);
    setForm({
      description: item.description,
      initiative_type: item.initiative_type ?? "",
      problem: item.problem ?? "",
      expected_outcome: item.expected_outcome ?? "",
      business_impact: item.business_impact ?? "",
      risk_level: item.risk_level ?? "",
      customer_owner: item.customer_owner ?? "",
      customer_area: item.customer_area ?? "",
      tam_name: item.tam_name ?? "",
      dee_name: item.dee_name ?? "",
      product: item.product ?? "",
      status: item.status,
      start_year: item.start_year?.toString() ?? "",
      start_quarter: item.start_quarter ?? "",
      close_year: item.close_year?.toString() ?? "",
      close_quarter: item.close_quarter ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.description) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        description: form.description,
        initiative_type: form.initiative_type || null,
        problem: form.problem || null,
        expected_outcome: form.expected_outcome || null,
        business_impact: form.business_impact || null,
        risk_level: form.risk_level || null,
        customer_owner: form.customer_owner || null,
        customer_area: form.customer_area || null,
        tam_name: form.tam_name || null,
        dee_name: form.dee_name || null,
        product: form.product || null,
        status: form.status,
        start_year: form.start_year ? parseInt(form.start_year) : null,
        start_quarter: form.start_quarter || null,
        close_year: form.close_year ? parseInt(form.close_year) : null,
        close_quarter: form.close_quarter || null,
      };
      if (editTarget) {
        await api.patch(`/action-plans/${editTarget.id}`, payload);
      } else {
        await api.post("/action-plans", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/action-plans/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const filtered = statusFilter === "all" ? items : items.filter((i) => i.status === statusFilter);
  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Action Plan — {scope}</Title></ToolbarItem>
          <ToolbarItem>
            <FormSelect value={statusFilter} onChange={(_e, v) => setStatusFilter(v)} aria-label="Status filter" style={{ width: 170 }}>
              <FormSelectOption value="all" label="All statuses" />
              {STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s} />)}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Item</Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No action plan items{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Item</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Action Plan" variant="compact">
          <Thead><Tr>
            <Th>Description</Th><Th>Type</Th><Th>Product</Th><Th>Status</Th><Th>Period</Th><Th>Owner</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {filtered.map((i) => (
              <Tr key={i.id}>
                <Td dataLabel="Description">{i.description}</Td>
                <Td dataLabel="Type">{i.initiative_type ?? "—"}</Td>
                <Td dataLabel="Product">{i.product ?? "—"}</Td>
                <Td dataLabel="Status"><Label color={statusColor(i.status)} isCompact>{i.status}</Label></Td>
                <Td dataLabel="Period">
                  {i.start_year ? `${i.start_year} ${i.start_quarter || ""}` : "—"}
                  {i.close_year ? ` → ${i.close_year} ${i.close_quarter || ""}` : ""}
                </Td>
                <Td dataLabel="Owner">{i.customer_owner ?? "—"}</Td>
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
      <Modal isOpen={modalOpen} onClose={closeModal} variant="large">
        <ModalHeader title={editTarget ? "Edit Action Plan Item" : "Add Action Plan Item"} />
        <ModalBody>
          <Form>
            <FormGroup label="Description" isRequired fieldId="ap-desc">
              <TextArea id="ap-desc" value={form.description} onChange={(_e, v) => setForm({ ...form, description: v })} rows={2} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Initiative Type" fieldId="ap-type">
                <FormSelect id="ap-type" value={form.initiative_type} onChange={(_e, v) => setForm({ ...form, initiative_type: v })}>
                  {INITIATIVE_TYPES.map((t) => <FormSelectOption key={t} value={t} label={t || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Product" fieldId="ap-product">
                <TextInput id="ap-product" value={form.product} onChange={(_e, v) => setForm({ ...form, product: v })} />
              </FormGroup>
              <FormGroup label="Status" fieldId="ap-status">
                <FormSelect id="ap-status" value={form.status} onChange={(_e, v) => setForm({ ...form, status: v })}>
                  {STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <FormGroup label="Problem" fieldId="ap-problem">
              <TextArea id="ap-problem" value={form.problem} onChange={(_e, v) => setForm({ ...form, problem: v })} rows={2} />
            </FormGroup>
            <FormGroup label="Expected Outcome" fieldId="ap-outcome">
              <TextArea id="ap-outcome" value={form.expected_outcome} onChange={(_e, v) => setForm({ ...form, expected_outcome: v })} rows={2} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Business Impact" fieldId="ap-impact">
                <TextInput id="ap-impact" value={form.business_impact} onChange={(_e, v) => setForm({ ...form, business_impact: v })} />
              </FormGroup>
              <FormGroup label="Risk Level" fieldId="ap-risk">
                <TextInput id="ap-risk" value={form.risk_level} onChange={(_e, v) => setForm({ ...form, risk_level: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Customer Owner" fieldId="ap-owner">
                <TextInput id="ap-owner" value={form.customer_owner} onChange={(_e, v) => setForm({ ...form, customer_owner: v })} />
              </FormGroup>
              <FormGroup label="Customer Area" fieldId="ap-area">
                <TextInput id="ap-area" value={form.customer_area} onChange={(_e, v) => setForm({ ...form, customer_area: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="TAM Name" fieldId="ap-tam">
                <TextInput id="ap-tam" value={form.tam_name} onChange={(_e, v) => setForm({ ...form, tam_name: v })} />
              </FormGroup>
              <FormGroup label="DEE Name" fieldId="ap-dee">
                <TextInput id="ap-dee" value={form.dee_name} onChange={(_e, v) => setForm({ ...form, dee_name: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Start Year" fieldId="ap-sy">
                <TextInput id="ap-sy" type="number" value={form.start_year} onChange={(_e, v) => setForm({ ...form, start_year: v })} placeholder="2025" />
              </FormGroup>
              <FormGroup label="Start Quarter" fieldId="ap-sq">
                <FormSelect id="ap-sq" value={form.start_quarter} onChange={(_e, v) => setForm({ ...form, start_quarter: v })}>
                  {QUARTERS.map((q) => <FormSelectOption key={q} value={q} label={q || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Close Year" fieldId="ap-cy">
                <TextInput id="ap-cy" type="number" value={form.close_year} onChange={(_e, v) => setForm({ ...form, close_year: v })} placeholder="2025" />
              </FormGroup>
              <FormGroup label="Close Quarter" fieldId="ap-cq">
                <FormSelect id="ap-cq" value={form.close_quarter} onChange={(_e, v) => setForm({ ...form, close_quarter: v })}>
                  {QUARTERS.map((q) => <FormSelectOption key={q} value={q} label={q || "—"} />)}
                </FormSelect>
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.description}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Action Plan Item" />
        <ModalBody>
          Are you sure you want to delete this action plan item?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
