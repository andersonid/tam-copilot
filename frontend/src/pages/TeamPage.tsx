import { useEffect, useState } from "react";
import {
  PageSection,
  Content,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  Spinner,
  Label,
} from "@patternfly/react-core";
import api from "../services/api";

interface TeamMember {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  tam_type: string | null;
  is_active: boolean;
  manager_id: number | null;
  account_count: number;
}

export function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/team/members")
      .then((r) => setMembers(r.data))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner aria-label="Loading team" />;

  return (
    <>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component="h1">Team</Content>
          <Content component="p">
            TAMs you manage and how many accounts they are assigned to.
          </Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <DataList aria-label="Team members">
          {members.map((m) => (
            <DataListItem key={m.id} aria-labelledby={`tm-${m.id}`}>
              <DataListItemRow>
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key="u" width={2}>
                      <span id={`tm-${m.id}`} style={{ fontWeight: 600 }}>{m.full_name || m.username}</span>
                      <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                        @{m.username}
                        {m.email && ` · ${m.email}`}
                      </div>
                    </DataListCell>,
                    <DataListCell key="r">{m.role}</DataListCell>,
                    <DataListCell key="t">{m.tam_type || "—"}</DataListCell>,
                    <DataListCell key="c">
                      <strong>{m.account_count}</strong> accounts
                    </DataListCell>,
                    <DataListCell key="a">
                      <Label color={m.is_active ? "green" : "grey"} isCompact>
                        {m.is_active ? "Active" : "Inactive"}
                      </Label>
                    </DataListCell>,
                  ]}
                />
              </DataListItemRow>
            </DataListItem>
          ))}
        </DataList>
      </PageSection>
    </>
  );
}
