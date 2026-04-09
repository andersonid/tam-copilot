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
} from "@patternfly/react-core";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/guides", label: "Guides" },
  { path: "/guides/new", label: "New Guide" },
  { path: "/customers", label: "Customers" },
  { path: "/providers", label: "LLM Providers" },
  { path: "/search", label: "Search" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
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
            <span className="rh-wordmark">RED HAT</span>
            <span>TAM-Copilot</span>
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
