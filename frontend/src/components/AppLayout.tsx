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
  PageSection,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  Button,
  Divider,
} from "@patternfly/react-core";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/guides", label: "Guides" },
  { path: "/guides/new", label: "New Guide" },
  { path: "/customers", label: "Customers" },
  { path: "/providers", label: "LLM Providers" },
  { path: "/search", label: "Search" },
  { path: "/settings", label: "Settings" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, logout } = useAuth();
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = () => {
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadBrand>
          <a href="/" className="rh-brand-logo" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <img src="/logo-tam.png" alt="Red Hat Technical Account Management" />
          </a>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                placeholder="Search guides..."
                value={searchValue}
                onChange={(_e, val) => setSearchValue(val)}
                onSearch={handleSearch}
                onClear={() => setSearchValue("")}
              />
            </ToolbarItem>
            <ToolbarItem align={{ default: "alignEnd" }}>
              <span style={{ marginRight: 12, color: "#d2d2d2" }}>
                {username}
              </span>
              <Button variant="plain" onClick={logout} style={{ color: "#d2d2d2" }}>
                Sign out
              </Button>
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
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.path}
                isActive={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </NavItem>
            ))}
          </NavList>
        </Nav>
        <Divider style={{ margin: "16px 0" }} />
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
