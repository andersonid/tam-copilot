import { useState, type FormEvent } from "react";
import {
  Title,
  Form,
  FormGroup,
  TextInput,
  Button,
  Alert,
  Card,
  CardBody,
  CardTitle,
} from "@patternfly/react-core";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export function SettingsPage() {
  const { username } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }

    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 24 }}>
        Settings
      </Title>

      <Card style={{ maxWidth: 500 }}>
        <CardTitle>Change Password</CardTitle>
        <CardBody>
          <p style={{ marginBottom: 16, color: "var(--pf-t--global--text--color--subtle)" }}>
            Signed in as <strong>{username}</strong>
          </p>

          {error && (
            <Alert variant="danger" title={error} isInline style={{ marginBottom: 16 }} />
          )}
          {success && (
            <Alert variant="success" title={success} isInline style={{ marginBottom: 16 }} />
          )}

          <Form onSubmit={handleSubmit}>
            <FormGroup label="Current Password" isRequired fieldId="current-pw">
              <TextInput
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(_e, val) => setCurrentPassword(val)}
                isRequired
              />
            </FormGroup>
            <FormGroup label="New Password" isRequired fieldId="new-pw">
              <TextInput
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(_e, val) => setNewPassword(val)}
                isRequired
              />
            </FormGroup>
            <FormGroup label="Confirm New Password" isRequired fieldId="confirm-pw">
              <TextInput
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(_e, val) => setConfirmPassword(val)}
                isRequired
              />
            </FormGroup>
            <Button type="submit" isLoading={saving} isDisabled={saving || !currentPassword || !newPassword || !confirmPassword}>
              Change Password
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
