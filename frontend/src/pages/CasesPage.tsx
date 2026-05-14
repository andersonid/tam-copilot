import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Title, Spinner, EmptyState, EmptyStateBody, Label,
  Button, Alert, Toolbar, ToolbarContent, ToolbarItem,
  ToolbarGroup, TextInput,
  Select, SelectOption, MenuToggle,
  Pagination, PaginationVariant,
  Flex, FlexItem, Checkbox,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import SyncAltIcon from "@patternfly/react-icons/dist/esm/icons/sync-alt-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import SearchIcon from "@patternfly/react-icons/dist/esm/icons/search-icon";
import { useAccount } from "../context/AccountContext";
import { useSync } from "../hooks/useSync";
import api from "../services/api";

interface SupportCase {
  id: number;
  account_id: number;
  case_number: string;
  summary: string;
  status: string;
  severity: string | null;
  product: string | null;
  version: string | null;
  case_type: string | null;
  owner: string | null;
  contact_name: string | null;
  contact_sso: string | null;
  sla: string | null;
  sbr_groups: string | null;
  is_proactive: boolean;
  is_escalated: boolean;
  cluster_id: string | null;
  created_date: string | null;
  last_modified_date: string | null;
  last_modified_by: string | null;
  closed_date: string | null;
  resolution: string | null;
}

const SEV_COLORS: Record<string, "red" | "orange" | "gold" | "blue" | "grey"> = {
  "1": "red", "2": "orange", "3": "gold", "4": "blue",
};
const sevColor = (s: string | null) => (s ? SEV_COLORS[s.charAt(0)] || "grey" : "grey");

const STATUS_COLORS: Record<string, "green" | "blue" | "orange" | "red" | "grey"> = {
  closed: "grey",
  "waiting on red hat": "red",
  "waiting on customer": "orange",
};
const statusColor = (s: string) => STATUS_COLORS[s.toLowerCase()] || "blue";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PER_PAGE = 20;

export function CasesPage() {
  const { selectedAccountId, selectedAccount } = useAccount();
  const [items, setItems] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, syncing, error: syncError } = useSync(selectedAccountId);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<{ index: number; direction: "asc" | "desc" }>({ index: 0, direction: "desc" });

  const [statusOpen, setStatusOpen] = useState(false);
  const [sevOpen, setSevOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params: Record<string, any> = {};
    if (selectedAccountId) params.account_id = selectedAccountId;
    api.get("/cases", { params }).then(({ data }) => { setItems(data); setPage(1); }).finally(() => setLoading(false));
  }, [selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    const result = await triggerSync("cases");
    if (result) fetchData();
  };

  const statuses = useMemo(() => Array.from(new Set(items.map((i) => i.status))).sort(), [items]);
  const severities = useMemo(() => Array.from(new Set(items.map((i) => i.severity).filter(Boolean) as string[])).sort(), [items]);
  const products = useMemo(() => Array.from(new Set(items.map((i) => i.product).filter(Boolean) as string[])).sort(), [items]);

  type SortableField = "case_number" | "summary" | "owner" | "last_modified_date" | "created_date" | "severity" | "status";
  const sortableColumns: SortableField[] = ["case_number", "summary", "owner", "last_modified_date", "created_date", "severity", "status"];

  const onSort = (_event: React.MouseEvent, index: number, direction: "asc" | "desc") => {
    setSortBy({ index, direction });
    setPage(1);
  };

  const filtered = useMemo(() => {
    let r = items;
    if (searchText) {
      const q = searchText.toLowerCase();
      r = r.filter((c) =>
        c.case_number.includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        (c.owner || "").toLowerCase().includes(q) ||
        (c.product || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((c) => c.status === statusFilter);
    if (sevFilter !== "all") r = r.filter((c) => c.severity === sevFilter);
    if (productFilter !== "all") r = r.filter((c) => c.product === productFilter);
    if (escalatedOnly) r = r.filter((c) => c.is_escalated);

    if (sortBy.index !== undefined && sortBy.direction) {
      const field = sortableColumns[sortBy.index];
      const dir = sortBy.direction === "asc" ? 1 : -1;
      r = [...r].sort((a, b) => {
        const va = a[field] ?? "";
        const vb = b[field] ?? "";
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }
    return r;
  }, [items, searchText, statusFilter, sevFilter, productFilter, escalatedOnly, sortBy]);

  const paged = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtered, page]);

  const scope = selectedAccount ? selectedAccount.name : "All Accounts";
  if (loading) return <Spinner aria-label="Loading" />;

  const openCount = items.filter((i) => !i.status.toLowerCase().includes("closed")).length;
  const closedCount = items.length - openCount;

  const clearFilters = () => { setStatusFilter("all"); setSevFilter("all"); setProductFilter("all"); setSearchText(""); setEscalatedOnly(false); setPage(1); };
  const hasFilters = statusFilter !== "all" || sevFilter !== "all" || productFilter !== "all" || searchText !== "" || escalatedOnly;

  return (
    <>
      {/* Header */}
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem><Title headingLevel="h1">Cases — {scope}</Title></ToolbarItem>
          <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarItem>
              <Label color="blue" isCompact style={{ marginRight: 8 }}>{openCount} open</Label>
              <Label color="grey" isCompact>{closedCount} closed</Label>
            </ToolbarItem>
            {selectedAccountId && (
              <ToolbarItem>
                <Button variant="secondary" icon={<SyncAltIcon />} isLoading={syncing} isDisabled={syncing} onClick={handleSync}>
                  Sync from Hydra
                </Button>
              </ToolbarItem>
            )}
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>

      {syncError && <Alert variant="danger" title={syncError} isInline style={{ marginBottom: 16 }} />}

      {items.length === 0 ? (
        <EmptyState>
          <EmptyStateBody>
            {selectedAccountId
              ? 'No cases cached. Click "Sync from Hydra" to pull support cases for this account.'
              : "Select an account to view support cases."}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {/* Filters */}
          <Toolbar style={{ paddingTop: 0 }}>
            <ToolbarContent>
              <ToolbarItem style={{ flex: 1, maxWidth: 350 }}>
                <TextInput
                  type="search"
                  aria-label="Search"
                  placeholder="Search by case ID, title, owner, product..."
                  value={searchText}
                  onChange={(_e, val) => { setSearchText(val); setPage(1); }}
                  customIcon={<SearchIcon />}
                />
              </ToolbarItem>
              <ToolbarItem>
                <Select
                  isOpen={statusOpen}
                  selected={statusFilter}
                  onSelect={(_e, val) => { setStatusFilter(val as string); setStatusOpen(false); setPage(1); }}
                  onOpenChange={setStatusOpen}
                  toggle={(toggleRef) => (
                    <MenuToggle ref={toggleRef} onClick={() => setStatusOpen(!statusOpen)} isExpanded={statusOpen} style={{ minWidth: 160 }}>
                      {statusFilter === "all" ? "Status" : statusFilter}
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="all">All statuses</SelectOption>
                  {statuses.map((s) => <SelectOption key={s} value={s}>{s}</SelectOption>)}
                </Select>
              </ToolbarItem>
              <ToolbarItem>
                <Select
                  isOpen={sevOpen}
                  selected={sevFilter}
                  onSelect={(_e, val) => { setSevFilter(val as string); setSevOpen(false); setPage(1); }}
                  onOpenChange={setSevOpen}
                  toggle={(toggleRef) => (
                    <MenuToggle ref={toggleRef} onClick={() => setSevOpen(!sevOpen)} isExpanded={sevOpen} style={{ minWidth: 140 }}>
                      {sevFilter === "all" ? "Severity" : sevFilter}
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="all">All severities</SelectOption>
                  {severities.map((s) => <SelectOption key={s} value={s}>{s}</SelectOption>)}
                </Select>
              </ToolbarItem>
              <ToolbarItem>
                <Select
                  isOpen={productOpen}
                  selected={productFilter}
                  onSelect={(_e, val) => { setProductFilter(val as string); setProductOpen(false); setPage(1); }}
                  onOpenChange={setProductOpen}
                  toggle={(toggleRef) => (
                    <MenuToggle ref={toggleRef} onClick={() => setProductOpen(!productOpen)} isExpanded={productOpen} style={{ minWidth: 180 }}>
                      {productFilter === "all" ? "Product" : productFilter}
                    </MenuToggle>
                  )}
                >
                  <SelectOption value="all">All products</SelectOption>
                  {products.map((p) => <SelectOption key={p} value={p}>{p}</SelectOption>)}
                </Select>
              </ToolbarItem>
              <ToolbarItem>
                <Checkbox
                  id="escalated-filter"
                  label="Escalated"
                  isChecked={escalatedOnly}
                  onChange={(_e, checked) => { setEscalatedOnly(checked); setPage(1); }}
                />
              </ToolbarItem>
              {hasFilters && (
                <ToolbarItem>
                  <Button variant="link" onClick={clearFilters}>Clear filters</Button>
                </ToolbarItem>
              )}
            </ToolbarContent>
          </Toolbar>

          {/* Pagination top */}
          <Flex justifyContent={{ default: "justifyContentFlexEnd" }} style={{ padding: "0 16px 8px" }}>
            <FlexItem>
              <Pagination
                itemCount={filtered.length}
                perPage={PER_PAGE}
                page={page}
                onSetPage={(_e, p) => setPage(p)}
                variant={PaginationVariant.top}
                isCompact
              />
            </FlexItem>
          </Flex>

          {filtered.length === 0 ? (
            <EmptyState><EmptyStateBody>No cases match the current filters.</EmptyStateBody></EmptyState>
          ) : (
            <Table aria-label="Support Cases" variant="compact">
              <Thead>
                <Tr>
                  <Th width={10} sort={{ sortBy, onSort, columnIndex: 0 }}>Case ID</Th>
                  <Th sort={{ sortBy, onSort, columnIndex: 1 }}>Title</Th>
                  <Th width={10} sort={{ sortBy, onSort, columnIndex: 2 }}>Owner</Th>
                  <Th width={12} sort={{ sortBy, onSort, columnIndex: 3 }}>Modified by</Th>
                  <Th width={10} sort={{ sortBy, onSort, columnIndex: 4 }}>Created</Th>
                  <Th width={10} sort={{ sortBy, onSort, columnIndex: 5 }}>Severity</Th>
                  <Th width={10} sort={{ sortBy, onSort, columnIndex: 6 }}>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {paged.map((c) => (
                  <Tr key={c.id}>
                    <Td dataLabel="Case ID">
                      <a href={`https://access.redhat.com/support/cases/#/case/${c.case_number}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.case_number} <ExternalLinkAltIcon style={{ fontSize: "0.7em", verticalAlign: "text-top" }} />
                      </a>
                    </Td>
                    <Td dataLabel="Title">
                      <div style={{ maxWidth: 420, wordBreak: "break-word" }}>
                        {c.summary}
                        {c.is_proactive && <Label color="cyan" isCompact style={{ marginLeft: 6 }}>Proactive</Label>}
                        {c.is_escalated && <Label color="red" isCompact style={{ marginLeft: 6 }}>Escalated</Label>}
                      </div>
                    </Td>
                    <Td dataLabel="Owner">{c.owner || "—"}</Td>
                    <Td dataLabel="Modified by">
                      <div><strong>{c.last_modified_by || "—"}</strong></div>
                      <div style={{ fontSize: "0.85em", color: "#6a6e73" }}>{fmtDate(c.last_modified_date)}</div>
                    </Td>
                    <Td dataLabel="Created">
                      <span style={{ fontSize: "0.85em", color: "#6a6e73" }}>{fmtDate(c.created_date)}</span>
                    </Td>
                    <Td dataLabel="Severity">
                      <Label color={sevColor(c.severity)} isCompact>{c.severity || "—"}</Label>
                    </Td>
                    <Td dataLabel="Status">
                      <Label color={statusColor(c.status)} isCompact>{c.status}</Label>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {/* Pagination bottom */}
          <Flex justifyContent={{ default: "justifyContentFlexEnd" }} style={{ padding: "8px 16px" }}>
            <FlexItem>
              <Pagination
                itemCount={filtered.length}
                perPage={PER_PAGE}
                page={page}
                onSetPage={(_e, p) => setPage(p)}
                variant={PaginationVariant.bottom}
                isCompact
              />
            </FlexItem>
          </Flex>
        </>
      )}
    </>
  );
}
