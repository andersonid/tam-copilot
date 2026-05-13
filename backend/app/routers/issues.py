"""Issue tracking endpoints (Jira-style issues)."""

from ..models import AccountIssue
from ..schemas import IssueCreate, IssueUpdate, IssueRead
from ._account_child import build_account_child_router

router = build_account_child_router(
    prefix="/issues",
    tag="Issues",
    model_class=AccountIssue,
    create_schema=IssueCreate,
    update_schema=IssueUpdate,
    read_schema=IssueRead,
    entity_name="issue",
)
