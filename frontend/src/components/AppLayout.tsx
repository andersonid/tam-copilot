import { useState, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Page,
  Masthead,
  MastheadMain,
  MastheadBrand,
  MastheadContent,
  PageSidebar,
  PageSidebarBody,
  Nav,
  NavList,
  NavItem,
  NavExpandable,
  PageSection,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Dropdown,
  DropdownItem,
  DropdownList,
  Divider,
  MenuToggle,
  Switch,
  Select,
  SelectOption,
  SelectList,
} from "@patternfly/react-core";
import {
  TachometerAltIcon,
  CubesIcon,
  ListIcon,
  BugIcon,
  MapIcon,
  ClipboardCheckIcon,
  UsersIcon,
  ClockIcon,
  HeartbeatIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  FileAltIcon,
  BookOpenIcon,
  PlusCircleIcon,
  UploadIcon,
  CogIcon,
  SearchIcon,
  MoonIcon,
  AdjustIcon,
  GlobeIcon,
  UserIcon,
} from "@patternfly/react-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useAccount } from "../context/AccountContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { selectedAccountId, selectedAccount, accounts, setSelectedAccountId } = useAccount();

  const [searchValue, setSearchValue] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");

  const [contentExpanded, setContentExpanded] = useState(
    location.pathname.startsWith("/content") || location.pathname.startsWith("/guides"),
  );
  const [adminExpanded, setAdminExpanded] = useState(
    ["/admin/providers", "/admin/settings", "/customers", "/providers"].includes(location.pathname),
  );

  const handleSearch = () => {
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const navTo = (path: string) => navigate(path);
  const isActive = (path: string) => location.pathname === path;

  const logoSrc = theme === "dark" ? "/logo-tam-dark.png" : "/logo-tam-light.png";

  const filteredAccounts = useMemo(() => {
    if (!accountFilter) return accounts;
    const lower = accountFilter.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(lower) ||
        a.account_number.includes(lower),
    );
  }, [accounts, accountFilter]);

  const accountLabel = selectedAccount
    ? `${selectedAccount.name}`
    : "Global (all accounts)";

  // -- Masthead ---------------------------------------------------------------

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <a
            href="/"
            className="rh-brand-logo"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <img src={logoSrc} alt="Red Hat Technical Account Management" />
            <span style={{
              background: "#c00",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".5px",
              padding: "2px 10px",
              borderRadius: 12,
              lineHeight: "20px",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}>Copilot</span>
          </a>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignEnd" }}>
              <SearchInput
                placeholder="Search..."
                value={searchValue}
                onChange={(_e, val) => setSearchValue(val)}
                onSearch={handleSearch}
                onClear={() => setSearchValue("")}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Dropdown
                isOpen={userMenuOpen}
                onOpenChange={setUserMenuOpen}
                onSelect={() => setUserMenuOpen(false)}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    isExpanded={userMenuOpen}
                    variant="plainText"
                  >
                    {username}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  <DropdownItem
                    key="theme"
                    component="div"
                    onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {theme === "dark" ? <MoonIcon /> : <AdjustIcon />}
                      <Switch
                        id="theme-switch"
                        label="Dark mode"
                        isChecked={theme === "dark"}
                        onChange={toggleTheme}
                        isReversed
                      />
                    </span>
                  </DropdownItem>
                  <Divider key="sep" />
                  <DropdownItem key="settings" onClick={() => navigate("/settings")}>
                    Settings
                  </DropdownItem>
                  <DropdownItem key="logout" onClick={logout}>
                    Sign out
                  </DropdownItem>
                </DropdownList>
              </Dropdown>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  // -- Sidebar ----------------------------------------------------------------

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        {/* Account context switcher */}
        <div style={{ padding: "12px 16px 8px" }}>
          <Select
            isOpen={accountSelectOpen}
            onOpenChange={setAccountSelectOpen}
            selected={selectedAccountId ?? "global"}
            onSelect={(_e, value) => {
              if (value === "global") {
                setSelectedAccountId(null);
              } else {
                setSelectedAccountId(Number(value));
              }
              setAccountSelectOpen(false);
              setAccountFilter("");
            }}
            toggle={(toggleRef) => (
              <MenuToggle
                ref={toggleRef}
                onClick={() => setAccountSelectOpen(!accountSelectOpen)}
                isExpanded={accountSelectOpen}
                isFullWidth
                icon={selectedAccount ? <UserIcon /> : <GlobeIcon />}
              >
                {accountLabel}
              </MenuToggle>
            )}
          >
            <div style={{ padding: "8px 12px" }}>
              <SearchInput
                placeholder="Filter accounts..."
                value={accountFilter}
                onChange={(_e, val) => setAccountFilter(val)}
                onClear={() => setAccountFilter("")}
              />
            </div>
            <SelectList>
              <SelectOption value="global" isSelected={selectedAccountId === null}>
                <GlobeIcon style={{ marginRight: 8 }} />
                Global (all accounts)
              </SelectOption>
              <Divider />
              {filteredAccounts.map((a) => (
                <SelectOption key={a.id} value={String(a.id)} isSelected={selectedAccountId === a.id}>
                  {a.name}
                  <span style={{ marginLeft: 8, opacity: 0.6, fontSize: "0.85em" }}>
                    #{a.account_number}
                  </span>
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </div>

        <Nav>
          <NavList>
            <NavItem isActive={isActive("/")} onClick={() => navTo("/")}>
              <TachometerAltIcon style={{ marginRight: 8 }} />
              Dashboard
            </NavItem>

            <NavItem isActive={isActive("/cases")} onClick={() => navTo("/cases")}>
              <ListIcon style={{ marginRight: 8 }} />
              Cases
            </NavItem>

            <NavItem isActive={isActive("/clusters")} onClick={() => navTo("/clusters")}>
              <CubesIcon style={{ marginRight: 8 }} />
              Clusters
            </NavItem>

            <NavItem isActive={isActive("/issues")} onClick={() => navTo("/issues")}>
              <BugIcon style={{ marginRight: 8 }} />
              Issues
            </NavItem>

            <NavItem isActive={isActive("/action-plan")} onClick={() => navTo("/action-plan")}>
              <MapIcon style={{ marginRight: 8 }} />
              Action Plan
            </NavItem>

            <NavItem isActive={isActive("/entitlements")} onClick={() => navTo("/entitlements")}>
              <ClipboardCheckIcon style={{ marginRight: 8 }} />
              Entitlements
            </NavItem>

            <NavItem isActive={isActive("/contacts")} onClick={() => navTo("/contacts")}>
              <UsersIcon style={{ marginRight: 8 }} />
              Contacts
            </NavItem>

            <NavItem isActive={isActive("/lifecycle")} onClick={() => navTo("/lifecycle")}>
              <ClockIcon style={{ marginRight: 8 }} />
              Lifecycle
            </NavItem>

            <NavItem isActive={isActive("/touchpoints")} onClick={() => navTo("/touchpoints")}>
              <HeartbeatIcon style={{ marginRight: 8 }} />
              Touchpoints
            </NavItem>

            <NavItem isActive={isActive("/risks")} onClick={() => navTo("/risks")}>
              <ExclamationTriangleIcon style={{ marginRight: 8 }} />
              Risks
            </NavItem>

            <NavItem isActive={isActive("/engagement")} onClick={() => navTo("/engagement")}>
              <ChartBarIcon style={{ marginRight: 8 }} />
              Engagement
            </NavItem>

            <Divider style={{ margin: "8px 0" }} />

            <NavExpandable
              title="Content Generation"
              isActive={location.pathname.startsWith("/content") || location.pathname.startsWith("/guides")}
              isExpanded={contentExpanded}
              onExpand={(_e, val) => setContentExpanded(val)}
            >
              <NavItem isActive={isActive("/content")} onClick={() => navTo("/content")}>
                <FileAltIcon style={{ marginRight: 8 }} />
                All Content
              </NavItem>
              <NavItem isActive={isActive("/content/report")} onClick={() => navTo("/content/report")}>
                TAM Report
              </NavItem>
              <NavItem isActive={isActive("/guides/new")} onClick={() => navTo("/guides/new")}>
                <PlusCircleIcon style={{ marginRight: 8 }} />
                Guide
              </NavItem>
              <NavItem isActive={isActive("/content/kcs")} onClick={() => navTo("/content/kcs")}>
                KCS Article
              </NavItem>
              <NavItem isActive={isActive("/content/assessment")} onClick={() => navTo("/content/assessment")}>
                Assessment
              </NavItem>
              <NavItem isActive={isActive("/content/schedule")} onClick={() => navTo("/content/schedule")}>
                Schedule
              </NavItem>
              <NavItem isActive={isActive("/guides/import")} onClick={() => navTo("/guides/import")}>
                <UploadIcon style={{ marginRight: 8 }} />
                Import HTML
              </NavItem>
            </NavExpandable>

            <NavItem isActive={isActive("/search")} onClick={() => navTo("/search")}>
              <SearchIcon style={{ marginRight: 8 }} />
              Search
            </NavItem>

            {/* Manager dashboard — visible to all for now, role-gating later */}
            <NavItem isActive={isActive("/manager")} onClick={() => navTo("/manager")}>
              <BookOpenIcon style={{ marginRight: 8 }} />
              Manager
            </NavItem>

            <Divider style={{ margin: "8px 0" }} />

            <NavExpandable
              title="Administration"
              isActive={["/admin/providers", "/admin/settings", "/customers", "/providers"].includes(location.pathname)}
              isExpanded={adminExpanded}
              onExpand={(_e, val) => setAdminExpanded(val)}
            >
              <NavItem isActive={isActive("/providers")} onClick={() => navTo("/providers")}>
                <CogIcon style={{ marginRight: 8 }} />
                LLM Providers
              </NavItem>
            </NavExpandable>
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page masthead={masthead} sidebar={sidebar}>
      <PageSection hasBodyWrapper={false}>
        {children}
      </PageSection>
    </Page>
  );
}
