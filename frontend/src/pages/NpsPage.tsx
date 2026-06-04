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
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { useAccount } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface NpsSurvey {
  id: number;
  account_id: number;
  tam_user_id: number | null;
  score: number;
  feedback_text: string | null;
  survey_date: string;
  quarter: string | null;
  year: number | null;
  created_at: string;
}

const npsCategory = (score: number) => {
  if (score >= 9) return { label: "Promoter", color: "green" as const };
  if (score >= 7) return { label: "Passive", color: "gold" as const };
  return { label: "Detractor", color: "red" as const };
};

const QUARTERS = ["", "Q1", "Q2", "Q3", "Q4"];

const currentYear = new Date().getFullYear();

const emptyForm = {
  score: "8",
  feedback_text: "",
  survey_date: new Date().toISOString().slice(0, 10),
  quarter: "",
  year: currentYear.toString(),
};

export function NpsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<NpsSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NpsSurvey | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/nps", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (!selectedAccountId) return;
    const score = parseInt(form.score);
    if (isNaN(score) || score < 0 || score > 10) return;
    setSaving(true);
    try {
      await api.post("/nps", {
        account_id: selectedAccountId,
        score,
        feedback_text: form.feedback_text || null,
        survey_date: form.survey_date,
        quarter: form.quarter || null,
        year: form.year ? parseInt(form.year) : null,
      });
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
      await api.delete(`/nps/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  const avgScore = items.length > 0
    ? (items.reduce((sum, n) => sum + n.score, 0) / items.length).toFixed(1)
    : null;

  const promoters = items.filter((n) => n.score >= 9).length;
  const passives = items.filter((n) => n.score >= 7 && n.score < 9).length;
  const detractors = items.filter((n) => n.score < 7).length;
  const npsScore = items.length > 0
    ? Math.round(((promoters - detractors) / items.length) * 100)
    : null;

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">NPS Surveys — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Record Survey</Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {items.length > 0 && (
        <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", padding: "12px 24px", background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 8 }}>
            <div style={{ fontSize: "2em", fontWeight: 700, color: npsScore !== null && npsScore >= 50 ? "var(--pf-t--global--color--status--success--default)" : npsScore !== null && npsScore >= 0 ? "var(--pf-t--global--color--status--warning--default)" : "var(--pf-t--global--color--status--danger--default)" }}>
              {npsScore}
            </div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>NPS Score</div>
          </div>
          <div style={{ textAlign: "center", padding: "12px 24px", background: "var(--pf-t--global--background--color--secondary--default)", borderRadius: 8 }}>
            <div style={{ fontSize: "2em", fontWeight: 700 }}>{avgScore}</div>
            <div style={{ fontSize: "0.85em", opacity: 0.7 }}>Avg Score</div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Label color="green" isCompact>{promoters} Promoters</Label>
            <Label color="gold" isCompact>{passives} Passives</Label>
            <Label color="red" isCompact>{detractors} Detractors</Label>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No NPS surveys recorded{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Record Survey</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="NPS Surveys" variant="compact">
          <Thead><Tr>
            <Th>Date</Th><Th>Score</Th><Th>Category</Th><Th>Quarter</Th><Th>Feedback</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {items.map((n) => {
              const cat = npsCategory(n.score);
              return (
                <Tr key={n.id}>
                  <Td dataLabel="Date">{n.survey_date}</Td>
                  <Td dataLabel="Score"><strong>{n.score}</strong></Td>
                  <Td dataLabel="Category"><Label isCompact color={cat.color}>{cat.label}</Label></Td>
                  <Td dataLabel="Quarter">{n.quarter ? `${n.quarter} ${n.year ?? ""}` : "—"}</Td>
                  <Td dataLabel="Feedback">{n.feedback_text ?? "—"}</Td>
                  {canWrite && (
                    <Td isActionCell>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(n)} aria-label="Delete"><TrashIcon /></Button>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} variant="medium">
        <ModalHeader title="Record NPS Survey" />
        <ModalBody>
          <Form>
            <FormGroup label="Score (0-10)" isRequired fieldId="nps-score">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: "1.5em", fontWeight: 700, minWidth: 32, textAlign: "center" }}>
                  {form.score}
                </span>
                <Label isCompact color={npsCategory(parseInt(form.score)).color}>
                  {npsCategory(parseInt(form.score)).label}
                </Label>
              </div>
            </FormGroup>
            <FormGroup label="Survey Date" fieldId="nps-date">
              <TextInput id="nps-date" type="date" value={form.survey_date} onChange={(_e, v) => setForm({ ...form, survey_date: v })} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Quarter" fieldId="nps-quarter">
                <FormSelect id="nps-quarter" value={form.quarter} onChange={(_e, v) => setForm({ ...form, quarter: v })}>
                  {QUARTERS.map((q) => <FormSelectOption key={q} value={q} label={q || "—"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Year" fieldId="nps-year">
                <TextInput id="nps-year" type="number" value={form.year} onChange={(_e, v) => setForm({ ...form, year: v })} />
              </FormGroup>
            </div>
            <FormGroup label="Feedback" fieldId="nps-feedback">
              <TextArea id="nps-feedback" value={form.feedback_text} onChange={(_e, v) => setForm({ ...form, feedback_text: v })} rows={4} placeholder="Customer feedback comments..." />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving}>Create</Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete NPS Survey" />
        <ModalBody>
          Are you sure you want to delete this NPS survey (score: {deleteTarget?.score}, date: {deleteTarget?.survey_date})?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
