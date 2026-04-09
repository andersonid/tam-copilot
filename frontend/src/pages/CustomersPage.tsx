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
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { PlusCircleIcon } from "@patternfly/react-icons";
import api from "../services/api";
import type { Customer } from "../types/models";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const load = () => {
    api.get("/customers").then((r) => { setCustomers(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    await api.post("/customers", { name: newName });
    setNewName("");
    setModalOpen(false);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <>
      <Title headingLevel="h1" size="2xl" style={{ marginBottom: 16 }}>Customers</Title>
      <Button variant="primary" icon={<PlusCircleIcon />} onClick={() => setModalOpen(true)} style={{ marginBottom: 16 }}>
        Add Customer
      </Button>

      {customers.length === 0 ? (
        <EmptyState>
          <EmptyStateHeader titleText="No customers" headingLevel="h3" />
          <EmptyStateBody>Add your first customer above.</EmptyStateBody>
        </EmptyState>
      ) : (
        <Table aria-label="Customers" variant="compact">
          <Thead><Tr><Th>Name</Th><Th>Slug</Th><Th>Created</Th></Tr></Thead>
          <Tbody>
            {customers.map((c) => (
              <Tr key={c.id}><Td>{c.name}</Td><Td>{c.slug}</Td><Td>{c.created_at?.split("T")[0]}</Td></Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        variant="small"
      >
        <ModalHeader title="Add Customer" />
        <ModalBody>
          <TextInput value={newName} onChange={(_e, v) => setNewName(v)} placeholder="Customer name" />
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleCreate} isDisabled={!newName.trim()}>Create</Button>
          <Button variant="link" onClick={() => setModalOpen(false)}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
