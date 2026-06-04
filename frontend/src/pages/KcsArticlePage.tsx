import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Card,
  CardBody,
  Button,
  Alert,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
  Spinner,
  Switch,
} from "@patternfly/react-core";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

const KCS_SUBTYPES = [
  { value: "solution", label: "Solution" },
  { value: "howto", label: "How-to" },
  { value: "qa", label: "Q&A" },
  { value: "troubleshooting", label: "Troubleshooting Guide" },
];

export function KcsArticlePage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const navigate = useNavigate();

  const [subtype, setSubtype] = useState("solution");
  const [product, setProduct] = useState("");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [useKcsRag, setUseKcsRag] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; abstract: string; uri: string }>>([]);
  const [searching, setSearching] = useState(false);

  const handleSearchKcs = async () => {
    if (!notes.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get("/v1/kcs/search", {
        params: { q: notes.slice(0, 200), product, limit: 5 },
      });
      setSearchResults(data.articles ?? []);
    } catch {
      // non-blocking
    } finally {
      setSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedAccountId || !notes.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/guides", {
        customer_id: null,
        product_id: null,
        document_type_id: null,
        input_notes: notes,
        kcs_subtype: subtype,
        use_kcs_rag: useKcsRag,
        tags: ["kcs", product, version].filter(Boolean),
        touchpoint_date: new Date().toISOString().split("T")[0],
      });
      navigate(`/guides/${data.id}`);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { detail?: string } } })?.response;
      setError(typeof resp?.data?.detail === "string" ? resp.data.detail : "Generation failed");
      setGenerating(false);
    }
  };

  if (!selectedAccountId) {
    return (
      <>
        <Title headingLevel="h1">KCS Article Generator</Title>
        <EmptyState style={{ marginTop: 32 }}>
          <EmptyStateBody>Select an account to generate a KCS article.</EmptyStateBody>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Title headingLevel="h1" style={{ marginBottom: 24 }}>
        KCS Article — {selectedAccount?.name}
      </Title>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      <Card style={{ maxWidth: 700 }}>
        <CardBody>
          <Form>
            <FormGroup label="KCS Subtype" fieldId="kcs-sub">
              <FormSelect id="kcs-sub" value={subtype} onChange={(_e, v) => setSubtype(v)}>
                {KCS_SUBTYPES.map((s) => (
                  <FormSelectOption key={s.value} value={s.value} label={s.label} />
                ))}
              </FormSelect>
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Product" fieldId="kcs-prod">
                <TextInput id="kcs-prod" value={product} onChange={(_e, v) => setProduct(v)} placeholder="Red Hat OpenShift Container Platform" />
              </FormGroup>
              <FormGroup label="Version" fieldId="kcs-ver">
                <TextInput id="kcs-ver" value={version} onChange={(_e, v) => setVersion(v)} placeholder="4.14" />
              </FormGroup>
            </div>
            <FormGroup label="Problem Description / Raw Notes" isRequired fieldId="kcs-notes">
              <TextArea
                id="kcs-notes"
                value={notes}
                onChange={(_e, v) => setNotes(v)}
                rows={8}
                placeholder="Describe the issue, error messages, environment details..."
              />
            </FormGroup>
            <FormGroup fieldId="kcs-rag">
              <Switch
                id="kcs-rag"
                label="Enrich with existing KCS articles (RAG)"
                isChecked={useKcsRag}
                onChange={(_e, v) => setUseKcsRag(v)}
              />
            </FormGroup>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="primary"
                isLoading={generating}
                isDisabled={generating || !notes.trim()}
                onClick={handleGenerate}
              >
                Generate KCS Article
              </Button>
              <Button variant="secondary" onClick={handleSearchKcs} isLoading={searching} isDisabled={!notes.trim()}>
                Search Existing KCS
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>

      {searchResults.length > 0 && (
        <Card style={{ marginTop: 16, maxWidth: 700 }}>
          <CardBody>
            <Title headingLevel="h3" style={{ marginBottom: 12 }}>Related KCS Articles</Title>
            {searchResults.map((a) => (
              <div key={a.id} style={{ marginBottom: 12, borderBottom: "1px solid var(--pf-t--global--border--color--default)", paddingBottom: 8 }}>
                <a href={a.uri} target="_blank" rel="noreferrer"><strong>{a.title}</strong></a>
                <div style={{ fontSize: "0.9em", opacity: 0.8, marginTop: 4 }}>{a.abstract?.slice(0, 200)}</div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
