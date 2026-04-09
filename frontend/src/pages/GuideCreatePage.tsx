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
} from "@patternfly/react-core";
import api from "../services/api";
import type { Customer, Product, DocumentType, LLMProvider, SimilarGuide } from "../types/models";

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
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setError(msg || "Failed to create guide");
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
          <FormSelect
            id="customer"
            value={customerId}
            onChange={(_e, v) => setCustomerId(v)}
            isRequired
          >
            <FormSelectOption value="" label="Select customer..." isPlaceholder />
            {customers.map((c) => (
              <FormSelectOption key={c.id} value={String(c.id)} label={c.name} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Product" isRequired fieldId="product">
          <FormSelect
            id="product"
            value={productId}
            onChange={(_e, v) => setProductId(v)}
            isRequired
          >
            <FormSelectOption value="" label="Select product..." isPlaceholder />
            {products.map((p) => (
              <FormSelectOption key={p.id} value={String(p.id)} label={p.name} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Document Type" isRequired fieldId="doctype">
          <FormSelect
            id="doctype"
            value={docTypeId}
            onChange={(_e, v) => setDocTypeId(v)}
            isRequired
          >
            <FormSelectOption value="" label="Select type..." isPlaceholder />
            {docTypes.map((d) => (
              <FormSelectOption key={d.id} value={String(d.id)} label={d.name} />
            ))}
          </FormSelect>
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
