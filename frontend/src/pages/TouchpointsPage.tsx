import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardBody,
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
  TextArea,
  TextInput,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import { useAccount } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

interface Touchpoint {
  id: number;
  account_id: number;
  touchpoint_date: string;
  participants: string | null;
  topics: string | null;
  customer_area: string | null;
  created_at: string;
}

const emptyForm = {
  touchpoint_date: new Date().toISOString().slice(0, 10),
  participants: "",
  topics: "",
  customer_area: "",
};

export function TouchpointsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [items, setItems] = useState<Touchpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Touchpoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Touchpoint | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/touchpoints", { params })
      .then(({ data }) => setItems(data))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (t: Touchpoint) => {
    setEditTarget(t);
    setForm({
      touchpoint_date: t.touchpoint_date,
      participants: t.participants ?? "",
      topics: t.topics ?? "",
      customer_area: t.customer_area ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
  };

  const handleSave = async () => {
    if (!form.touchpoint_date) return;
    setSaving(true);
    try {
      const payload = {
        touchpoint_date: form.touchpoint_date,
        participants: form.participants || null,
        topics: form.topics || null,
        customer_area: form.customer_area || null,
      };
      if (editTarget) {
        await api.patch(`/touchpoints/${editTarget.id}`, payload);
      } else {
        await api.post("/touchpoints", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/touchpoints/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
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
          <ToolbarItem>
            <Title headingLevel="h1">Touchpoints — {scope}</Title>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>
                Record Touchpoint
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>No touchpoints recorded{selectedAccount ? ` for ${selectedAccount.name}` : ""}.</EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Record Touchpoint</Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <div style={{ marginTop: 16 }}>
          {items.map((t) => (
            <Card key={t.id} isCompact style={{ marginBottom: 12 }}>
              <CardBody>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                      <strong>{t.touchpoint_date}</strong>
                      {t.customer_area && <Label isCompact color="blue">{t.customer_area}</Label>}
                    </div>
                    {t.participants && (
                      <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                        <strong>Participants:</strong> {t.participants}
                      </div>
                    )}
                    {t.topics && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{t.topics}</div>}
                  </div>
                  {canWrite && (
                    <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
                      <Button variant="plain" onClick={() => openEdit(t)} aria-label="Edit">
                        <PencilAltIcon />
                      </Button>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(t)} aria-label="Delete">
                        <TrashIcon />
                      </Button>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} variant="medium">
        <ModalHeader title={editTarget ? "Edit Touchpoint" : "Record Touchpoint"} />
        <ModalBody>
          <Form>
            <FormGroup label="Date" isRequired fieldId="tp-date">
              <TextInput
                id="tp-date"
                type="date"
                value={form.touchpoint_date}
                onChange={(_e, v) => setForm({ ...form, touchpoint_date: v })}
              />
            </FormGroup>
            <FormGroup label="Customer Area" fieldId="tp-area">
              <TextInput
                id="tp-area"
                value={form.customer_area}
                onChange={(_e, v) => setForm({ ...form, customer_area: v })}
                placeholder="e.g. Infrastructure, Development, Security"
              />
            </FormGroup>
            <FormGroup label="Participants" fieldId="tp-participants">
              <TextArea
                id="tp-participants"
                value={form.participants}
                onChange={(_e, v) => setForm({ ...form, participants: v })}
                placeholder="Names of attendees"
                rows={2}
              />
            </FormGroup>
            <FormGroup label="Topics Discussed" fieldId="tp-topics">
              <TextArea
                id="tp-topics"
                value={form.topics}
                onChange={(_e, v) => setForm({ ...form, topics: v })}
                placeholder="Summary of topics discussed during the touchpoint"
                rows={4}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.touchpoint_date}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Touchpoint" />
        <ModalBody>
          Are you sure you want to delete the touchpoint from <strong>{deleteTarget?.touchpoint_date}</strong>
          {deleteTarget?.customer_area ? ` (${deleteTarget.customer_area})` : ""}?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
