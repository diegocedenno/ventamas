import { useState, type FormEvent } from "react";
import { hasValidCheck, parseTaxId } from "@shared/taxid";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import {
  CUSTOMER_ADDRESS_MAX,
  CUSTOMER_DOC_MAX,
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTE_MAX,
  CUSTOMER_PHONE_MAX,
  type Customer,
} from "../api";
import { clientes } from "./client";
import { t } from "./texts";

interface CustomerEditorProps {
  /** El cliente a editar, o null para crear uno. */
  customer: Customer | null;
  /** Lo que ya se había escrito al buscarlo: un nombre, o las cifras de su cédula o teléfono. */
  draft?: string;
  onClose(): void;
  onSaved(customer: Customer): void;
}

/** Ficha de un cliente. Con el nombre basta; el resto es para facturar o para ubicarlo. */
export function CustomerEditor({ customer, draft = "", onClose, onSaved }: CustomerEditorProps) {
  // Lo buscado se aprovecha: si parece una cédula va al documento; si no, al nombre.
  const draftId = customer ? null : parseTaxId(draft);
  const [name, setName] = useState(customer?.name ?? (draftId ? "" : draft));
  const [doc, setDoc] = useState(customer?.doc ?? draftId?.text ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const parsed = parseTaxId(doc);
  const badCheck = parsed !== null && !hasValidCheck(parsed);

  async function run(action: () => Promise<Customer>) {
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        onSaved(await action());
        onClose();
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (name.trim() === "") return;
    void run(() => clientes.save({ id: customer?.id, name, doc, phone, email, address, note }));
  }

  return (
    <Dialog
      title={customer ? t("editor.edit") : t("editor.new")}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          {customer && (
            <button
              type="button"
              className="btn btn--quiet spacer"
              disabled={busy}
              onClick={() => void run(() => clientes.setActive(customer.id, !customer.active))}
            >
              {customer.active ? t("archive") : t("restore")}
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="customer-form" className="btn btn--primary" disabled={busy}>
            {t("save")}
          </button>
        </>
      }
    >
      <form id="customer-form" className="stack" onSubmit={submit} noValidate>
        {customer && !customer.active && <p className="note note--info">{t("archived.note")}</p>}
        <Field label={t("name")} error={touched && name.trim() === "" ? t("name.required") : null}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={name}
              maxLength={CUSTOMER_NAME_MAX}
              placeholder={t("name.placeholder")}
              autoComplete="off"
              data-autofocus=""
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field label={t("doc")} hint={badCheck ? <span className="field-warning">{t("doc.check")}</span> : t("doc.hint")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={doc}
                maxLength={CUSTOMER_DOC_MAX}
                placeholder={t("doc.placeholder")}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setDoc(event.target.value)}
                onBlur={() => parsed && setDoc(parsed.text)}
              />
            )}
          </Field>
          <Field label={t("phone")}>
            {(props) => (
              <input
                {...props}
                className="input"
                type="tel"
                value={phone}
                maxLength={CUSTOMER_PHONE_MAX}
                placeholder={t("phone.placeholder")}
                autoComplete="off"
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label={t("address")} hint={t("address.hint")}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={address}
              maxLength={CUSTOMER_ADDRESS_MAX}
              autoComplete="off"
              onChange={(event) => setAddress(event.target.value)}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field label={t("email")}>
            {(props) => (
              <input
                {...props}
                className="input"
                type="email"
                value={email}
                maxLength={CUSTOMER_EMAIL_MAX}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("note")}>
            {(props) => (
              <input {...props} className="input" value={note} maxLength={CUSTOMER_NOTE_MAX} autoComplete="off" onChange={(event) => setNote(event.target.value)} />
            )}
          </Field>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
