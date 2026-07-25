import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import styles from "./DonationBanner.module.css";

/** Ver AGENTS.md §10 — mensaje al volver de Stripe Checkout (éxito/cancelado). */
export async function DonationBanner({
  locale,
  status,
}: {
  locale: AppLocale;
  status: "success" | "cancelled";
}) {
  const t = await getTranslations({ locale, namespace: "Donation" });

  return (
    <div className={styles.banner} data-kind={status}>
      {status === "success" ? (
        <>
          <strong>{t("thankYouTitle")}</strong> {t("thankYouBody")}
        </>
      ) : (
        t("cancelledBody")
      )}
    </div>
  );
}
