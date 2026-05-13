import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Grid,
  GridItem,
  Card,
  CardTitle,
  CardBody,
  Spinner,
  Alert,
  Button,
} from "@patternfly/react-core";
import UsersIcon from "@patternfly/react-icons/dist/esm/icons/users-icon";
import ChartBarIcon from "@patternfly/react-icons/dist/esm/icons/chart-bar-icon";
import ListIcon from "@patternfly/react-icons/dist/esm/icons/list-icon";
import api from "../services/api";

interface ManagerSummary {
  account_count: number;
  active_accounts: number;
  team_member_count: number;
  action_plans_open: number;
  action_plans_done: number;
}

export function ManagerPortfolioDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ManagerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/manager/summary")
      .then((r) => setSummary(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? e.message ?? "Failed to load summary"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner aria-label="Loading" />;
  if (error) return <Alert variant="danger" title={error} isInline />;
  if (!summary) return null;

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 8 }}>
        Dashboard — Portfolio management
      </Title>
      <p style={{ marginBottom: 24, color: "var(--pf-t--global--text--color--subtle)" }}>
        Consolidated view of accounts and your team. Use the sidebar to assign TAMs, review action plans across accounts, and open reports.
      </p>

      <Grid hasGutter style={{ marginBottom: 24 }}>
        <GridItem md={3} sm={6}>
          <Card isFullHeight>
            <CardTitle>Accounts</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{summary.account_count}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>
                {summary.active_accounts} active
              </div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem md={3} sm={6}>
          <Card isFullHeight>
            <CardTitle>Team</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{summary.team_member_count}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--pf-t--global--text--color--subtle)" }}>TAMs on the team</div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem md={3} sm={6}>
          <Card isFullHeight>
            <CardTitle>Open action plans</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{summary.action_plans_open}</div>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem md={3} sm={6}>
          <Card isFullHeight>
            <CardTitle>Completed action plans</CardTitle>
            <CardBody>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>{summary.action_plans_done}</div>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>

      <Grid hasGutter>
        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>Team</CardTitle>
            <CardBody>
              <Button variant="primary" icon={<UsersIcon />} onClick={() => navigate("/team")}>
                Manage team
              </Button>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>Action plans (all accounts)</CardTitle>
            <CardBody>
              <Button variant="secondary" icon={<ListIcon />} onClick={() => navigate("/action-plans")}>
                View portfolio
              </Button>
            </CardBody>
          </Card>
        </GridItem>
        <GridItem md={4} sm={12}>
          <Card isFullHeight>
            <CardTitle>Reports</CardTitle>
            <CardBody>
              <Button variant="secondary" icon={<ChartBarIcon />} onClick={() => navigate("/reports")}>
                Aggregated metrics
              </Button>
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </>
  );
}
