import { CHANNELS, type Result } from "@shared/api";
import { SettingError, type Settings } from "@shared/settings";
import type { MainModule } from "../../../main/modules";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { writeSetting } from "./settings";

export const coreModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(CHANNELS.setSetting, (key: unknown, value: unknown): Result<Settings> => {
      try {
        return { ok: true, value: writeSetting(db, key, value) };
      } catch (error) {
        if (error instanceof SettingError) return { ok: false, error: error.message };
        throw error;
      }
    });
  },
};
