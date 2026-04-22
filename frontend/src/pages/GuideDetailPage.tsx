import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Title,
  Button,
  Spinner,
  Label,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Split,
  SplitItem,
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
  ClipboardCopy,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  CodeBlock,
  CodeBlockCode,
  Icon,
} from "@patternfly/react-core";
import {
  ExternalLinkAltIcon,
  RedoIcon,
  TrashIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  SyncAltIcon,
  LinkIcon,
} from "@patternfly/react-icons";
import api from "../services/api";
import type { Guide } from "../types/models";

interface LlmErrorDetail {
  summary: string;
  error_type: string;
  message: string;
  provider: string;
  model: string;
  elapsed_seconds: number;
  hint: string;
}

export function GuideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [llmError, setLlmError] = useState<LlmErrorDetail | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ access_token: string; public_url: string } | null>(null);
  const [rotatingToken, setRotatingToken] = useState(false);

  const load = () => {
    setError("");
    api
      .get(`/guides/${id}`)
      .then((r) => {
        setGuide(r.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load guide");
        setLoading(false);
      });
  };

  const loadToken = () => {
    api.get(`/guides/${id}/token`).then((r) => setTokenInfo(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    loadToken();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Delete this guide permanently?")) return;
    setActionError("");
    try {
      await api.delete(`/guides/${id}`);
      navigate("/guides");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(msg || "Failed to delete guide");
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setActionError("");
    setLlmError(null);
    try {
      const { data } = await api.post(`/guides/${id}/regenerate`);
      setGuide(data);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { detail?: LlmErrorDetail | string } } })?.response;
      if (resp?.status === 502 && resp?.data?.detail && typeof resp.data.detail === "object") {
        setLlmError(resp.data.detail as LlmErrorDetail);
      } else {
        const msg = typeof resp?.data?.detail === "string" ? resp.data.detail : "Regeneration failed";
        setActionError(msg);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleRotateToken = async () => {
    if (!confirm("Rotate access token? The old link will stop working.")) return;
    setRotatingToken(true);
    try {
      const { data } = await api.post(`/guides/${id}/rotate-token`);
      setTokenInfo(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setActionError(msg || "Failed to rotate token");
    } finally {
      setRotatingToken(false);
    }
  };

  if (loading) return <Spinner aria-label="Loading guide" />;

  if (error || !guide) {
    return (
      <EmptyState
        headingLevel="h2"
        titleText="Guide not found"
        icon={ExclamationCircleIcon}
      >
        <EmptyStateBody>{error || "The requested guide does not exist."}</EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <Button variant="primary" onClick={() => navigate("/guides")}>
              Back to Guides
            </Button>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    );
  }

  const publicUrl = `${window.location.origin}/public/guides/${guide.id}`;

  const handleViewHtml = async () => {
    if (!guide.html_filename) return;
    try {
      const { data } = await api.get(`/guides/html/${guide.html_filename}`, { responseType: "text" });
      const blob = new Blob([data], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setActionError("Failed to load guide HTML");
    }
  };

  return (
    <>
      {actionError && (
        <Alert
          variant="danger"
          title={actionError}
          isInline
          style={{ marginBottom: 16 }}
          actionClose={<Button variant="plain" onClick={() => setActionError("")}>✕</Button>}
        />
      )}

      <Split hasGutter>
        <SplitItem isFilled>
          <Title headingLevel="h1" size="2xl">
            {guide.title}
          </Title>
        </SplitItem>
        <SplitItem>
          {guide.html_filename && (
            <Button
              variant="secondary"
              icon={<ExternalLinkAltIcon />}
              onClick={handleViewHtml}
            >
              View HTML
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<RedoIcon />}
            onClick={handleRegenerate}
            isLoading={regenerating}
            style={{ marginLeft: 8 }}
          >
            Regenerate
          </Button>
          <Button
            variant="danger"
            icon={<TrashIcon />}
            onClick={handleDelete}
            style={{ marginLeft: 8 }}
          >
            Delete
          </Button>
        </SplitItem>
      </Split>

      <DescriptionList style={{ marginTop: 24 }}>
        <DescriptionListGroup>
          <DescriptionListTerm>
            <LinkIcon style={{ marginRight: 6 }} />
            Public Share Link
          </DescriptionListTerm>
          <DescriptionListDescription>
            <ClipboardCopy isReadOnly style={{ maxWidth: 500 }}>
              {publicUrl}
            </ClipboardCopy>
            <p style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
              Recipients will need the access token below to view this guide.
            </p>
          </DescriptionListDescription>
        </DescriptionListGroup>
        {tokenInfo && (
          <DescriptionListGroup>
            <DescriptionListTerm>
              <KeyIcon style={{ marginRight: 6 }} />
              Access Token
            </DescriptionListTerm>
            <DescriptionListDescription>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <ClipboardCopy isReadOnly style={{ maxWidth: 400 }}>
                  {tokenInfo.access_token}
                </ClipboardCopy>
                <Button
                  variant="secondary"
                  icon={<SyncAltIcon />}
                  onClick={handleRotateToken}
                  isLoading={rotatingToken}
                  size="sm"
                >
                  Rotate Token
                </Button>
              </div>
            </DescriptionListDescription>
          </DescriptionListGroup>
        )}
        <DescriptionListGroup>
          <DescriptionListTerm>Status</DescriptionListTerm>
          <DescriptionListDescription>
            <Label
              color={
                guide.status === "generated"
                  ? "green"
                  : guide.status === "error"
                    ? "red"
                    : "grey"
              }
            >
              {guide.status}
            </Label>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Customer</DescriptionListTerm>
          <DescriptionListDescription>{guide.customer?.name ?? "—"}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Product</DescriptionListTerm>
          <DescriptionListDescription>{guide.product?.name ?? "—"}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Document Type</DescriptionListTerm>
          <DescriptionListDescription>
            {guide.document_type?.name ?? "—"}
          </DescriptionListDescription>
        </DescriptionListGroup>
        {guide.kcs_subtype && (
          <DescriptionListGroup>
            <DescriptionListTerm>KCS Subtype</DescriptionListTerm>
            <DescriptionListDescription>{guide.kcs_subtype}</DescriptionListDescription>
          </DescriptionListGroup>
        )}
        <DescriptionListGroup>
          <DescriptionListTerm>Provider</DescriptionListTerm>
          <DescriptionListDescription>
            {guide.provider?.name ?? "—"} / {guide.model_used ?? "—"}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Touchpoint Date</DescriptionListTerm>
          <DescriptionListDescription>{guide.touchpoint_date}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Tags</DescriptionListTerm>
          <DescriptionListDescription>
            {guide.tags?.map((t) => (
              <Label key={t.id} style={{ marginRight: 4 }}>
                {t.name}
              </Label>
            )) ?? "—"}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Raw Input</DescriptionListTerm>
          <DescriptionListDescription>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 300,
                overflow: "auto",
                background: "#f5f5f5",
                padding: 12,
                borderRadius: 4,
              }}
            >
              {guide.input_notes}
            </pre>
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>

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
            <Button variant="secondary" onClick={() => { setLlmError(null); handleRegenerate(); }}>
              Retry
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
