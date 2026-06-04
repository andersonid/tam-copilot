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

const CADENCES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

export function SchedulePage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const navigate = useNavigate();

  const [cadence, setCadence] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedAccountId) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/guides", {
        customer_id: null,
        product_id: null,
        document_type_id: null,
        input_notes: `## Schedule Plan\n- Cadence: ${cadence}\n- Start: ${startDate}\n- End: ${endDate || "Ongoing"}\n- Topics: ${topics}\n\n${notes}`,
        tags: ["schedule", cadence].filter(Boolean),
        touchpoint_date: startDate,
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
        <Title headingLevel="h1">Schedule Generator</Title>
        <EmptyState style={{ marginTop: 32 }}>
          <EmptyStateBody>Select an account to generate a schedule plan.</EmptyStateBody>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <Title headingLevel="h1" style={{ marginBottom: 24 }}>
        Schedule Plan — {selectedAccount?.name}
      </Title>

      {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />}

      <Card style={{ maxWidth: 700 }}>
        <CardBody>
          <Form>
            <FormGroup label="Cadence" fieldId="sched-cadence">
              <FormSelect id="sched-cadence" value={cadence} onChange={(_e, v) => setCadence(v)}>
                {CADENCES.map((c) => (
                  <FormSelectOption key={c.value} value={c.value} label={c.label} />
                ))}
              </FormSelect>
            </FormGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FormGroup label="Start Date" fieldId="sched-start">
                <TextInput id="sched-start" type="date" value={startDate} onChange={(_e, v) => setStartDate(v)} />
              </FormGroup>
              <FormGroup label="End Date" fieldId="sched-end">
                <TextInput id="sched-end" type="date" value={endDate} onChange={(_e, v) => setEndDate(v)} placeholder="Leave empty for ongoing" />
              </FormGroup>
            </div>
            <FormGroup label="Key Topics / Agenda Items" fieldId="sched-topics">
              <TextArea
                id="sched-topics"
                value={topics}
                onChange={(_e, v) => setTopics(v)}
                rows={3}
                placeholder="e.g. Architecture review, Upgrade planning, Security hardening..."
              />
            </FormGroup>
            <FormGroup label="Additional Notes" fieldId="sched-notes">
              <TextArea
                id="sched-notes"
                value={notes}
                onChange={(_e, v) => setNotes(v)}
                rows={5}
                placeholder="Context, goals, constraints..."
              />
            </FormGroup>
            <Button
              variant="primary"
              isLoading={generating}
              isDisabled={generating}
              onClick={handleGenerate}
            >
              Generate Schedule
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
