import { useState } from "react";
import {
  FormSelect,
  FormSelectOption,
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  Alert,
} from "@patternfly/react-core";
import { PlusCircleIcon } from "@patternfly/react-icons";
import api from "../services/api";

interface Option {
  id: number;
  name: string;
}

interface CreatableSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  onCreated: (created: Option) => void;
  placeholder?: string;
  createLabel?: string;
  apiEndpoint: string;
  isRequired?: boolean;
}

const CREATE_NEW = "__create_new__";

export function CreatableSelect({
  id,
  value,
  onChange,
  options,
  onCreated,
  placeholder = "Select...",
  createLabel = "Create new...",
  apiEndpoint,
  isRequired,
}: CreatableSelectProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (_e: unknown, val: string) => {
    if (val === CREATE_NEW) {
      setModalOpen(true);
      setNewName("");
      setError("");
    } else {
      onChange(val);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { data } = await api.post(apiEndpoint, { name: newName.trim() });
      onCreated(data);
      onChange(String(data.id));
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <FormSelect id={id} value={value} onChange={handleChange} isRequired={isRequired}>
        <FormSelectOption value="" label={placeholder} isPlaceholder />
        {options.map((o) => (
          <FormSelectOption key={o.id} value={String(o.id)} label={o.name} />
        ))}
        <FormSelectOption value={CREATE_NEW} label={`＋ ${createLabel}`} />
      </FormSelect>

      <Modal
        variant={ModalVariant.small}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        aria-label={createLabel}
      >
        <ModalHeader title={createLabel} />
        <ModalBody>
          {error && <Alert variant="danger" title={error} isInline style={{ marginBottom: 12 }} />}
          <TextInput
            aria-label="Name"
            placeholder="Enter name"
            value={newName}
            onChange={(_e, val) => setNewName(val)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) handleCreate();
            }}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            icon={<PlusCircleIcon />}
            onClick={handleCreate}
            isLoading={creating}
            isDisabled={!newName.trim() || creating}
          >
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
