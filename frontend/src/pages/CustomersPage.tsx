import { useEffect, useState } from "react";
import {
  Title,
  Button,
  TextInput,
  Modal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Spinner,
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateActions,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { PlusCircleIcon, UsersIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { Customer } from "../types/models";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const load = () => {
    setError("");
    api
      .get("/customers")
      .then((r) => {
        setCustomers(r.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load customers");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setCreateError("");
    try {
      await api.post("/customers", { name: newName });
      setNewName("");
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCreateError(msg || "Failed to create customer");
    }
  };

  if (loading) return <Spinner aria-label="Loading customers" />;

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 16 }}>
        Customers
      </Title>

      {error && (
        <Alert variant="danger" title="Error loading customers" isInline style={{ marginBottom: 16 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="primary"
        icon={<PlusCircleIcon />}
        onClick={() => setModalOpen(true)}
        style={{ marginBottom: 16 }}
      >
        Add Customer
      </Button>

      {!error && customers.length === 0 ? (
        <EmptyState headingLevel="h3" titleText="No customers" icon={UsersIcon}>
          <EmptyStateBody>Add your first customer to start creating guides.</EmptyStateBody>
          <EmptyStateFooter>
            <EmptyStateActions>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Add Customer
              </Button>
            </EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      ) : (
        !error && (
          <Table aria-label="Customers" variant="compact">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Created</Th>
              </Tr>
            </Thead>
            <Tbody>
              {customers.map((c) => (
                <Tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{c.slug}</Td>
                  <Td>{c.created_at?.split("T")[0]}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} variant="small">
        <ModalHeader title="Add Customer" />
        <ModalBody>
          {createError && (
            <Alert variant="danger" title={createError} isInline style={{ marginBottom: 12 }} />
          )}
          <TextInput
            value={newName}
            onChange={(_e, v) => setNewName(v)}
            placeholder="Customer name"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleCreate} isDisabled={!newName.trim()}>
            Create
          </Button>
          <Button variant="link" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
