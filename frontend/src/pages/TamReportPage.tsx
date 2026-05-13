import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title, Card, CardBody, Button, Alert,
  EmptyState, EmptyStateBody,
} from "@patternfly/react-core";
import { useAccount } from "../context/AccountContext";
import api from "../services/api";

export function TamReportPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!selectedAccountId) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post(`/v1/reports/tam/${selectedAccountId}`);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Report generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!selectedAccountId) {
    return (
      <>
        <Title headingLevel="h1">TAM Report</Title>
        <EmptyState style={{ marginTop: 32 }}>
          <EmptyStateBody>
            Select an account from the context switcher to generate a TAM Report.
          </EmptyStateBody>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Title headingLevel="h1" style={{ marginBottom: 24 }}>
        TAM Report — {selectedAccount?.name}
      </Title>

      <Card style={{ maxWidth: 600 }}>
        <CardBody>
          <p style={{ marginBottom: 16 }}>
            Generate a comprehensive TAM Report from all account data including
            clusters, entitlements, risks, action plans, touchpoints, and engagement.
          </p>
          <p style={{ marginBottom: 16, fontSize: "0.9em", color: "var(--pf-t--global--text--color--subtle)" }}>
            The report will be rendered as a formatted HTML document and saved
            in your content library for sharing.
          </p>
          <Button
            variant="primary"
            isLoading={generating}
            isDisabled={generating}
            onClick={handleGenerate}
          >
            Generate Report
          </Button>
        </CardBody>
      </Card>

      {error && <Alert variant="danger" title={error} isInline style={{ marginTop: 16 }} />}

      {result && (
        <Alert variant="success" title="Report generated successfully!" isInline style={{ marginTop: 16 }}>
          <p>{result.title} — {result.sections_count} sections</p>
          <Button
            variant="link"
            onClick={() => navigate(`/guides/${result.guide_id}`)}
            style={{ paddingLeft: 0, marginTop: 8 }}
          >
            View Report
          </Button>
        </Alert>
      )}
    </>
  );
}
