import { useEffect, useState } from "react";
import {
  Title,
  Button,
  TextInput,
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Form,
  Label,
  Spinner,
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { PlusCircleIcon, CheckCircleIcon, CogIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { LLMProvider } from "../types/models";

const PROVIDER_TYPES = [
  { value: "openai_compatible", label: "OpenAI-compatible (LiteMaaS, OpenAI, etc.)" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google_gemini", label: "Google Gemini" },
];

export function ProvidersPage() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; msg: string } | null>(
    null
  );

  const [name, setName] = useState("");
  const [provType, setProvType] = useState("openai_compatible");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const load = () => {
    setError("");
    api
      .get("/providers")
      .then((r) => {
        setProviders(r.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load providers");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setActionError("");
    try {
      await api.post("/providers", {
        name,
        provider_type: provType,
        base_url: baseUrl || null,
        api_key: apiKey,
        default_model: model || null,
      });
      setModalOpen(false);
      setName("");
      setBaseUrl("");
      setApiKey("");
      setModel("");
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(msg || "Failed to create provider");
    }
  };

  const handleTest = async (p: LLMProvider) => {
    setTestResult(null);
    try {
      await api.post(`/providers/${p.id}/test`);
      setTestResult({ id: p.id, ok: true, msg: "Connection successful" });
    } catch {
      setTestResult({ id: p.id, ok: false, msg: "Connection failed" });
    }
  };

  const handleSetDefault = async (p: LLMProvider) => {
    setActionError("");
    try {
      await api.post(`/providers/${p.id}/set-default`);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(msg || "Failed to set default provider");
    }
  };

  if (loading) return <Spinner aria-label="Loading providers" />;

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 16 }}>
        LLM Providers
      </Title>

      {error && (
        <Alert variant="danger" title="Error loading providers" isInline style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      {actionError && (
        <Alert variant="danger" title={actionError} isInline style={{ marginBottom: 16 }} />
      )}

      <Button
        variant="primary"
        icon={<PlusCircleIcon />}
        onClick={() => setModalOpen(true)}
        style={{ marginBottom: 16 }}
      >
        Add Provider
      </Button>

      {!error && providers.length === 0 ? (
        <EmptyState headingLevel="h3" titleText="No providers configured" icon={CogIcon}>
          <EmptyStateBody>
            Add an LLM provider to start generating guides. LiteMaaS, OpenAI, Anthropic, and
            Google Gemini are supported.
          </EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Add Provider
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        !error && (
          <Table aria-label="Providers" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Model</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {providers.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    {p.name}
                    {p.is_default && (
                      <Label color="blue" style={{ marginLeft: 8 }}>
                        Default
                      </Label>
                    )}
                  </Td>
                  <Td>{p.provider_type}</Td>
                  <Td>{p.default_model ?? "—"}</Td>
                  <Td>
                    <Label color={p.is_active ? "green" : "grey"}>
                      {p.is_active ? "Active" : "Inactive"}
                    </Label>
                    {testResult?.id === p.id && (
                      <Label color={testResult.ok ? "green" : "red"} style={{ marginLeft: 4 }}>
                        {testResult.msg}
                      </Label>
                    )}
                  </Td>
                  <Td>
                    <Button variant="secondary" size="sm" onClick={() => handleTest(p)}>
                      Test
                    </Button>
                    {!p.is_default && (
                      <Button
                        variant="link"
                        size="sm"
                        icon={<CheckCircleIcon />}
                        onClick={() => handleSetDefault(p)}
                        style={{ marginLeft: 4 }}
                      >
                        Set Default
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} variant="medium">
        <ModalHeader title="Add LLM Provider" />
        <ModalBody>
          {actionError && (
            <Alert variant="danger" title={actionError} isInline style={{ marginBottom: 12 }} />
          )}
          <Form>
            <FormGroup label="Name" isRequired fieldId="prov-name">
              <TextInput id="prov-name" value={name} onChange={(_e, v) => setName(v)} />
            </FormGroup>
            <FormGroup label="Type" isRequired fieldId="prov-type">
              <FormSelect id="prov-type" value={provType} onChange={(_e, v) => setProvType(v)}>
                {PROVIDER_TYPES.map((t) => (
                  <FormSelectOption key={t.value} value={t.value} label={t.label} />
                ))}
              </FormSelect>
            </FormGroup>
            <FormGroup label="Base URL" fieldId="prov-url">
              <TextInput id="prov-url" value={baseUrl} onChange={(_e, v) => setBaseUrl(v)} />
              <HelperText>
                <HelperTextItem>
                  Required for OpenAI-compatible, leave empty for Anthropic/Gemini
                </HelperTextItem>
              </HelperText>
            </FormGroup>
            <FormGroup label="API Key" isRequired fieldId="prov-key">
              <TextInput
                id="prov-key"
                type="password"
                value={apiKey}
                onChange={(_e, v) => setApiKey(v)}
              />
            </FormGroup>
            <FormGroup label="Default Model" fieldId="prov-model">
              <TextInput
                id="prov-model"
                value={model}
                onChange={(_e, v) => setModel(v)}
                placeholder="e.g. qwen3-14b"
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleCreate}
            isDisabled={!name.trim() || !apiKey.trim()}
          >
            Create
          </Button>
          <Button variant="link" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
