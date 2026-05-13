import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Content,
  DataList,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DataListCell,
  Divider,
  Form,
  FormGroup,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Spinner,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
} from "@patternfly/react-core";
import PlusCircleIcon from "@patternfly/react-icons/dist/esm/icons/plus-circle-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import api from "../services/api";

const ROLES = ["admin", "manager", "tam", "viewer"] as const;

interface AdminUserRow {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  tam_type: string | null;
  manager_id: number | null;
  manager_username: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyCreate = {
  username: "",
  password: "",
  role: "tam",
  full_name: "",
  email: "",
  tam_type: "",
  manager_id: "",
  is_active: true,
};

export function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...emptyCreate });
  const [createSaving, setCreateSaving] = useState(false);
  const [editRow, setEditRow] = useState<AdminUserRow | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    role: "tam",
    tam_type: "",
    manager_id: "",
    is_active: true,
    password: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<AdminUserRow[]>("/admin/users")
      .then((r) => setRows(r.data))
      .catch((e) => {
        setError(e?.response?.data?.detail ?? e.message ?? "Failed to load users");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const managers = rows.filter((u) => u.role === "manager");

  const openEdit = (u: AdminUserRow) => {
    setEditRow(u);
    setEditForm({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      role: u.role,
      tam_type: u.tam_type ?? "",
      manager_id: u.manager_id != null ? String(u.manager_id) : "",
      is_active: u.is_active,
      password: "",
    });
  };

  const submitCreate = async () => {
    if (!createForm.username.trim() || createForm.password.length < 4) return;
    setCreateSaving(true);
    try {
      await api.post("/admin/users", {
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        full_name: createForm.full_name.trim() || null,
        email: createForm.email.trim() || null,
        tam_type: createForm.tam_type.trim() || null,
        manager_id: createForm.manager_id ? Number(createForm.manager_id) : null,
        is_active: createForm.is_active,
      });
      setCreateOpen(false);
      setCreateForm({ ...emptyCreate });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Create failed");
    } finally {
      setCreateSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        full_name: editForm.full_name.trim() || null,
        email: editForm.email.trim() || null,
        role: editForm.role,
        tam_type: editForm.tam_type.trim() || null,
        manager_id: editForm.manager_id ? Number(editForm.manager_id) : null,
        is_active: editForm.is_active,
      };
      if (editForm.password.trim().length >= 4) {
        body.password = editForm.password.trim();
      }
      await api.patch(`/admin/users/${editRow.id}`, body);
      setEditRow(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) return <Spinner aria-label="Loading users" />;

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Users</Content>
          <Content component="p">
            Create and edit platform users, roles, and manager assignment. Only administrators can access this page.
          </Content>
        </Content>
      </PageSection>

      {error && (
        <PageSection hasBodyWrapper={false}>
          <Alert variant="danger" title={error} isInline />
        </PageSection>
      )}

      <PageSection hasBodyWrapper={false}>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setCreateOpen(true)}>
                Create user
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        <DataList aria-label="Users">
          {rows.map((u) => (
            <DataListItem key={u.id} aria-labelledby={`u-${u.id}`}>
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="n" width={2}>
                      <span id={`u-${u.id}`} style={{ fontWeight: 600 }}>{u.username}</span>
                      <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                        {u.full_name || "—"}
                        {u.email && ` · ${u.email}`}
                      </div>
                    </DataListCell>,
                    <DataListCell key="r">{u.role}</DataListCell>,
                    <DataListCell key="m">{u.manager_username || "—"}</DataListCell>,
                    <DataListCell key="t">{u.tam_type || "—"}</DataListCell>,
                    <DataListCell key="a">
                      <Label color={u.is_active ? "green" : "grey"} isCompact>
                        {u.is_active ? "Active" : "Inactive"}
                      </Label>
                    </DataListCell>,
                    <DataListCell key="e">
                      <Button variant="plain" icon={<PencilAltIcon />} onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      </PageSection>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} variant="medium">
        <ModalHeader title="Create user" />
        <ModalBody>
          <Form>
            <FormGroup label="Username" isRequired fieldId="c-user">
              <TextInput id="c-user" value={createForm.username} onChange={(_e, v) => setCreateForm({ ...createForm, username: v })} />
            </FormGroup>
            <FormGroup label="Password" isRequired fieldId="c-pass">
              <TextInput id="c-pass" type="password" value={createForm.password} onChange={(_e, v) => setCreateForm({ ...createForm, password: v })} />
            </FormGroup>
            <FormGroup label="Role" isRequired fieldId="c-role">
              <select
                id="c-role"
                style={{ width: "100%", minHeight: 36 }}
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Full name" fieldId="c-fn">
              <TextInput id="c-fn" value={createForm.full_name} onChange={(_e, v) => setCreateForm({ ...createForm, full_name: v })} />
            </FormGroup>
            <FormGroup label="Email" fieldId="c-em">
              <TextInput id="c-em" type="email" value={createForm.email} onChange={(_e, v) => setCreateForm({ ...createForm, email: v })} />
            </FormGroup>
            <FormGroup label="TAM type" fieldId="c-tt">
              <TextInput id="c-tt" value={createForm.tam_type} onChange={(_e, v) => setCreateForm({ ...createForm, tam_type: v })} />
            </FormGroup>
            <FormGroup label="Manager" fieldId="c-mgr">
              <select
                id="c-mgr"
                style={{ width: "100%", minHeight: 36 }}
                value={createForm.manager_id}
                onChange={(e) => setCreateForm({ ...createForm, manager_id: e.target.value })}
              >
                <option value="">—</option>
                {managers.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.username}</option>
                ))}
              </select>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={() => void submitCreate()}
            isLoading={createSaving}
            isDisabled={!createForm.username.trim() || createForm.password.length < 4}
          >
            Create
          </Button>
          <Button variant="link" onClick={() => setCreateOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} variant="medium">
        <ModalHeader title={`Edit user: ${editRow?.username ?? ""}`} />
        <ModalBody>
          {editRow && (
            <Form>
              <FormGroup label="Full name" fieldId="e-fn">
                <TextInput id="e-fn" value={editForm.full_name} onChange={(_e, v) => setEditForm({ ...editForm, full_name: v })} />
              </FormGroup>
              <FormGroup label="Email" fieldId="e-em">
                <TextInput id="e-em" type="email" value={editForm.email} onChange={(_e, v) => setEditForm({ ...editForm, email: v })} />
              </FormGroup>
              <FormGroup label="Role" fieldId="e-role">
                <select
                  id="e-role"
                  style={{ width: "100%", minHeight: 36 }}
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="TAM type" fieldId="e-tt">
                <TextInput id="e-tt" value={editForm.tam_type} onChange={(_e, v) => setEditForm({ ...editForm, tam_type: v })} />
              </FormGroup>
              <FormGroup label="Manager" fieldId="e-mgr">
                <select
                  id="e-mgr"
                  style={{ width: "100%", minHeight: 36 }}
                  value={editForm.manager_id}
                  onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                >
                  <option value="">—</option>
                  {managers.filter((m) => m.id !== editRow.id).map((m) => (
                    <option key={m.id} value={String(m.id)}>{m.username}</option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="New password (optional)" fieldId="e-pw">
                <TextInput id="e-pw" type="password" value={editForm.password} onChange={(_e, v) => setEditForm({ ...editForm, password: v })} />
              </FormGroup>
              <Divider style={{ margin: "12px 0" }} />
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                />
                Active
              </label>
            </Form>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => void submitEdit()} isLoading={editSaving}>
            Save
          </Button>
          <Button variant="link" onClick={() => setEditRow(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
