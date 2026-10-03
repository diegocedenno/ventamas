import { ArrowLeftRight, Lock } from "lucide-react";
import type { RateTable } from "@shared/money";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { caja } from "../../caja/renderer/client";
import { FOREIGN, type RatesState } from "../../monedas/api";
import { monedas } from "../../monedas/renderer/client";
import { RatesForm } from "../../monedas/renderer/RatesForm";
import { RatesStatus } from "../../monedas/renderer/RatesScreen";
import { Pos } from "./Pos";
import { t } from "./texts";

function tableOf(state: RatesState): RateTable {
  const rates: RateTable["rates"] = {};
  for (const code of FOREIGN) {
    const info = state.rates[code];
    if (info) rates[code] = info.rate;
  }
  return { pivot: state.pivot, rates };
}

/**
 * La pantalla de venta. Antes de vender hacen falta dos cosas, y la pantalla las pide en
 * orden: la tasa de hoy confirmada y la caja abierta.
 */
export function SellScreen() {
  const { settings, goTo } = useApp();
  const rates = useData(() => monedas.state(), []);
  const session = useData(() => caja.current(), []);
  const methods = useData(() => caja.methods(), []);
  const error = rates.error ?? session.error ?? methods.error;

  if (error) {
    return (
      <div className="page">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!rates.data || session.data === undefined || !methods.data) return null;

  if (!rates.data.confirmedToday) {
    return (
      <div className="page">
        <h1 className="page-title">{t("title")}</h1>
        <section className="card notice">
          <ArrowLeftRight className="notice-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
          <div className="gate">
            <div>
              <h2 className="notice-title">{t("gate.rates.title")}</h2>
              <p className="notice-body">{t("gate.rates.body")}</p>
            </div>
            <RatesStatus state={rates.data} />
            <RatesForm state={rates.data} onSaved={(state) => rates.set(state)} />
          </div>
        </section>
      </div>
    );
  }

  if (session.data === null) {
    return (
      <div className="page">
        <h1 className="page-title">{t("title")}</h1>
        <section className="card notice">
          <Lock className="notice-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
          <div>
            <h2 className="notice-title">{t("gate.cash.title")}</h2>
            <p className="notice-body">{t("gate.cash.body")}</p>
            <button type="button" className="btn btn--primary" autoFocus onClick={() => goTo("caja")}>
              {t("gate.cash.action")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <Pos
      currency={settings["store.currency"]}
      table={tableOf(rates.data)}
      methods={methods.data.filter((method) => method.active)}
      sessionId={session.data.id}
    />
  );
}
