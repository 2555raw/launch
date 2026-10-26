/** Esqueleto mientras carga una página de la tienda. */
export default function Loading() {
  return (
    <div className="container-page animate-pulse pt-12 pb-24" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-24 rounded-full bg-mist" />
      <div className="mt-4 h-14 w-2/3 rounded-2xl bg-mist" />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[4/5] rounded-[28px] bg-mist" />
        ))}
      </div>
    </div>
  )
}
