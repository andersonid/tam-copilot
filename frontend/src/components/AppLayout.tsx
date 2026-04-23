import { useState, type ReactNode } from "react";
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
} from "@patternfly/react-core";
import {
  TachometerAltIcon,
  BookOpenIcon,
  PlusCircleIcon,
  UploadIcon,
  UsersIcon,
  CogIcon,
  SearchIcon,
  MoonIcon,
  AdjustIcon,
} from "@patternfly/react-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchValue, setSearchValue] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [guidesExpanded, setGuidesExpanded] = useState(
    location.pathname.startsWith("/guides") || location.pathname === "/",
  );
  const [adminExpanded, setAdminExpanded] = useState(
    ["/customers", "/providers", "/settings"].includes(location.pathname),
  );

  const handleSearch = () => {
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const navTo = (path: string) => navigate(path);
  const isActive = (path: string) => location.pathname === path;

  const logoSrc = theme === "dark" ? "/logo-tam-dark.png" : "/logo-tam-light.png";

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <a href="/" className="rh-brand-logo" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <img src={logoSrc} alt="Red Hat Technical Account Management" />
          </a>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignEnd" }}>
              <SearchInput
                placeholder="Search guides..."
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

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav>
          <NavList>
            <NavItem isActive={isActive("/search")} onClick={() => navTo("/search")}>
              <SearchIcon style={{ marginRight: 8 }} />
              Search
            </NavItem>

            <NavItem isActive={isActive("/")} onClick={() => navTo("/")}>
              <TachometerAltIcon style={{ marginRight: 8 }} />
              Dashboard
            </NavItem>

            <NavExpandable
              title="Guides"
              isActive={location.pathname.startsWith("/guides")}
              isExpanded={guidesExpanded}
              onExpand={(_e, val) => setGuidesExpanded(val)}
            >
              <NavItem isActive={isActive("/guides")} onClick={() => navTo("/guides")}>
                <BookOpenIcon style={{ marginRight: 8 }} />
                All Guides
              </NavItem>
              <NavItem isActive={isActive("/guides/new")} onClick={() => navTo("/guides/new")}>
                <PlusCircleIcon style={{ marginRight: 8 }} />
                New Guide
              </NavItem>
              <NavItem isActive={isActive("/guides/import")} onClick={() => navTo("/guides/import")}>
                <UploadIcon style={{ marginRight: 8 }} />
                Import HTML
              </NavItem>
            </NavExpandable>

            <NavExpandable
              title="Administration"
              isActive={["/customers", "/providers", "/settings"].includes(location.pathname)}
              isExpanded={adminExpanded}
              onExpand={(_e, val) => setAdminExpanded(val)}
            >
              <NavItem isActive={isActive("/customers")} onClick={() => navTo("/customers")}>
                <UsersIcon style={{ marginRight: 8 }} />
                Customers
              </NavItem>
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
