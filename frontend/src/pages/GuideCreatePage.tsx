import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Form,
  FormGroup,
  TextInput,
  TextArea,
  FormSelect,
  FormSelectOption,
  Button,
  ActionGroup,
  Alert,
  Spinner,
  DatePicker,
  HelperText,
  HelperTextItem,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  CodeBlock,
  CodeBlockCode,
  Icon,
} from "@patternfly/react-core";
import { ExclamationTriangleIcon } from "@patternfly/react-icons";
import api from "../services/api";
import { CreatableSelect } from "../components/CreatableSelect";
import type { Customer, Product, DocumentType, LLMProvider, SimilarGuide } from "../types/models";

interface LlmErrorDetail {
  summary: string;
  error_type: string;
  message: string;
  provider: string;
  model: string;
  elapsed_seconds: number;
  hint: string;
}

const KCS_SUBTYPES = [
  { value: "solution", label: "Solution" },
  { value: "howto", label: "How-to" },
  { value: "qa", label: "Q&A" },
  { value: "troubleshooting", label: "Troubleshooting Guide" },
];

export function GuideCreatePage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [docTypeId, setDocTypeId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [kcsSubtype, setKcsSubtype] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [tagsStr, setTagsStr] = useState("");

  const [similar, setSimilar] = useState<SimilarGuide[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [llmError, setLlmError] = useState<LlmErrorDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/customers"),
      api.get("/products"),
      api.get("/document-types"),
      api.get("/providers"),
    ])
      .then(([c, p, d, prov]) => {
        setCustomers(c.data);
        setProducts(p.data);
        setDocTypes(d.data);
        setProviders(prov.data.filter((pr: LLMProvider) => pr.is_active));
        const def = prov.data.find((pr: LLMProvider) => pr.is_default);
        if (def) setProviderId(String(def.id));
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(
          err?.response?.data?.detail ??
            err?.message ??
            "Failed to load form data. Please check the backend connection."
        );
        setLoading(false);
      });
  }, []);

  const selectedDocSlug = docTypes.find((d) => String(d.id) === docTypeId)?.slug;
  const isKcs = selectedDocSlug === "kcs-article";

  const checkSimilar = async () => {
    if (!notes.trim()) return;
    try {
      const { data } = await api.post("/guides/check-similar", { input_notes: notes });
      setSimilar(data.similar ?? []);
    } catch {
      /* non-blocking — similarity check is best-effort */
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    setLlmError(null);
    try {
      const payload = {
        customer_id: Number(customerId),
        product_id: Number(productId),
        document_type_id: Number(docTypeId),
        provider_id: providerId ? Number(providerId) : undefined,
        touchpoint_date: date,
        input_notes: notes,
        tags: tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        kcs_subtype: isKcs ? kcsSubtype || "solution" : undefined,
      };
      const { data } = await api.post("/guides", payload);
      navigate(`/guides/${data.id}`);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: LlmErrorDetail | string } } })?.response;
      if (resp?.status === 502 && resp?.data?.detail && typeof resp.data.detail === "object") {
        setLlmError(resp.data.detail as LlmErrorDetail);
      } else {
        const msg = typeof resp?.data?.detail === "string" ? resp.data.detail : "Failed to create guide";
        setError(msg);
      }
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner aria-label="Loading form data" />;

  if (loadError) {
    return (
      <Alert variant="danger" title="Failed to load form data" isInline>
        {loadError}
        <br />
        <Button variant="link" isInline onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>
        New Guide
      </Title>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      {llmError && (
        <Modal
          variant={ModalVariant.medium}
          isOpen
          onClose={() => setLlmError(null)}
        >
          <ModalHeader
            title={llmError.summary}
            titleIconVariant={() => (
              <Icon status="danger">
                <ExclamationTriangleIcon />
              </Icon>
            )}
          />
          <ModalBody>
            <Alert variant="warning" title="Troubleshooting Hint" isInline style={{ marginBottom: 16 }}>
              {llmError.hint}
            </Alert>
            <DescriptionList isHorizontal>
              <DescriptionListGroup>
                <DescriptionListTerm>Provider</DescriptionListTerm>
                <DescriptionListDescription>{llmError.provider}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Model</DescriptionListTerm>
                <DescriptionListDescription><code>{llmError.model}</code></DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Error Type</DescriptionListTerm>
                <DescriptionListDescription><code>{llmError.error_type}</code></DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Elapsed</DescriptionListTerm>
                <DescriptionListDescription>{llmError.elapsed_seconds}s</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
            <Title headingLevel="h4" size="md" style={{ marginTop: 16, marginBottom: 8 }}>
              Error Details
            </Title>
            <CodeBlock>
              <CodeBlockCode>{llmError.message}</CodeBlockCode>
            </CodeBlock>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={() => setLlmError(null)}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => { setLlmError(null); handleSubmit(); }}>
              Retry
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {similar.length > 0 && (
        <Alert variant="warning" title="Similar guides found" isInline style={{ marginBottom: 16 }}>
          {similar.map((s) => (
            <div key={s.id}>
              <strong>{s.title}</strong> — {s.customer_name} / {s.product_name} (
              {(s.score * 100).toFixed(0)}% match)
            </div>
          ))}
        </Alert>
      )}

      <Form isHorizontal>
        <FormGroup label="Customer" isRequired fieldId="customer">
          <CreatableSelect
            id="customer"
            value={customerId}
            onChange={setCustomerId}
            options={customers}
            onCreated={(c) => setCustomers((prev) => [...prev, c as Customer])}
            placeholder="Select customer..."
            createLabel="Create new customer"
            apiEndpoint="/customers"
            isRequired
          />
        </FormGroup>

        <FormGroup label="Product" isRequired fieldId="product">
          <CreatableSelect
            id="product"
            value={productId}
            onChange={setProductId}
            options={products}
            onCreated={(p) => setProducts((prev) => [...prev, p as Product])}
            placeholder="Select product..."
            createLabel="Create new product"
            apiEndpoint="/products"
            isRequired
          />
        </FormGroup>

        <FormGroup label="Document Type" isRequired fieldId="doctype">
          <CreatableSelect
            id="doctype"
            value={docTypeId}
            onChange={setDocTypeId}
            options={docTypes}
            onCreated={(d) => setDocTypes((prev) => [...prev, d as DocumentType])}
            placeholder="Select type..."
            createLabel="Create new document type"
            apiEndpoint="/document-types"
            isRequired
          />
        </FormGroup>

        {isKcs && (
          <FormGroup label="KCS Subtype" fieldId="kcs-subtype">
            <FormSelect id="kcs-subtype" value={kcsSubtype} onChange={(_e, v) => setKcsSubtype(v)}>
              <FormSelectOption value="" label="Select subtype..." isPlaceholder />
              {KCS_SUBTYPES.map((s) => (
                <FormSelectOption key={s.value} value={s.value} label={s.label} />
              ))}
            </FormSelect>
          </FormGroup>
        )}

        <FormGroup label="LLM Provider" fieldId="provider">
          <FormSelect id="provider" value={providerId} onChange={(_e, v) => setProviderId(v)}>
            {providers.map((p) => (
              <FormSelectOption
                key={p.id}
                value={String(p.id)}
                label={`${p.name}${p.is_default ? " (default)" : ""}`}
              />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Touchpoint Date" fieldId="date">
          <DatePicker value={date} onChange={(_e, val) => setDate(val)} />
        </FormGroup>

        <FormGroup label="Tags" fieldId="tags">
          <TextInput id="tags" value={tagsStr} onChange={(_e, v) => setTagsStr(v)} />
          <HelperText>
            <HelperTextItem>Comma-separated</HelperTextItem>
          </HelperText>
        </FormGroup>

        <FormGroup label="Raw Notes / Input" isRequired fieldId="notes">
          <TextArea
            id="notes"
            value={notes}
            onChange={(_e, v) => setNotes(v)}
            rows={12}
            isRequired
            onBlur={checkSimilar}
          />
        </FormGroup>

        <ActionGroup>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting || !customerId || !productId || !docTypeId || !notes.trim()}
          >
            Generate Guide
          </Button>
          <Button variant="link" onClick={() => navigate("/guides")}>
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    </>
  );
}
