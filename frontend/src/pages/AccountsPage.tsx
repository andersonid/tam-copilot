import { useState } from "react";
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
} from "@patternfly/react-core";
import { useAccount, type AccountSummary } from "../context/AccountContext";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export function AccountsPage() {
  const { accounts, loading, refreshAccounts, setSelectedAccountId } = useAccount();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", account_number: "", region: "", country: "" });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post("/accounts", form);
      setModalOpen(false);
      setForm({ name: "", account_number: "", region: "", country: "" });
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
          <EmptyStateBody>No accounts registered yet.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => setModalOpen(true)}>Add your first account</Button>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variant="small"
      >
        <ModalHeader title="Add Account" />
        <ModalBody>
          <Form>
            <FormGroup label="Account Name" isRequired fieldId="name">
              <TextInput id="name" value={form.name} onChange={(_e, v) => setForm({ ...form, name: v })} />
            </FormGroup>
            <FormGroup label="Account Number" isRequired fieldId="number">
              <TextInput id="number" value={form.account_number} onChange={(_e, v) => setForm({ ...form, account_number: v })} />
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
          <Button variant="primary" onClick={handleCreate} isLoading={saving} isDisabled={!form.name || !form.account_number}>
            Create
          </Button>
          <Button variant="link" onClick={() => setModalOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
