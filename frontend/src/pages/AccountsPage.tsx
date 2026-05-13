import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Content,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListAction,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  EmptyStateVariant,
  Label,
  MenuToggle,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Form,
  FormGroup,
  TextInput,
  SearchInput,
  Alert,
  Divider,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import SearchIcon from "@patternfly/react-icons/dist/esm/icons/search-icon";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import EllipsisVIcon from "@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon";
import TrashIcon from "@patternfly/react-icons/dist/esm/icons/trash-icon";
import PencilAltIcon from "@patternfly/react-icons/dist/esm/icons/pencil-alt-icon";
import { useAccount, type AccountSummary } from "../context/AccountContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

interface HydraResult {
  account_number: string;
  name: string;
  country: string | null;
  tam_name: string | null;
  support_level: string | null;
  already_imported: boolean;
}

export function AccountsPage() {
  const { accounts, loading, refreshAccounts, setSelectedAccountId } = useAccount();
  const { isManagerOrAdmin } = useAuth();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    account_number: "",
    region: "",
    country: "",
    vertical_id: "",
    segment_id: "",
  });
  const [verticals, setVerticals] = useState<{ id: number; name: string }[]>([]);
  const [segments, setSegments] = useState<{ id: number; name: string }[]>([]);
  const [assignAccount, setAssignAccount] = useState<AccountSummary | null>(null);
  const [assignRows, setAssignRows] = useState<
    { id: number; user_id: number; username: string | null; assignment_type: string; specialization: string | null }[]
  >([]);
  const [teamMembers, setTeamMembers] = useState<{ id: number; username: string; full_name: string | null }[]>([]);
  const [assignForm, setAssignForm] = useState({ user_id: "", assignment_type: "tam", specialization: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [openKebab, setOpenKebab] = useState<number | null>(null);

  // Hydra search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HydraResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedHydra, setSelectedHydra] = useState<HydraResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!modalOpen) return;
    void api.get("/verticals").then((r) => setVerticals(r.data)).catch(() => setVerticals([]));
    void api.get("/segments").then((r) => setSegments(r.data)).catch(() => setSegments([]));
  }, [modalOpen]);

  const openAssignModal = async (a: AccountSummary) => {
    setAssignAccount(a);
    setOpenKebab(null);
    setAssignForm({ user_id: "", assignment_type: "tam", specialization: "" });
    try {
      const [asg, team] = await Promise.all([
        api.get(`/accounts/${a.id}/assignments`),
        api.get("/team/members").catch(() => ({ data: [] })),
      ]);
      setAssignRows(asg.data);
      setTeamMembers(
        (team.data as { id: number; username: string; full_name: string | null }[]).map((m) => ({
          id: m.id,
          username: m.username,
          full_name: m.full_name,
        })),
      );
    } catch {
      setAssignRows([]);
      setTeamMembers([]);
    }
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    setSearchError("");
    try {
      const resp = await api.get("/accounts/search-hydra", { params: { q } });
      setSearchResults(resp.data);
      if (resp.data.length === 0) setSearchError("No accounts found.");
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 503)
        setSearchError("Hydra integration not configured. You can still add accounts manually.");
      else
        setSearchError(detail || "Search failed");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (_e: any, value: string) => {
    setSearchQuery(value);
    setSelectedHydra(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const selectHydraResult = (r: HydraResult) => {
    setSelectedHydra(r);
    setForm({
      name: r.name,
      account_number: r.account_number,
      region: "",
      country: r.country || "",
      vertical_id: "",
      segment_id: "",
    });
    setSearchResults([]);
    setSearchQuery(r.name);
  };

  const resetModal = () => {
    setModalOpen(false);
    setForm({ name: "", account_number: "", region: "", country: "", vertical_id: "", segment_id: "" });
    setSearchQuery(""); setSearchResults([]); setSearchError(""); setSelectedHydra(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post("/accounts", {
        name: form.name,
        account_number: form.account_number,
        region: form.region || null,
        country: form.country || null,
        vertical_id: form.vertical_id ? Number(form.vertical_id) : null,
        segment_id: form.segment_id ? Number(form.segment_id) : null,
      });
      resetModal();
      await refreshAccounts();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error creating account");
    } finally { setSaving(false); }
  };

  const selectAccount = (a: AccountSummary) => {
    setSelectedAccountId(a.id);
    navigate("/");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/accounts/${deleteTarget.id}`);
      setDeleteTarget(null);
      await refreshAccounts();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error removing account");
    } finally { setDeleting(false); }
  };

  const filtered = filterValue
    ? accounts.filter((a) =>
        a.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        a.account_number.includes(filterValue) ||
        (a.assignments_summary || "").toLowerCase().includes(filterValue.toLowerCase()) ||
        (a.vertical_name || "").toLowerCase().includes(filterValue.toLowerCase()))
    : accounts;

  if (loading) return <Spinner aria-label="Loading accounts" />;

  return (
    <>
      {/* Page header */}
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Accounts</Content>
          <Content component="p">
            Customer accounts managed by your TAM team. Select an account to view its dashboard.
          </Content>
        </Content>
      </PageSection>

      {/* Toolbar */}
      <PageSection hasBodyWrapper={false} padding={{ default: "noPadding" }} style={{ paddingInline: "var(--pf-t--global--spacer--lg)" }}>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                placeholder="Filter accounts..."
                value={filterValue}
                onChange={(_e, v) => setFilterValue(v)}
                onClear={() => setFilterValue("")}
                style={{ minWidth: 280 }}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Add account
              </Button>
            </ToolbarItem>
            <ToolbarItem variant="separator" />
            <ToolbarItem align={{ default: "alignEnd" }}>
              <Content component="small">{filtered.length} account{filtered.length !== 1 ? "s" : ""}</Content>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </PageSection>

      <Divider />

      {/* Account list */}
      <PageSection hasBodyWrapper={false}>
        {filtered.length === 0 && accounts.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.lg}>
            <EmptyStateBody>
              No accounts registered yet. Search your Red Hat customer accounts and import them to start managing.
            </EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="primary" onClick={() => setModalOpen(true)} icon={<SearchIcon />}>
                  Find &amp; Add Account
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState variant={EmptyStateVariant.sm}>
            <EmptyStateBody>
              No accounts match the filter &quot;{filterValue}&quot;.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <DataList
            aria-label="Accounts list"
            onSelectDataListItem={(_e, id) => {
              const acct = accounts.find((a) => String(a.id) === id);
              if (acct) selectAccount(acct);
            }}
          >
            {filtered.map((a) => (
              <DataListItem key={a.id} id={String(a.id)} aria-labelledby={`account-${a.id}-name`}>
                <DataListItemRow>
                  <DataListItemCells
                    dataListCells={[
                      <DataListCell key="name" width={2}>
                        <span id={`account-${a.id}-name`} style={{ fontWeight: 600 }}>{a.name}</span>
                      </DataListCell>,
                      <DataListCell key="number" width={1}>
                        <Content component="small" style={{ color: "var(--pf-t--global--text--color--subtle)" }}>
                          #{a.account_number}
                        </Content>
                      </DataListCell>,
                      <DataListCell key="region" width={1}>
                        <Content component="small" style={{ color: "var(--pf-t--global--text--color--subtle)" }}>
                          {[a.region, a.country].filter(Boolean).join(" · ") || "—"}
                        </Content>
                      </DataListCell>,
                      <DataListCell key="vert" width={1}>
                        <Content component="small">{a.vertical_name || "—"}</Content>
                      </DataListCell>,
                      <DataListCell key="seg" width={1}>
                        <Content component="small">{a.segment_name || "—"}</Content>
                      </DataListCell>,
                      <DataListCell key="tams" width={2}>
                        <Content component="small" style={{ whiteSpace: "pre-wrap" }}>
                          {a.assignments_summary || "—"}
                        </Content>
                        {a.team_leads_summary && a.team_leads_summary !== "—" && (
                          <div style={{ fontSize: "0.75rem", marginTop: 4, color: "var(--pf-t--global--text--color--subtle)" }}>
                            TL: {a.team_leads_summary}
                          </div>
                        )}
                      </DataListCell>,
                      <DataListCell key="status" width={1}>
                        <Label color={a.is_active ? "green" : "grey"} isCompact>
                          {a.is_active ? "Active" : "Inactive"}
                        </Label>
                        {a.tam_type && (
                          <Label color="blue" isCompact style={{ marginLeft: 8 }}>{a.tam_type}</Label>
                        )}
                      </DataListCell>,
                    ]}
                  />
                  {isManagerOrAdmin && (
                    <DataListAction
                      id={`account-${a.id}-actions`}
                      aria-labelledby={`account-${a.id}-name`}
                      aria-label={`Actions for ${a.name}`}
                    >
                      <Dropdown
                        popperProps={{ position: "right" }}
                        onOpenChange={(open) => setOpenKebab(open ? a.id : null)}
                        toggle={(toggleRef) => (
                          <MenuToggle
                            ref={toggleRef}
                            aria-label={`Actions for ${a.name}`}
                            variant="plain"
                            onClick={() => setOpenKebab(openKebab === a.id ? null : a.id)}
                            isExpanded={openKebab === a.id}
                          >
                            <EllipsisVIcon />
                          </MenuToggle>
                        )}
                        isOpen={openKebab === a.id}
                      >
                        <DropdownList>
                          {isManagerOrAdmin && (
                            <DropdownItem
                              key="assign"
                              onClick={() => { setOpenKebab(null); void openAssignModal(a); }}
                            >
                              Manage assignments
                            </DropdownItem>
                          )}
                          <DropdownItem key="edit" icon={<PencilAltIcon />} onClick={() => setOpenKebab(null)}>
                            Edit
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            icon={<TrashIcon />}
                            onClick={() => { setOpenKebab(null); setDeleteTarget(a); }}
                            isDanger
                          >
                            Remove
                          </DropdownItem>
                        </DropdownList>
                      </Dropdown>
                    </DataListAction>
                  )}
                </DataListItemRow>
              </DataListItem>
            ))}
          </DataList>
        )}
      </PageSection>

      {/* Add/Import account modal */}
      <Modal isOpen={modalOpen} onClose={resetModal} variant="medium">
        <ModalHeader title="Add Account" description="Search Red Hat accounts by name or number" />
        <ModalBody>
          <div style={{ marginBottom: 16 }}>
            <SearchInput
              placeholder="Search by account name or number..."
              value={searchQuery}
              onChange={handleSearchChange}
              onClear={() => { setSearchQuery(""); setSearchResults([]); setSelectedHydra(null); }}
              isDisabled={searching}
            />
            {searching && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <Spinner size="md" /> Searching Hydra...
              </div>
            )}
          </div>

          {searchError && (
            <Alert variant="warning" title={searchError} isInline isPlain style={{ marginBottom: 12 }} />
          )}

          {searchResults.length > 0 && (
            <div style={{
              border: "1px solid var(--pf-t--global--border--color--default)",
              borderRadius: 8,
              maxHeight: 240,
              overflowY: "auto",
              marginBottom: 16,
            }}>
              {searchResults.map((r, i) => (
                <div key={r.account_number}>
                  <div
                    onClick={() => !r.already_imported && selectHydraResult(r)}
                    style={{
                      padding: "10px 16px",
                      cursor: r.already_imported ? "default" : "pointer",
                      opacity: r.already_imported ? 0.5 : 1,
                      background: r.already_imported ? "var(--pf-t--global--background--color--secondary--default)" : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onMouseEnter={(e) => { if (!r.already_imported) e.currentTarget.style.background = "var(--pf-t--global--background--color--secondary--hover)"; }}
                    onMouseLeave={(e) => { if (!r.already_imported) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: "0.85em", opacity: 0.7 }}>
                        #{r.account_number}
                        {r.country && ` · ${r.country}`}
                        {r.support_level && ` · ${r.support_level}`}
                        {r.tam_name && ` · TAM: ${r.tam_name}`}
                      </div>
                    </div>
                    {r.already_imported && (
                      <Label color="green" isCompact icon={<CheckCircleIcon />}>Imported</Label>
                    )}
                  </div>
                  {i < searchResults.length - 1 && <Divider />}
                </div>
              ))}
            </div>
          )}

          {selectedHydra && (
            <Alert variant="success" title={`Selected: ${selectedHydra.name} (#${selectedHydra.account_number})`} isInline style={{ marginBottom: 16 }} />
          )}

          <Divider style={{ marginBottom: 16 }} />

          <HelperText style={{ marginBottom: 12 }}>
            <HelperTextItem>
              {selectedHydra
                ? "Review the details below and click Import to add this account."
                : "Or fill in the details manually if Hydra search is unavailable."}
            </HelperTextItem>
          </HelperText>

          <Form>
            <FormGroup label="Account Name" isRequired fieldId="name">
              <TextInput id="name" value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} />
            </FormGroup>
            <FormGroup label="Account Number" isRequired fieldId="number">
              <TextInput id="number" value={form.account_number} onChange={(_e, v) => setForm({ ...form, account_number: v })} isDisabled={!!selectedHydra} />
            </FormGroup>
            <FormGroup label="Region" fieldId="region">
              <TextInput id="region" value={form.region} onChange={(_e, v) => setForm({ ...form, region: v })} />
            </FormGroup>
            <FormGroup label="Country" fieldId="country">
              <TextInput id="country" value={form.country} onChange={(_e, v) => setForm({ ...form, country: v })} />
            </FormGroup>
            <FormGroup label="Vertical" fieldId="vertical">
              <select
                id="vertical"
                style={{ width: "100%", minHeight: 36 }}
                value={form.vertical_id}
                onChange={(e) => setForm({ ...form, vertical_id: e.target.value })}
              >
                <option value="">—</option>
                {verticals.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.name}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Segment" fieldId="segment">
              <select
                id="segment"
                style={{ width: "100%", minHeight: 36 }}
                value={form.segment_id}
                onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
              >
                <option value="">—</option>
                {segments.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleCreate} isLoading={saving} isDisabled={!form.name || !form.account_number}>
            {selectedHydra ? "Import Account" : "Create Account"}
          </Button>
          <Button variant="link" onClick={resetModal}>Cancel</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={!!assignAccount}
        onClose={() => { setAssignAccount(null); setAssignRows([]); }}
        variant="medium"
      >
        <ModalHeader
          title="Manage assignments"
          description={assignAccount ? `${assignAccount.name} (#${assignAccount.account_number})` : ""}
        />
        <ModalBody>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {assignRows.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: "1px solid var(--pf-t--global--border--color--default)",
                }}
              >
                <span>
                  <strong>{r.username || r.user_id}</strong> — {r.assignment_type}
                  {r.specialization && ` (${r.specialization})`}
                </span>
                <Button
                  variant="danger"
                  isInline
                  onClick={async () => {
                    if (!assignAccount) return;
                    try {
                      await api.delete(`/accounts/${assignAccount.id}/assignments/${r.id}`);
                      const resp = await api.get(`/accounts/${assignAccount.id}/assignments`);
                      setAssignRows(resp.data);
                      await refreshAccounts();
                    } catch (e: any) {
                      alert(e.response?.data?.detail || "Failed to remove assignment");
                    }
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <Divider style={{ margin: "16px 0" }} />
          <Form>
            <FormGroup label="User" fieldId="uid">
              <select
                id="uid"
                style={{ width: "100%", minHeight: 36 }}
                value={assignForm.user_id}
                onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
              >
                <option value="">—</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={String(m.id)}>{m.full_name || m.username}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label="Type" fieldId="atype">
              <select
                id="atype"
                style={{ width: "100%", minHeight: 36 }}
                value={assignForm.assignment_type}
                onChange={(e) => setAssignForm({ ...assignForm, assignment_type: e.target.value })}
              >
                <option value="tam">TAM</option>
                <option value="team_lead">Team lead</option>
                <option value="cs">CS</option>
                <option value="backup">Backup</option>
              </select>
            </FormGroup>
            <FormGroup label="Specialization (e.g. OCP)" fieldId="spec">
              <TextInput
                id="spec"
                value={assignForm.specialization}
                onChange={(_e, v) => setAssignForm({ ...assignForm, specialization: v })}
              />
            </FormGroup>
            <Button
              variant="primary"
              onClick={async () => {
                if (!assignAccount || !assignForm.user_id) return;
                try {
                  await api.post(`/accounts/${assignAccount.id}/assignments`, {
                    user_id: Number(assignForm.user_id),
                    assignment_type: assignForm.assignment_type,
                    specialization: assignForm.specialization || null,
                    is_primary: false,
                  });
                  const resp = await api.get(`/accounts/${assignAccount.id}/assignments`);
                  setAssignRows(resp.data);
                  setAssignForm({ user_id: "", assignment_type: "tam", specialization: "" });
                  await refreshAccounts();
                } catch (e: any) {
                  alert(e.response?.data?.detail || "Failed to add assignment");
                }
              }}
            >
              Add
            </Button>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => { setAssignAccount(null); setAssignRows([]); }}>Close</Button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} variant="small">
        <ModalHeader title="Remove Account" />
        <ModalBody>
          Are you sure you want to remove <strong>{deleteTarget?.name}</strong> (#{deleteTarget?.account_number})?
          This will delete all local data associated with this account.
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Remove</Button>
          <Button variant="link" onClick={() => setDeleteTarget(null)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
