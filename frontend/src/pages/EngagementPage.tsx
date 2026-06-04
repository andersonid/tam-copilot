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

interface Engagement {
  id: number;
  account_id: number;
  customer_area: string | null;
  adoption_difficulty: string | null;
  customer_knowledge: string | null;
  team_turnover: string | null;
  py_engagement: string | null;
  q1_engagement: string | null;
  q2_engagement: string | null;
  q3_engagement: string | null;
  q4_engagement: string | null;
  year: number;
  updated_at: string;
}

const engColor = (v: string | null) => {
  if (!v) return "grey";
  const lower = v.toLowerCase();
  if (lower === "high" || lower === "green") return "green";
  if (lower === "medium" || lower === "yellow") return "gold";
  if (lower === "low" || lower === "red") return "red";
  return "grey";
};

const LEVELS = ["", "High", "Medium", "Low"];

const currentYear = new Date().getFullYear();

const emptyForm = {
  customer_area: "",
  adoption_difficulty: "",
  customer_knowledge: "",
  team_turnover: "",
  py_engagement: "",
  q1_engagement: "",
  q2_engagement: "",
  q3_engagement: "",
  q4_engagement: "",
  year: currentYear.toString(),
};

export function EngagementPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Engagement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Engagement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/engagements", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const years = [...new Set(items.map((e) => e.year))].sort((a, b) => b - a);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (e: Engagement) => {
    setEditTarget(e);
    setForm({
      customer_area: e.customer_area ?? "",
      adoption_difficulty: e.adoption_difficulty ?? "",
      customer_knowledge: e.customer_knowledge ?? "",
      team_turnover: e.team_turnover ?? "",
      py_engagement: e.py_engagement ?? "",
      q1_engagement: e.q1_engagement ?? "",
      q2_engagement: e.q2_engagement ?? "",
      q3_engagement: e.q3_engagement ?? "",
      q4_engagement: e.q4_engagement ?? "",
      year: e.year.toString(),
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.year) return;
    setSaving(true);
    try {
      const payload = {
        customer_area: form.customer_area || null,
        adoption_difficulty: form.adoption_difficulty || null,
        customer_knowledge: form.customer_knowledge || null,
        team_turnover: form.team_turnover || null,
        py_engagement: form.py_engagement || null,
        q1_engagement: form.q1_engagement || null,
        q2_engagement: form.q2_engagement || null,
        q3_engagement: form.q3_engagement || null,
        q4_engagement: form.q4_engagement || null,
        year: parseInt(form.year),
      };
      if (editTarget) {
        await api.patch(`/engagements/${editTarget.id}`, payload);
      } else {
        await api.post("/engagements", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/engagements/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const filtered = yearFilter === "all" ? items : items.filter((e) => e.year.toString() === yearFilter);
  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Engagement — {scope}</Title></ToolbarItem>
          <ToolbarItem>
            <FormSelect value={yearFilter} onChange={(_e, v) => setYearFilter(v)} aria-label="Year filter" style={{ width: 130 }}>
              <FormSelectOption value="all" label="All years" />
              {years.map((y) => <FormSelectOption key={y} value={y.toString()} label={y.toString()} />)}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Row</Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No engagement data recorded{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Row</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Engagement" variant="compact">
          <Thead><Tr>
            <Th>Area</Th><Th>Year</Th><Th>Adoption</Th><Th>Knowledge</Th><Th>Turnover</Th>
            <Th>PY</Th><Th>Q1</Th><Th>Q2</Th><Th>Q3</Th><Th>Q4</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {filtered.map((e) => (
              <Tr key={e.id}>
                <Td dataLabel="Area"><strong>{e.customer_area || "—"}</strong></Td>
                <Td dataLabel="Year">{e.year}</Td>
                <Td dataLabel="Adoption">
                  {e.adoption_difficulty ? <Label isCompact color={engColor(e.adoption_difficulty)}>{e.adoption_difficulty}</Label> : "—"}
                </Td>
                <Td dataLabel="Knowledge">
                  {e.customer_knowledge ? <Label isCompact color={engColor(e.customer_knowledge)}>{e.customer_knowledge}</Label> : "—"}
                </Td>
                <Td dataLabel="Turnover">
                  {e.team_turnover ? <Label isCompact color={engColor(e.team_turnover)}>{e.team_turnover}</Label> : "—"}
                </Td>
                <Td dataLabel="PY">
                  {e.py_engagement ? <Label isCompact color={engColor(e.py_engagement)}>{e.py_engagement}</Label> : "—"}
                </Td>
                <Td dataLabel="Q1">
                  {e.q1_engagement ? <Label isCompact color={engColor(e.q1_engagement)}>{e.q1_engagement}</Label> : "—"}
                </Td>
                <Td dataLabel="Q2">
                  {e.q2_engagement ? <Label isCompact color={engColor(e.q2_engagement)}>{e.q2_engagement}</Label> : "—"}
                </Td>
                <Td dataLabel="Q3">
                  {e.q3_engagement ? <Label isCompact color={engColor(e.q3_engagement)}>{e.q3_engagement}</Label> : "—"}
                </Td>
                <Td dataLabel="Q4">
                  {e.q4_engagement ? <Label isCompact color={engColor(e.q4_engagement)}>{e.q4_engagement}</Label> : "—"}
                </Td>
                {canWrite && (
                  <Td isActionCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button variant="plain" onClick={() => openEdit(e)} aria-label="Edit"><PencilAltIcon /></Button>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(e)} aria-label="Delete"><TrashIcon /></Button>
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
        <ModalHeader title={editTarget ? "Edit Engagement" : "Add Engagement Row"} />
        <ModalBody>
          <Form>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <FormGroup label="Customer Area" fieldId="eng-area">
                <TextInput id="eng-area" value={form.customer_area} onChange={(_e, v) => setForm({ ...form, customer_area: v })} placeholder="e.g. Infrastructure" />
              </FormGroup>
              <FormGroup label="Year" isRequired fieldId="eng-year">
                <TextInput id="eng-year" type="number" value={form.year} onChange={(_e, v) => setForm({ ...form, year: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Adoption Difficulty" fieldId="eng-adopt">
                <FormSelect id="eng-adopt" value={form.adoption_difficulty} onChange={(_e, v) => setForm({ ...form, adoption_difficulty: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Customer Knowledge" fieldId="eng-know">
                <FormSelect id="eng-know" value={form.customer_knowledge} onChange={(_e, v) => setForm({ ...form, customer_knowledge: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Team Turnover" fieldId="eng-turn">
                <FormSelect id="eng-turn" value={form.team_turnover} onChange={(_e, v) => setForm({ ...form, team_turnover: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="PY" fieldId="eng-py">
                <FormSelect id="eng-py" value={form.py_engagement} onChange={(_e, v) => setForm({ ...form, py_engagement: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Q1" fieldId="eng-q1">
                <FormSelect id="eng-q1" value={form.q1_engagement} onChange={(_e, v) => setForm({ ...form, q1_engagement: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Q2" fieldId="eng-q2">
                <FormSelect id="eng-q2" value={form.q2_engagement} onChange={(_e, v) => setForm({ ...form, q2_engagement: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Q3" fieldId="eng-q3">
                <FormSelect id="eng-q3" value={form.q3_engagement} onChange={(_e, v) => setForm({ ...form, q3_engagement: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Q4" fieldId="eng-q4">
                <FormSelect id="eng-q4" value={form.q4_engagement} onChange={(_e, v) => setForm({ ...form, q4_engagement: v })}>
                  {LEVELS.map((l) => <FormSelectOption key={l} value={l} label={l || "—"} />)}
                </FormSelect>
              </FormGroup>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.year}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Engagement Row" />
        <ModalBody>
          Are you sure you want to delete this engagement row
          {deleteTarget?.customer_area ? ` for "${deleteTarget.customer_area}"` : ""} ({deleteTarget?.year})?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
