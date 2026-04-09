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
} from "@patternfly/react-core";
import { ExternalLinkAltIcon, RedoIcon, TrashIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { Guide } from "../types/models";

export function GuideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    api.get(`/guides/${id}`).then((r) => {
      setGuide(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleDelete = async () => {
    if (!confirm("Delete this guide permanently?")) return;
    await api.delete(`/guides/${id}`);
    navigate("/guides");
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data } = await api.post(`/guides/${id}/regenerate`);
      setGuide(data);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <Spinner />;
  if (!guide) return <Alert variant="danger" title="Guide not found" />;

  return (
    <>
      <Split hasGutter>
        <SplitItem isFilled>
          <Title headingLevel="h1" size="2xl">{guide.title}</Title>
        </SplitItem>
        <SplitItem>
          {guide.html_filename && (
            <Button
              variant="secondary"
              icon={<ExternalLinkAltIcon />}
              component="a"
              href={`/guides/html/${guide.html_filename}`}
              target="_blank"
            >
              View HTML
            </Button>
          )}
          <Button variant="secondary" icon={<RedoIcon />} onClick={handleRegenerate} isLoading={regenerating} style={{ marginLeft: 8 }}>
            Regenerate
          </Button>
          <Button variant="danger" icon={<TrashIcon />} onClick={handleDelete} style={{ marginLeft: 8 }}>
            Delete
          </Button>
        </SplitItem>
      </Split>

      <DescriptionList style={{ marginTop: 24 }}>
        <DescriptionListGroup>
          <DescriptionListTerm>Status</DescriptionListTerm>
          <DescriptionListDescription>
            <Label color={guide.status === "generated" ? "green" : guide.status === "error" ? "red" : "grey"}>
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
          <DescriptionListDescription>{guide.document_type?.name ?? "—"}</DescriptionListDescription>
        </DescriptionListGroup>
        {guide.kcs_subtype && (
          <DescriptionListGroup>
            <DescriptionListTerm>KCS Subtype</DescriptionListTerm>
            <DescriptionListDescription>{guide.kcs_subtype}</DescriptionListDescription>
          </DescriptionListGroup>
        )}
        <DescriptionListGroup>
          <DescriptionListTerm>Provider</DescriptionListTerm>
          <DescriptionListDescription>{guide.provider?.name ?? "—"} / {guide.model_used ?? "—"}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Touchpoint Date</DescriptionListTerm>
          <DescriptionListDescription>{guide.touchpoint_date}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Tags</DescriptionListTerm>
          <DescriptionListDescription>
            {guide.tags?.map((t) => <Label key={t.id} style={{ marginRight: 4 }}>{t.name}</Label>) ?? "—"}
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>Raw Input</DescriptionListTerm>
          <DescriptionListDescription>
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
              {guide.input_notes}
            </pre>
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </>
  );
}
