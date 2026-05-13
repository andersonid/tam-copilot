import { Title, EmptyState, EmptyStateBody } from "@patternfly/react-core";
import { useAccount } from "../context/AccountContext";

export function CasesPage() {
  const { selectedAccount } = useAccount();
  const scope = selectedAccount ? selectedAccount.name : "All Accounts";

  return (
    <>
      <Title headingLevel="h1">Cases — {scope}</Title>
      <EmptyState>
        <EmptyStateBody>
          Support cases will be displayed here after Hydra API integration (Phase 2).
        </EmptyStateBody>
      </EmptyState>
    </>
  );
}
