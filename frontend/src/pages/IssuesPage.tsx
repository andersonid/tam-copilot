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

interface Issue {
  id: number;
  account_id: number;
  key: string;
  project: string | null;
  summary: string;
  resolution: string | null;
  status: string;
  issue_type: string | null;
  priority: string | null;
  affects_versions: string | null;
  target_version: string | null;
  fix_versions: string | null;
  linked_cases: string | null;
  labels: string | null;
  creator: string | null;
  assignee: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const priorityColor = (p: string | null) => {
  if (p === "Blocker" || p === "Critical") return "red";
  if (p === "Major") return "orange";
  if (p === "Normal" || p === "Minor") return "blue";
  return "grey";
};

const statusColor = (s: string) => {
  if (s === "Open" || s === "New") return "orange";
  if (s === "In Progress") return "blue";
  if (s === "Closed" || s === "Done" || s === "Resolved") return "green";
  return "grey";
};

const STATUSES = ["", "Open", "New", "In Progress", "Closed", "Done", "Resolved"];
const PRIORITIES = ["", "Blocker", "Critical", "Major", "Normal", "Minor"];

const emptyForm = {
  key: "",
  project: "",
  summary: "",
  status: "Open",
  issue_type: "",
  priority: "",
  assignee: "",
  description: "",
  affects_versions: "",
  target_version: "",
  fix_versions: "",
  linked_cases: "",
  labels: "",
};

export function IssuesPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Issue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/issues", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: Issue) => {
    setEditTarget(item);
    setForm({
      key: item.key,
      project: item.project ?? "",
      summary: item.summary,
      status: item.status,
      issue_type: item.issue_type ?? "",
      priority: item.priority ?? "",
      assignee: item.assignee ?? "",
      description: "",
      affects_versions: item.affects_versions ?? "",
      target_version: item.target_version ?? "",
      fix_versions: item.fix_versions ?? "",
      linked_cases: item.linked_cases ?? "",
      labels: item.labels ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.key || !form.summary) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        key: form.key,
        summary: form.summary,
        status: form.status || "Open",
        project: form.project || null,
        issue_type: form.issue_type || null,
        priority: form.priority || null,
        assignee: form.assignee || null,
        affects_versions: form.affects_versions || null,
        target_version: form.target_version || null,
        fix_versions: form.fix_versions || null,
        linked_cases: form.linked_cases || null,
        labels: form.labels || null,
      };
      if (editTarget) {
        delete payload.key;
        await api.patch(`/issues/${editTarget.id}`, payload);
      } else {
        await api.post("/issues", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/issues/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (priorityFilter !== "all" && i.priority !== priorityFilter) return false;
    return true;
  });

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Issues — {scope}</Title></ToolbarItem>
          <ToolbarItem>
            <FormSelect value={statusFilter} onChange={(_e, v) => setStatusFilter(v)} aria-label="Status filter" style={{ width: 150 }}>
              <FormSelectOption value="all" label="All statuses" />
              {STATUSES.filter(Boolean).map((s) => <FormSelectOption key={s} value={s} label={s} />)}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem>
            <FormSelect value={priorityFilter} onChange={(_e, v) => setPriorityFilter(v)} aria-label="Priority filter" style={{ width: 150 }}>
              <FormSelectOption value="all" label="All priorities" />
              {PRIORITIES.filter(Boolean).map((p) => <FormSelectOption key={p} value={p} label={p} />)}
            </FormSelect>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Issue</Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No issues tracked{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Issue</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Issues" variant="compact">
          <Thead><Tr>
            <Th>Key</Th><Th>Summary</Th><Th>Type</Th><Th>Status</Th><Th>Priority</Th><Th>Assignee</Th><Th>Versions</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {filtered.map((i) => (
              <Tr key={i.id}>
                <Td dataLabel="Key"><strong>{i.key}</strong></Td>
                <Td dataLabel="Summary">{i.summary}</Td>
                <Td dataLabel="Type">{i.issue_type ?? "—"}</Td>
                <Td dataLabel="Status"><Label isCompact color={statusColor(i.status)}>{i.status}</Label></Td>
                <Td dataLabel="Priority">
                  {i.priority ? <Label isCompact color={priorityColor(i.priority)}>{i.priority}</Label> : "—"}
                </Td>
                <Td dataLabel="Assignee">{i.assignee ?? "—"}</Td>
                <Td dataLabel="Versions">
                  {i.target_version || i.fix_versions || "—"}
                </Td>
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
        <ModalHeader title={editTarget ? `Edit ${editTarget.key}` : "Add Issue"} />
        <ModalBody>
          <Form>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
              <FormGroup label="Key" isRequired fieldId="iss-key">
                <TextInput id="iss-key" value={form.key} onChange={(_e, v) => setForm({ ...form, key: v })} isDisabled={!!editTarget} placeholder="e.g. JIRA-1234" />
              </FormGroup>
              <FormGroup label="Summary" isRequired fieldId="iss-summary">
                <TextInput id="iss-summary" value={form.summary} onChange={(_e, v) => setForm({ ...form, summary: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Type" fieldId="iss-type">
                <TextInput id="iss-type" value={form.issue_type} onChange={(_e, v) => setForm({ ...form, issue_type: v })} placeholder="Bug, Feature, Task..." />
              </FormGroup>
              <FormGroup label="Status" fieldId="iss-status">
                <FormSelect id="iss-status" value={form.status} onChange={(_e, v) => setForm({ ...form, status: v })}>
                  {STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
              <FormGroup label="Priority" fieldId="iss-priority">
                <FormSelect id="iss-priority" value={form.priority} onChange={(_e, v) => setForm({ ...form, priority: v })}>
                  {PRIORITIES.map((p) => <FormSelectOption key={p} value={p} label={p || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Project" fieldId="iss-project">
                <TextInput id="iss-project" value={form.project} onChange={(_e, v) => setForm({ ...form, project: v })} />
              </FormGroup>
              <FormGroup label="Assignee" fieldId="iss-assignee">
                <TextInput id="iss-assignee" value={form.assignee} onChange={(_e, v) => setForm({ ...form, assignee: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <FormGroup label="Affects Versions" fieldId="iss-affects">
                <TextInput id="iss-affects" value={form.affects_versions} onChange={(_e, v) => setForm({ ...form, affects_versions: v })} />
              </FormGroup>
              <FormGroup label="Target Version" fieldId="iss-target">
                <TextInput id="iss-target" value={form.target_version} onChange={(_e, v) => setForm({ ...form, target_version: v })} />
              </FormGroup>
              <FormGroup label="Fix Versions" fieldId="iss-fix">
                <TextInput id="iss-fix" value={form.fix_versions} onChange={(_e, v) => setForm({ ...form, fix_versions: v })} />
              </FormGroup>
            </div>
            <FormGroup label="Linked Cases" fieldId="iss-cases">
              <TextInput id="iss-cases" value={form.linked_cases} onChange={(_e, v) => setForm({ ...form, linked_cases: v })} placeholder="e.g. 03456789, 03456790" />
            </FormGroup>
            <FormGroup label="Labels" fieldId="iss-labels">
              <TextInput id="iss-labels" value={form.labels} onChange={(_e, v) => setForm({ ...form, labels: v })} placeholder="Comma-separated labels" />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.key || !form.summary}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Issue" />
        <ModalBody>
          Are you sure you want to delete issue <strong>{deleteTarget?.key}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
