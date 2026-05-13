import { Title, EmptyState, EmptyStateBody } from "@patternfly/react-core";

export function ManagerPage() {
  return (
    <>
      <Title headingLevel="h1">Manager Dashboard</Title>
      <EmptyState>
        <EmptyStateBody>
          Manager dashboard with TAM allocation, NPS, certifications, and coverage metrics will be implemented in Phase 3.
        </EmptyStateBody>
      </EmptyState>
    </>
  );
}
