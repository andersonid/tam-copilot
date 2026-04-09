import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Button,
  Spinner,
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { PlusCircleIcon, CubesIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { Guide } from "../types/models";

const STATUS_COLORS: Record<string, "blue" | "green" | "red" | "orange" | "grey"> = {
  draft: "grey",
  generating: "blue",
  generated: "green",
  error: "red",
};

export function GuidesPage() {
  const navigate = useNavigate();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/guides").then((r) => {
      setGuides(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Title headingLevel="h1" size="2xl">Guides</Title>
          </ToolbarItem>
          <ToolbarItem align={{ default: "alignEnd" }}>
            <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => navigate("/guides/new")}>
              New Guide
            </Button>
          </ToolbarItem>
        </ToolbarContent>
      </Toolbar>

      {guides.length === 0 ? (
        <EmptyState headingLevel="h2" titleText="No guides yet" icon={CubesIcon}>
          <EmptyStateBody>Create your first guide to get started.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => navigate("/guides/new")}>New Guide</Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        <Table aria-label="Guides table" variant="compact">
          <Thead>
            <Tr>
              <Th>Title</Th>
              <Th>Customer</Th>
              <Th>Product</Th>
              <Th>Type</Th>
              <Th>Date</Th>
              <Th>Status</Th>
            </Tr>
          </Thead>
          <Tbody>
            {guides.map((g) => (
              <Tr key={g.id} isClickable onRowClick={() => navigate(`/guides/${g.id}`)}>
                <Td>{g.title}</Td>
                <Td>{g.customer?.name ?? "—"}</Td>
                <Td>{g.product?.name ?? "—"}</Td>
                <Td>{g.document_type?.name ?? "—"}</Td>
                <Td>{g.touchpoint_date}</Td>
                <Td>
                  <Label color={STATUS_COLORS[g.status] ?? "grey"}>{g.status}</Label>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
