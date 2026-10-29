import type { Metadata } from "next";
import { CatalogView, PageIntro } from "@/components/catalog/catalog-view";
import type { SearchParams } from "@/lib/catalog/params";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t({ es: "Tienda de kits de cocina", en: "Cooking kit shop" }),
    description: t({
      es: "Todos los kits de cocina de Hambre de Más por nivel, tiempo, dieta y precio. Envío gratis desde 40 €.",
      en: "Every Hambre de Más cooking kit by level, time, diet and price. Free shipping from €40.",
    }),
    alternates: { canonical: "/tienda" },
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const featured = params.destacados === "1";
  const newest = params.nuevos === "1" || params.orden === "novedades";
  const gym = params.dieta === "alto-en-proteina";
  const { t } = await getI18n();
  return (
    <>
      <PageIntro
        eyebrow={t({ es: "Tienda", en: "Shop" })}
        title={
          gym
            ? t({ es: "Para el gym.", en: "For the gym." })
            : featured
              ? t({ es: "Destacados.", en: "Featured." })
              : newest
                ? t({ es: "Novedades.", en: "New arrivals." })
                : t({ es: "Todos los kits.", en: "All kits." })
        }
        soft={
          gym
            ? t({ es: "Kits altos en proteína.", en: "High-protein kits." })
            : featured
              ? t({
                  es: "Los que más os flipan.",
                  en: "The ones you love most.",
                })
              : newest
                ? t({
                    es: "Recién salidos del horno.",
                    en: "Fresh out of the oven.",
                  })
                : t({
                    es: "Elige, cocina, sube de nivel.",
                    en: "Pick, cook, level up.",
                  })
        }
      />
      <CatalogView params={params} basePath="/tienda" />
    </>
  );
}
