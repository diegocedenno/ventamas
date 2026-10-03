import { CircleAlert, CircleCheck } from "lucide-react";
import { useState } from "react";
import { CURRENCIES, formatRate } from "@shared/money";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { formatDay, formatTime } from "../../../renderer/src/lib/format";
import { useData } from "../../../renderer/src/lib/useData";
import type { RatesState } from "../api";
import { monedas } from "./client";
import { RatesForm } from "./RatesForm";
import { t } from "./texts";

export function RatesScreen() {
  const state = useData(() => monedas.state(), []);
  const history = useData(() => monedas.history(), []);
  const [justSaved, setJustSaved] = useState(false);

  function saved(next: RatesState) {
    state.set(next);
    setJustSaved(true);
    void history.reload();
  }

  return (
    <div className="page">
      <header>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-lead">{t("lead")}</p>
      </header>

      <ErrorNote>{state.error}</ErrorNote>

      {state.data && (
        <section className="card section">
          <RatesStatus state={state.data} />
          {/* La clave rehace el formulario con las tasas recién guardadas. */}
          <RatesForm key={Object.values(state.data.rates).map((r) => r?.createdAt).join()} state={state.data} onSaved={saved} />
          <p className="message message--ok" role="status">
            {justSaved ? t("saved") : ""}
          </p>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">{t("history")}</h2>
        {history.data && history.data.length === 0 && <p className="muted">{t("history.empty")}</p>}
        {history.data && history.data.length > 0 && (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>{t("col.day")}</th>
                  <th>{t("col.time")}</th>
                  <th>{t("col.currency")}</th>
                  <th className="right">{t("col.rate")}</th>
                  <th>{t("col.source")}</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((rate) => (
                  <tr key={rate.createdAt + rate.currency}>
                    <td>{formatDay(rate.day)}</td>
                    <td>{formatTime(rate.createdAt)}</td>
                    <td>{CURRENCIES[rate.currency].name}</td>
                    <td className="right num">{formatRate(rate.rate)}</td>
                    <td>{rate.source === "bcv" ? t("source.bcv") : t("source.manual")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Dice de un vistazo si hoy ya se puede vender con estas tasas. */
export function RatesStatus({ state }: { state: RatesState }) {
  const last = Object.values(state.rates)[0];
  if (state.confirmedToday) {
    return (
      <p className="rates-status rates-status--ok">
        <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
        {t("confirmed", { day: formatDay(state.today) })}
      </p>
    );
  }
  return (
    <p className="rates-status rates-status--pending">
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>
        {last ? t("pending") : t("never")}
        {last && <span className="muted"> {t("pending.last", { day: formatDay(last.day) })}</span>}
      </span>
    </p>
  );
}
