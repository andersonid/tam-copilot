import { useState, useRef, useCallback } from "react";
import {
  Title,
  Button,
  Card,
  CardBody,
  Grid,
  GridItem,
  Label,
  Spinner,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
import { useAccount, type AccountSummary } from "../context/AccountContext";
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
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", account_number: "", region: "", country: "" });
  const [saving, setSaving] = useState(false);

  // Hydra search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HydraResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedHydra, setSelectedHydra] = useState<HydraResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const resp = await api.get("/accounts/search-hydra", { params: { q } });
      setSearchResults(resp.data);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 503) {
        setSearchError("Hydra integration not configured. You can still add accounts manually.");
      } else {
        setSearchError(detail || "Search failed");
      }
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
    });
    setSearchResults([]);
    setSearchQuery(r.name);
  };

  const resetModal = () => {
    setModalOpen(false);
    setForm({ name: "", account_number: "", region: "", country: "" });
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setSelectedHydra(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post("/accounts", form);
      resetModal();
      await refreshAccounts();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Error creating account");
    } finally {
      setSaving(false);
    }
  };

  const selectAccount = (a: AccountSummary) => {
    setSelectedAccountId(a.id);
    navigate("/");
  };

  if (loading) return <Spinner aria-label="Loading accounts" />;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title headingLevel="h1">Accounts</Title>
        <Button variant="primary" onClick={() => setModalOpen(true)}>Add Account</Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            No accounts registered yet. Search your Red Hat customer accounts and add them to start managing.
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => setModalOpen(true)} icon={<SearchIcon />}>
                Find &amp; Add Account
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <Grid hasGutter>
          {accounts.map((a) => (
            <GridItem key={a.id} sm={12} md={6} lg={4}>
              <Card isClickable isCompact onClick={() => selectAccount(a)}>
                <CardBody>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: "1.1em" }}>{a.name}</strong>
                    <Label color={a.is_active ? "green" : "grey"} isCompact>
                      {a.is_active ? "Active" : "Inactive"}
                    </Label>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: "0.9em" }}>
                    #{a.account_number}
                    {a.region && ` · ${a.region}`}
                    {a.country && ` · ${a.country}`}
                  </div>
                  {a.tam_type && (
                    <Label color="blue" isCompact style={{ marginTop: 8 }}>{a.tam_type}</Label>
                  )}
                </CardBody>
              </Card>
            </GridItem>
          ))}
        </Grid>
      )}

      <Modal isOpen={modalOpen} onClose={resetModal} variant="medium">
        <ModalHeader title="Add Account" description="Search Red Hat accounts by name or number" />
        <ModalBody>
          {/* Search bar */}
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

          {/* Search results list */}
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
                    onMouseEnter={(e) => { if (!r.already_imported) (e.currentTarget.style.background = "var(--pf-t--global--background--color--secondary--hover)"); }}
                    onMouseLeave={(e) => { if (!r.already_imported) (e.currentTarget.style.background = "transparent"); }}
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
                      <Label color="green" isCompact icon={<CheckCircleIcon />}>
                        Imported
                      </Label>
                    )}
                  </div>
                  {i < searchResults.length - 1 && <Divider />}
                </div>
              ))}
            </div>
          )}

          {/* Selected confirmation */}
          {selectedHydra && (
            <Alert variant="success" title={`Selected: ${selectedHydra.name} (#${selectedHydra.account_number})`} isInline style={{ marginBottom: 16 }} />
          )}

          <Divider style={{ marginBottom: 16 }} />

          {/* Manual form (pre-filled from Hydra selection) */}
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
              <TextInput
                id="number"
                value={form.account_number}
                onChange={(_e, v) => setForm({ ...form, account_number: v })}
                isDisabled={!!selectedHydra}
              />
            </FormGroup>
            <FormGroup label="Region" fieldId="region">
              <TextInput id="region" value={form.region} onChange={(_e, v) => setForm({ ...form, region: v })} />
            </FormGroup>
            <FormGroup label="Country" fieldId="country">
              <TextInput id="country" value={form.country} onChange={(_e, v) => setForm({ ...form, country: v })} />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleCreate}
            isLoading={saving}
            isDisabled={!form.name || !form.account_number}
          >
            {selectedHydra ? "Import Account" : "Create Account"}
          </Button>
          <Button variant="link" onClick={resetModal}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
