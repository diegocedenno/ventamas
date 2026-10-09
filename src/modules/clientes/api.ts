export const CLIENTES = {
  list: "clientes:list",
  get: "clientes:get",
  save: "clientes:save",
  setActive: "clientes:set-active",
} as const;

export const CUSTOMER_NAME_MAX = 100;
export const CUSTOMER_DOC_MAX = 20;
export const CUSTOMER_PHONE_MAX = 40;
export const CUSTOMER_EMAIL_MAX = 100;
export const CUSTOMER_ADDRESS_MAX = 200;
export const CUSTOMER_NOTE_MAX = 200;
/** La lista de clientes muestra como máximo esta cantidad; con más, hay que buscar. */
export const CUSTOMER_LIST_LIMIT = 200;

export interface Customer {
  id: string;
  name: string;
  /** Cédula o RIF, ya con su formato ("V-12345678", "J-12345678-9"); vacío si no se registró. */
  doc: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  active: boolean;
  createdAt: string;
}

export interface CustomerInput {
  /** Presente al editar. */
  id?: string;
  name: string;
  doc: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}
