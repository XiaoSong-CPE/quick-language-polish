import { createI18n } from "vue-i18n";
import en from "./locales/en";
import de from "./locales/de";
import zhCN from "./locales/zh-CN";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: {
    en,
    de,
    "zh-CN": zhCN,
  },
});

export default i18n;
