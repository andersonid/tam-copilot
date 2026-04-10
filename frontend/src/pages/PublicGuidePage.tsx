import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  Alert,
  Spinner,
  Title,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from "@patternfly/react-core";
import { KeyIcon, ExclamationCircleIcon } from "@patternfly/react-icons";
import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "";

export function PublicGuidePage() {
  const { id } = useParams<{ id: string }>();
  const [guideTitle, setGuideTitle] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${baseURL}/api/public/guides/${id}/info`)
      .then((r) => {
        setGuideTitle(r.data.title);
        setLoadingInfo(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoadingInfo(false);
      });
  }, [id]);

  const handleVerify = async () => {
    setError("");
    setVerifying(true);
    try {
      const { data } = await axios.post(
        `${baseURL}/api/public/guides/${id}/verify`,
        { token }
      );
      setHtml(data.html);
    } catch {
      setError("Invalid access token. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  if (loadingInfo) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spinner aria-label="Loading" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <EmptyState headingLevel="h2" titleText="Guide Not Found" icon={ExclamationCircleIcon}>
          <EmptyStateBody>The requested guide does not exist or has been removed.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="link" component="a" href="/">Go to Home</Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      </div>
    );
  }

  if (html) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: 24,
        fontFamily: "'Red Hat Text', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <KeyIcon style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }} />
        <Title headingLevel="h1" size="xl">{guideTitle}</Title>
        <p style={{ marginTop: 8, opacity: 0.7 }}>This guide requires an access token to view.</p>
      </div>

      <Modal
        variant={ModalVariant.small}
        isOpen
        aria-label="Enter access token"
      >
        <ModalHeader title="Enter Access Token" />
        <ModalBody>
          {error && (
            <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />
          )}
          <TextInput
            aria-label="Access token"
            placeholder="Paste your access token here"
            value={token}
            onChange={(_e, val) => setToken(val)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && token.trim()) handleVerify();
            }}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleVerify}
            isLoading={verifying}
            isDisabled={!token.trim() || verifying}
          >
            Verify & View
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
