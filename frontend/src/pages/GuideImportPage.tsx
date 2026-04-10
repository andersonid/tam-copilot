import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Form,
  FormGroup,
  TextInput,
  FormSelect,
  FormSelectOption,
  Button,
  ActionGroup,
  Alert,
  Spinner,
  DatePicker,
  HelperText,
  HelperTextItem,
  FileUpload,
} from "@patternfly/react-core";
import { UploadIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { Customer, Product, DocumentType } from "../types/models";

const KCS_SUBTYPES = [
  { value: "solution", label: "Solution" },
  { value: "howto", label: "How-to" },
  { value: "qa", label: "Q&A" },
  { value: "troubleshooting", label: "Troubleshooting Guide" },
];

export function GuideImportPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [docTypeId, setDocTypeId] = useState("");
  const [kcsSubtype, setKcsSubtype] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [tagsStr, setTagsStr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/customers"),
      api.get("/products"),
      api.get("/document-types"),
    ])
      .then(([c, p, d]) => {
        setCustomers(c.data);
        setProducts(p.data);
        setDocTypes(d.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(
          err?.response?.data?.detail ??
            err?.message ??
            "Failed to load form data."
        );
        setLoading(false);
      });
  }, []);

  const selectedDocSlug = docTypes.find((d) => String(d.id) === docTypeId)?.slug;
  const isKcs = selectedDocSlug === "kcs-article";

  const handleFileChange = (_: unknown, f: File) => {
    setFile(f);
    setFilename(f.name);
    if (!title && f.name) {
      setTitle(f.name.replace(/\.(html?|htm)$/i, "").replace(/[-_]/g, " "));
    }
  };

  const handleFileClear = () => {
    setFile(null);
    setFilename("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".html") || dropped.name.endsWith(".htm"))) {
      setFile(dropped);
      setFilename(dropped.name);
      if (!title) {
        setTitle(dropped.name.replace(/\.(html?|htm)$/i, "").replace(/[-_]/g, " "));
      }
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("html_file", file);
      formData.append("title", title);
      formData.append("customer_id", customerId);
      formData.append("product_id", productId);
      formData.append("document_type_id", docTypeId);
      formData.append("touchpoint_date", date);
      formData.append("tags", tagsStr);
      if (isKcs && kcsSubtype) {
        formData.append("kcs_subtype", kcsSubtype);
      }
      const { data } = await api.post("/guides/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/guides/${data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to import guide");
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
        <UploadIcon style={{ marginRight: 8 }} />
        Import Guide
      </Title>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      <Form isHorizontal>
        <FormGroup label="HTML File" isRequired fieldId="html-file">
          <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            <FileUpload
              id="html-file"
              value={filename}
              filename={filename}
              filenamePlaceholder="Drag & drop an HTML file or click Browse"
              onFileInputChange={(_e, f) => handleFileChange(_e, f)}
              onClearClick={handleFileClear}
              browseButtonText="Browse"
              accept=".html,.htm"
            />
          </div>
          <HelperText>
            <HelperTextItem>Accepts .html and .htm files</HelperTextItem>
          </HelperText>
        </FormGroup>

        <FormGroup label="Title" isRequired fieldId="title">
          <TextInput
            id="title"
            value={title}
            onChange={(_e, v) => setTitle(v)}
            isRequired
            placeholder="Guide title"
          />
        </FormGroup>

        <FormGroup label="Customer" isRequired fieldId="customer">
          <FormSelect id="customer" value={customerId} onChange={(_e, v) => setCustomerId(v)} isRequired>
            <FormSelectOption value="" label="Select customer..." isPlaceholder />
            {customers.map((c) => (
              <FormSelectOption key={c.id} value={String(c.id)} label={c.name} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Product" isRequired fieldId="product">
          <FormSelect id="product" value={productId} onChange={(_e, v) => setProductId(v)} isRequired>
            <FormSelectOption value="" label="Select product..." isPlaceholder />
            {products.map((p) => (
              <FormSelectOption key={p.id} value={String(p.id)} label={p.name} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Document Type" isRequired fieldId="doctype">
          <FormSelect id="doctype" value={docTypeId} onChange={(_e, v) => setDocTypeId(v)} isRequired>
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

        <FormGroup label="Touchpoint Date" fieldId="date">
          <DatePicker value={date} onChange={(_e, val) => setDate(val)} />
        </FormGroup>

        <FormGroup label="Tags" fieldId="tags">
          <TextInput id="tags" value={tagsStr} onChange={(_e, v) => setTagsStr(v)} />
          <HelperText>
            <HelperTextItem>Comma-separated</HelperTextItem>
          </HelperText>
        </FormGroup>

        <ActionGroup>
          <Button
            variant="primary"
            icon={<UploadIcon />}
            onClick={handleSubmit}
            isLoading={submitting}
            isDisabled={submitting || !file || !title.trim() || !customerId || !productId || !docTypeId}
          >
            Import Guide
          </Button>
          <Button variant="link" onClick={() => navigate("/guides")}>
            Cancel
          </Button>
        </ActionGroup>
      </Form>
    </>
  );
}
