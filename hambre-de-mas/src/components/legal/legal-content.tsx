import Link from 'next/link'
import { commerce } from '@/lib/config/commerce'
import { company, companyField, isCompanyInfoComplete, site } from '@/lib/config/site'
import { formatPrice } from '@/lib/money'

/**
 * Textos legales BASE para una tienda online en España. Son una plantilla
 * orientativa: deben revisarse por un profesional antes de publicar la tienda.
 * Los datos de la empresa salen de las variables NEXT_PUBLIC_COMPANY_*; si
 * faltan, se muestra [PENDIENTE: …] en lugar de inventarlos.
 */

const name = () => companyField(company.legalName, 'razón social')
const nif = () => companyField(company.taxId, 'NIF/CIF')
const address = () => companyField(company.address, 'domicilio social')
const email = () => companyField(company.email, 'email de contacto')

export function LegalNotice() {
  return isCompanyInfoComplete ? null : (
    <p className="mb-8 rounded-2xl bg-almendra-soft px-5 py-4 text-sm text-teja">
      Faltan datos de la empresa. Rellena las variables <code>NEXT_PUBLIC_COMPANY_*</code> (ver README) y haz revisar estos textos por un
      profesional antes de abrir la tienda.
    </p>
  )
}

export type LegalPage = { title: string; description: string; body: () => React.ReactNode }

export const legalPages: Record<string, LegalPage> = {
  'aviso-legal': {
    title: 'Aviso legal',
    description: 'Datos identificativos del titular de la web y condiciones de uso.',
    body: () => (
      <>
        <h2>1. Datos identificativos</h2>
        <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE):</p>
        <ul>
          <li>Titular: {name()}</li>
          <li>NIF: {nif()}</li>
          <li>Domicilio: {address()}</li>
          <li>Email: {email()}</li>
          {company.phone && <li>Teléfono: {company.phone}</li>}
          <li>Datos registrales: {companyField(company.registry, 'inscripción en el Registro Mercantil, si aplica')}</li>
        </ul>
        <h2>2. Objeto</h2>
        <p>
          Este sitio web ({site.url}) ofrece la venta online de kits de cocina de la marca {site.name}. El acceso y uso de la web atribuye la
          condición de usuario e implica la aceptación de este aviso legal.
        </p>
        <h2>3. Uso de la web</h2>
        <p>
          El usuario se compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades ilícitas o contrarias a la buena
          fe. Las compras se rigen por las <Link href="/legal/condiciones">condiciones de compra</Link>.
        </p>
        <h2>4. Propiedad intelectual e industrial</h2>
        <p>
          La marca, el logotipo, los textos y el diseño de la web pertenecen a su titular o se usan con licencia. Las fotografías de los
          productos de demostración proceden de Unsplash (licencia Unsplash) y deben sustituirse por fotografías propias.
        </p>
        <h2>5. Responsabilidad</h2>
        <p>
          El titular no se hace responsable de los daños derivados de un uso indebido de la web ni de interrupciones del servicio ajenas a su
          control. Las recetas incluyen información de alérgenos; revísala siempre antes de cocinar.
        </p>
        <h2>6. Legislación aplicable</h2>
        <p>Este aviso legal se rige por la legislación española.</p>
      </>
    ),
  },

  privacidad: {
    title: 'Política de privacidad',
    description: 'Cómo tratamos tus datos personales según el RGPD y la LOPDGDD.',
    body: () => (
      <>
        <h2>1. Responsable del tratamiento</h2>
        <p>
          {name()} (NIF {nif()}), con domicilio en {address()}. Contacto: {email()}.
        </p>
        <h2>2. Qué datos tratamos y para qué</h2>
        <ul>
          <li>
            <strong>Pedidos:</strong> nombre, email, teléfono y dirección de envío para gestionar la compra, el envío y la facturación. Base
            jurídica: ejecución del contrato (art. 6.1.b RGPD) y obligaciones legales (art. 6.1.c).
          </li>
          <li>
            <strong>Cuenta de usuario:</strong> email, contraseña cifrada, nombre y direcciones guardadas, para que puedas consultar tus pedidos.
            Base jurídica: tu consentimiento y la relación contractual.
          </li>
          <li>
            <strong>Newsletter:</strong> email, solo si lo pides expresamente. Base jurídica: consentimiento (art. 6.1.a), que puedes retirar en
            cualquier momento.
          </li>
          <li>
            <strong>Opiniones:</strong> el nombre que elijas y el texto, solo si has comprado el producto.
          </li>
        </ul>
        <p>
          <strong>Pagos:</strong> los datos de tu tarjeta los trata directamente Stripe Payments Europe, Ltd. como responsable independiente.
          Nosotros nunca vemos ni guardamos el número de tu tarjeta.
        </p>
        <h2>3. Menores de edad</h2>
        <p>
          La tienda está pensada para adolescentes. Según el artículo 7 de la LOPDGDD, los menores de 14 años necesitan el consentimiento de su
          madre, padre o tutor para crear una cuenta. Las compras de menores deben hacerlas o autorizarlas sus representantes legales.
        </p>
        <h2>4. Encargados del tratamiento</h2>
        <ul>
          <li>Supabase Inc. (base de datos y autenticación). Configura el proyecto en una región de la UE.</li>
          <li>Stripe (procesamiento de pagos).</li>
          <li>Proveedor de alojamiento web y, si se activa, de envío de emails.</li>
          <li>Empresa de transporte, solo con los datos necesarios para la entrega.</li>
        </ul>
        <p>Cuando haya transferencias internacionales, se realizan con las garantías del capítulo V del RGPD (cláusulas contractuales tipo o decisiones de adecuación).</p>
        <h2>5. Conservación</h2>
        <p>Los datos de pedidos se conservan durante los plazos legales (fiscales y mercantiles). Los de la cuenta, hasta que la elimines.</p>
        <h2>6. Tus derechos</h2>
        <p>
          Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a {email()}. Si
          consideras que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).
        </p>
      </>
    ),
  },

  cookies: {
    title: 'Política de cookies',
    description: 'Qué cookies usa la tienda y cómo gestionarlas.',
    body: () => (
      <>
        <h2>1. Qué son</h2>
        <p>Las cookies y tecnologías similares guardan pequeños datos en tu navegador para que la web funcione o para obtener estadísticas.</p>
        <h2>2. Cookies que usamos</h2>
        <ul>
          <li>
            <strong>Técnicas (necesarias):</strong> sesión de usuario de Supabase (<code>sb-*</code>), tu decisión sobre cookies (
            <code>hdm_consent</code>) y la cesta, que se guarda en el almacenamiento local del navegador. No necesitan consentimiento (art. 22.2
            LSSI-CE).
          </li>
          <li>
            <strong>Analítica (opcional):</strong> solo se cargan si las aceptas y si la tienda tiene configurada una herramienta (Plausible o
            Google Analytics). Por defecto no hay ninguna activa.
          </li>
        </ul>
        <p>No usamos cookies publicitarias ni de seguimiento entre webs.</p>
        <h2>3. Cómo gestionarlas</h2>
        <p>
          Puedes cambiar tu decisión cuando quieras desde «Configurar cookies» en el pie de página, o borrar las cookies desde la configuración de
          tu navegador.
        </p>
      </>
    ),
  },

  condiciones: {
    title: 'Condiciones de compra',
    description: 'Condiciones generales de contratación de la tienda online.',
    body: () => (
      <>
        <h2>1. Vendedor</h2>
        <p>
          {name()}, NIF {nif()}, {address()}, {email()}.
        </p>
        <h2>2. Productos y precios</h2>
        <p>
          Vendemos kits de cocina con ingredientes secos, especias y receta. Los ingredientes frescos indicados en cada ficha no se incluyen. Todos
          los precios incluyen el IVA aplicable. Los gastos de envío se muestran antes de pagar.
        </p>
        <h2>3. Quién puede comprar</h2>
        <p>Para comprar hay que ser mayor de edad o contar con la autorización de la madre, padre o tutor, que será quien realice el pago.</p>
        <h2>4. Proceso de compra</h2>
        <ol>
          <li>Añades los productos a la cesta y revisas el resumen.</li>
          <li>Indicas tus datos de contacto y envío y aceptas estas condiciones.</li>
          <li>Pagas en la página segura de Stripe.</li>
          <li>Te enviamos la confirmación del pedido por email. El contrato se perfecciona con esa confirmación.</li>
        </ol>
        <h2>5. Pago</h2>
        <p>
          El pago se procesa con Stripe. El pedido solo se considera pagado cuando Stripe lo confirma. Si un producto se agota durante el pago, te
          lo comunicaremos y te devolveremos el importe.
        </p>
        <h2>6. Envío</h2>
        <p>
          Consulta la página de <Link href="/legal/envios">envíos</Link>.
        </p>
        <h2>7. Derecho de desistimiento</h2>
        <p>
          Tienes {commerce.returnDays} días naturales desde la entrega para desistir sin dar explicaciones (art. 102 y siguientes del Real Decreto
          Legislativo 1/2007). No aplica, según el artículo 103, a los productos que puedan deteriorarse o caducar con rapidez ni a los productos
          precintados por motivos de salud o higiene que se hayan desprecintado. Más detalles en{' '}
          <Link href="/legal/devoluciones">cambios y devoluciones</Link>.
        </p>
        <h2>8. Garantía y reclamaciones</h2>
        <p>
          Los productos tienen la garantía legal de conformidad. Para cualquier incidencia escríbenos a {email()}. Tienes a tu disposición hojas
          de reclamaciones.
        </p>
        <h2>9. Ley aplicable</h2>
        <p>Legislación española. En caso de conflicto, serán competentes los juzgados del domicilio del consumidor.</p>
      </>
    ),
  },

  envios: {
    title: 'Envíos',
    description: 'Plazos, costes y zonas de envío.',
    body: () => (
      <>
        <h2>Zonas</h2>
        <p>
          Enviamos a la Península y a las Islas Baleares. Por ahora no enviamos a Canarias, Ceuta, Melilla ni fuera de España (tienen un régimen
          fiscal y aduanero distinto).
        </p>
        <h2>Coste</h2>
        <ul>
          <li>Envío estándar: {formatPrice(commerce.shippingCents)} (IVA incluido).</li>
          <li>Gratis en pedidos desde {formatPrice(commerce.freeShippingThresholdCents)}, una vez aplicados los descuentos.</li>
        </ul>
        <h2>Plazos</h2>
        <p>
          Preparamos los pedidos en días laborables. El plazo orientativo de entrega es de {commerce.deliveryEstimate}. Recibirás el número de
          seguimiento cuando el pedido salga de nuestro almacén; también lo verás en <Link href="/cuenta/pedidos">tus pedidos</Link>.
        </p>
        <h2>Caja sorpresa</h2>
        <p>Las cajas de 3 y 6 meses se envían la primera semana de cada mes a la misma dirección.</p>
      </>
    ),
  },

  devoluciones: {
    title: 'Cambios y devoluciones',
    description: 'Cómo devolver un pedido y qué productos admiten devolución.',
    body: () => (
      <>
        <h2>Plazo</h2>
        <p>Tienes {commerce.returnDays} días naturales desde la entrega para devolver productos sin abrir.</p>
        <h2>Qué se puede devolver</h2>
        <ul>
          <li>Kits con el precinto intacto.</li>
          <li>Productos que lleguen dañados o no sean conformes: siempre, sin coste para ti.</li>
        </ul>
        <p>
          Por higiene y seguridad alimentaria, no se admiten devoluciones de kits abiertos salvo que tengan un defecto (art. 103 del Real Decreto
          Legislativo 1/2007).
        </p>
        <h2>Cómo hacerlo</h2>
        <ol>
          <li>Escríbenos a {email()} con tu número de pedido.</li>
          <li>Te indicaremos cómo enviarnos el paquete.</li>
          <li>Cuando lo recibamos, te devolveremos el importe en un máximo de 14 días por el mismo medio de pago.</li>
        </ol>
        <p>Salvo defecto del producto, los gastos de la devolución corren por tu cuenta.</p>
      </>
    ),
  },
}
