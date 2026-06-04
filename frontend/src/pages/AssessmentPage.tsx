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
} from "@patternfly/react-core";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

const ASSESSMENT_TYPES = [
  { value: "health-check", label: "Health Check" },
  { value: "architecture-review", label: "Architecture Review" },
  { value: "security-assessment", label: "Security Assessment" },
  { value: "performance-review", label: "Performance Review" },
  { value: "upgrade-readiness", label: "Upgrade Readiness" },
  { value: "custom", label: "Custom Assessment" },
];

export function AssessmentPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const navigate = useNavigate();

  const [assessmentType, setAssessmentType] = useState("health-check");
  const [product, setProduct] = useState("");
  const [scope, setScope] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedAccountId || !notes.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/guides", {
        customer_id: null,
        product_id: null,
        document_type_id: null,
        input_notes: `## Assessment Type: ${assessmentType}\n## Product: ${product}\n## Scope: ${scope}\n\n${notes}`,
        tags: ["assessment", assessmentType, product].filter(Boolean),
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
        <Title headingLevel="h1">Assessment Generator</Title>
        <EmptyState style={{ marginTop: 32 }}>
          <EmptyStateBody>Select an account to generate an assessment.</EmptyStateBody>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Title headingLevel="h1" style={{ marginBottom: 24 }}>
        Assessment — {selectedAccount?.name}
      </Title>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      <Card style={{ maxWidth: 700 }}>
        <CardBody>
          <Form>
            <FormGroup label="Assessment Type" fieldId="assess-type">
              <FormSelect id="assess-type" value={assessmentType} onChange={(_e, v) => setAssessmentType(v)}>
                {ASSESSMENT_TYPES.map((t) => (
                  <FormSelectOption key={t.value} value={t.value} label={t.label} />
                ))}
              </FormSelect>
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Product" fieldId="assess-prod">
                <TextInput id="assess-prod" value={product} onChange={(_e, v) => setProduct(v)} placeholder="Red Hat OpenShift Container Platform" />
              </FormGroup>
              <FormGroup label="Scope" fieldId="assess-scope">
                <TextInput id="assess-scope" value={scope} onChange={(_e, v) => setScope(v)} placeholder="Production cluster, All environments..." />
              </FormGroup>
            </div>
            <FormGroup label="Context & Findings" isRequired fieldId="assess-notes">
              <TextArea
                id="assess-notes"
                value={notes}
                onChange={(_e, v) => setNotes(v)}
                rows={10}
                placeholder="Describe the current state, findings, concerns, and any specific areas to assess..."
              />
            </FormGroup>
            <Button
              variant="primary"
              isLoading={generating}
              isDisabled={generating || !notes.trim()}
              onClick={handleGenerate}
            >
              Generate Assessment
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
