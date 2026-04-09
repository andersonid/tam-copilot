import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Title,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
  Spinner,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  Label,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import api from "../services/api";
import type { SearchResult } from "../types/models";

export function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [mode, setMode] = useState<"combined" | "keyword" | "semantic">("combined");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get("/search", { params: { query: q, mode } });
      setResults(data);
    } catch {
      setResults([]);
    }
    setLoading(false);
    setSearched(true);
  };

  useEffect(() => {
    if (params.get("q")) doSearch(params.get("q")!);
  }, [params.get("q"), mode]);

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 16 }}>Search Guides</Title>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <SearchInput
          placeholder="Search..."
          value={query}
          onChange={(_e, v) => setQuery(v)}
          onSearch={() => doSearch(query)}
          onClear={() => { setQuery(""); setResults([]); setSearched(false); }}
          style={{ maxWidth: 480 }}
        />
        <ToggleGroup>
          {(["combined", "keyword", "semantic"] as const).map((m) => (
            <ToggleGroupItem
              key={m}
              text={m.charAt(0).toUpperCase() + m.slice(1)}
              isSelected={mode === m}
              onChange={() => setMode(m)}
            />
          ))}
        </ToggleGroup>
      </div>

      {loading && <Spinner />}

      {!loading && searched && results.length === 0 && (
        <EmptyState>
          <EmptyStateHeader titleText="No results" headingLevel="h3" />
          <EmptyStateBody>Try a different query or search mode.</EmptyStateBody>
        </EmptyState>
      )}

      {results.length > 0 && (
        <Table aria-label="Search results" variant="compact">
          <Thead>
            <Tr><Th>Title</Th><Th>Customer</Th><Th>Product</Th><Th>Type</Th><Th>Date</Th><Th>Score</Th><Th>Source</Th></Tr>
          </Thead>
          <Tbody>
            {results.map((r) => (
              <Tr key={r.id} isClickable onRowClick={() => navigate(`/guides/${r.id}`)}>
                <Td>{r.title}</Td>
                <Td>{r.customer_name}</Td>
                <Td>{r.product_name}</Td>
                <Td>{r.document_type_name}</Td>
                <Td>{r.touchpoint_date}</Td>
                <Td>{(r.score * 100).toFixed(0)}%</Td>
                <Td><Label color={r.source === "semantic" ? "purple" : "blue"}>{r.source}</Label></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </>
  );
}
