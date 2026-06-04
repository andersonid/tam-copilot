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
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Switch,
  Tabs,
  Tab,
  TabTitleText,
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

interface Contact {
  id: number;
  account_id: number;
  name: string;
  sso_username: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  area: string | null;
  is_tam_contact: boolean;
  is_org_admin: boolean;
  contact_type: string | null;
  classification: string | null;
  relationship_status: string | null;
  team: string;
  status: string | null;
  synced_at: string;
}

const CLASSIFICATIONS = ["", "Executive", "Technical", "Operational", "Business"];
const RELATIONSHIP_STATUSES = ["", "Active", "Inactive", "New"];

const emptyForm = {
  name: "",
  sso_username: "",
  email: "",
  phone: "",
  title: "",
  area: "",
  is_tam_contact: false,
  is_org_admin: false,
  contact_type: "",
  classification: "",
  relationship_status: "",
  team: "redhat" as "customer" | "redhat",
  status: "active",
};

export function ContactsPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const { user } = useAuth();
  const canWrite = user?.role !== "viewer";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | number>("customer");
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = selectedAccountId ? { account_id: selectedAccountId } : {};
    api.get("/contacts", { params }).then(({ data }) => setContacts(data)).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("contacts");
    if (result) fetchData();
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, team: activeTab as "customer" | "redhat" });
    setModalOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditTarget(c);
    setForm({
      name: c.name,
      sso_username: c.sso_username ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      title: c.title ?? "",
      area: c.area ?? "",
      is_tam_contact: c.is_tam_contact,
      is_org_admin: c.is_org_admin,
      contact_type: c.contact_type ?? "",
      classification: c.classification ?? "",
      relationship_status: c.relationship_status ?? "",
      team: c.team as "customer" | "redhat",
      status: c.status ?? "active",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sso_username: form.sso_username || null,
        email: form.email || null,
        phone: form.phone || null,
        title: form.title || null,
        area: form.area || null,
        is_tam_contact: form.is_tam_contact,
        is_org_admin: form.is_org_admin,
        contact_type: form.contact_type || null,
        classification: form.classification || null,
        relationship_status: form.relationship_status || null,
        team: form.team,
        status: form.status || "active",
      };
      if (editTarget) {
        await api.patch(`/contacts/${editTarget.id}`, payload);
      } else {
        await api.post("/contacts", payload, { params: { account_id: selectedAccountId } });
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
      await api.delete(`/contacts/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  const filtered = contacts.filter((c) => c.team === activeTab);

  if (loading) return <Spinner aria-label="Loading" />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Contacts — {scope}</Title></ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            {canWrite && selectedAccountId && (
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate} style={{ marginRight: 8 }}>
                Add Contact
              </Button>
            )}
            {selectedAccountId && (
              <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                Sync from Hydra
              </Button>
            )}
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>
      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}
      <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key)} style={{ marginTop: 16 }}>
        <Tab eventKey="customer" title={<TabTitleText>Customer Team</TabTitleText>} />
        <Tab eventKey="redhat" title={<TabTitleText>Red Hat Team</TabTitleText>} />
      </Tabs>
      {filtered.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {activeTab === "customer" && selectedAccountId
              ? "No customer contacts. Click \"Sync from Hydra\" to pull data, or add manually."
              : "No contacts in this category."}
          </EmptyStateBody>
          {canWrite && selectedAccountId && (
            <EmptyStateFooter><EmptyStateActions>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={openCreate}>Add Contact</Button>
            </EmptyStateActions></EmptyStateFooter>
          )}
        </EmptyState>
      ) : (
        <Table aria-label="Contacts" variant="compact" style={{ marginTop: 16 }}>
          <Thead><Tr>
            <Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Title</Th><Th>Area</Th><Th>Classification</Th><Th>Flags</Th>
            {canWrite && <Th />}
          </Tr></Thead>
          <Tbody>
            {filtered.map((c) => (
              <Tr key={c.id}>
                <Td dataLabel="Name"><strong>{c.name}</strong></Td>
                <Td dataLabel="Email">{c.email ?? "—"}</Td>
                <Td dataLabel="Phone">{c.phone ?? "—"}</Td>
                <Td dataLabel="Title">{c.title ?? "—"}</Td>
                <Td dataLabel="Area">{c.area ?? "—"}</Td>
                <Td dataLabel="Classification">{c.classification ?? "—"}</Td>
                <Td dataLabel="Flags">
                  {c.is_tam_contact && <Label color="blue" isCompact style={{ marginRight: 4 }}>TAM</Label>}
                  {c.is_org_admin && <Label color="purple" isCompact>Admin</Label>}
                </Td>
                {canWrite && (
                  <Td isActionCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button variant="plain" onClick={() => openEdit(c)} aria-label="Edit"><PencilAltIcon /></Button>
                      <Button variant="plain" isDanger onClick={() => setDeleteTarget(c)} aria-label="Delete"><TrashIcon /></Button>
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
        <ModalHeader title={editTarget ? `Edit ${editTarget.name}` : "Add Contact"} />
        <ModalBody>
          <Form>
            <FormGroup label="Name" isRequired fieldId="ct-name">
              <TextInput id="ct-name" value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} />
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Email" fieldId="ct-email">
                <TextInput id="ct-email" type="email" value={form.email} onChange={(_e, v) => setForm({ ...form, email: v })} />
              </FormGroup>
              <FormGroup label="Phone" fieldId="ct-phone">
                <TextInput id="ct-phone" value={form.phone} onChange={(_e, v) => setForm({ ...form, phone: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Title / Role" fieldId="ct-title">
                <TextInput id="ct-title" value={form.title} onChange={(_e, v) => setForm({ ...form, title: v })} />
              </FormGroup>
              <FormGroup label="Area" fieldId="ct-area">
                <TextInput id="ct-area" value={form.area} onChange={(_e, v) => setForm({ ...form, area: v })} />
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Team" fieldId="ct-team">
                <FormSelect id="ct-team" value={form.team} onChange={(_e, v) => setForm({ ...form, team: v as "customer" | "redhat" })}>
                  <FormSelectOption value="customer" label="Customer" />
                  <FormSelectOption value="redhat" label="Red Hat" />
                </FormSelect>
              </FormGroup>
              <FormGroup label="Classification" fieldId="ct-class">
                <FormSelect id="ct-class" value={form.classification} onChange={(_e, v) => setForm({ ...form, classification: v })}>
                  {CLASSIFICATIONS.map((c) => <FormSelectOption key={c} value={c} label={c || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="SSO Username" fieldId="ct-sso">
                <TextInput id="ct-sso" value={form.sso_username} onChange={(_e, v) => setForm({ ...form, sso_username: v })} />
              </FormGroup>
              <FormGroup label="Relationship Status" fieldId="ct-rel">
                <FormSelect id="ct-rel" value={form.relationship_status} onChange={(_e, v) => setForm({ ...form, relationship_status: v })}>
                  {RELATIONSHIP_STATUSES.map((s) => <FormSelectOption key={s} value={s} label={s || "— Select —"} />)}
                </FormSelect>
              </FormGroup>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
              <Switch
                id="ct-tam"
                label="TAM Contact"
                isChecked={form.is_tam_contact}
                onChange={(_e, v) => setForm({ ...form, is_tam_contact: v })}
              />
              <Switch
                id="ct-admin"
                label="Org Admin"
                isChecked={form.is_org_admin}
                onChange={(_e, v) => setForm({ ...form, is_org_admin: v })}
              />
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={!form.name}>
            {editTarget ? "Save" : "Create"}
          </Button>
          <Button variant="link" onClick={closeModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Delete Contact" />
        <ModalBody>
          Are you sure you want to delete contact <strong>{deleteTarget?.name}</strong>?
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={saving}>Delete</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
