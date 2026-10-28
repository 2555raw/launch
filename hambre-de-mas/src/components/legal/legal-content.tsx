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
    description: 'Información sobre el tratamiento de datos personales conforme al RGPD y la LOPDGDD.',
    body: () => (
      <>
        <p>
          En {site.name} tratamos tus datos personales con transparencia y solo para lo necesario. Esta política explica quién es el
          responsable, para qué usamos tus datos, con qué base legal, durante cuánto tiempo, a quién se comunican y cómo ejercer tus
          derechos, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de
          los derechos digitales (LOPDGDD).
        </p>

        <div className="not-prose my-8 rounded-2xl bg-mist p-5 text-sm">
          <p className="mb-2 font-semibold text-ink">Información básica sobre protección de datos</p>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[160px_1fr]">
            <dt className="text-ash-ink">Responsable</dt>
            <dd>{name()} · NIF {nif()}</dd>
            <dt className="text-ash-ink">Finalidades</dt>
            <dd>Gestionar pedidos y envíos, tu cuenta, la atención al cliente y, si lo autorizas, enviarte novedades.</dd>
            <dt className="text-ash-ink">Legitimación</dt>
            <dd>Ejecución del contrato, obligaciones legales, interés legítimo y tu consentimiento.</dd>
            <dt className="text-ash-ink">Destinatarios</dt>
            <dd>Proveedores que nos prestan servicios (pagos, alojamiento, transporte). No vendemos tus datos.</dd>
            <dt className="text-ash-ink">Derechos</dt>
            <dd>Acceso, rectificación, supresión, oposición, limitación, portabilidad y retirada del consentimiento.</dd>
            <dt className="text-ash-ink">Contacto</dt>
            <dd>{email()}</dd>
          </dl>
        </div>

        <h2>1. Responsable del tratamiento</h2>
        <ul>
          <li>Razón social: {name()}</li>
          <li>NIF: {nif()}</li>
          <li>Domicilio: {address()}</li>
          <li>Correo electrónico para asuntos de privacidad: {email()}</li>
          {company.phone && <li>Teléfono: {company.phone}</li>}
        </ul>
        <p>
          Si se designa un Delegado de Protección de Datos, sus datos de contacto se publicarán en este apartado.
        </p>

        <h2>2. Finalidades, bases jurídicas y plazos de conservación</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Finalidad</th>
                <th>Datos tratados</th>
                <th>Base jurídica (art. 6 RGPD)</th>
                <th>Conservación</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gestionar tu pedido, el pago, el envío y las devoluciones</td>
                <td>Identificación, contacto, dirección de entrega, productos y datos de la transacción</td>
                <td>Ejecución de un contrato (6.1.b)</td>
                <td>Mientras dure la relación y, después, durante los plazos de prescripción de acciones</td>
              </tr>
              <tr>
                <td>Facturación, contabilidad y obligaciones fiscales</td>
                <td>Identificación, NIF si lo facilitas, importes</td>
                <td>Obligación legal (6.1.c)</td>
                <td>6 años (Código de Comercio) y plazos de la normativa tributaria</td>
              </tr>
              <tr>
                <td>Crear y mantener tu cuenta de cliente</td>
                <td>Email, contraseña cifrada, nombre, teléfono, fecha de nacimiento, direcciones, preferencias de cocina y alérgenos a evitar</td>
                <td>Ejecución del contrato (6.1.b) y consentimiento (6.1.a) para los datos opcionales</td>
                <td>Hasta que elimines la cuenta</td>
              </tr>
              <tr>
                <td>Atender consultas, incidencias y reclamaciones</td>
                <td>Contacto y contenido de la consulta</td>
                <td>Ejecución del contrato (6.1.b) o interés legítimo (6.1.f)</td>
                <td>El tiempo necesario para resolverla y los plazos legales aplicables</td>
              </tr>
              <tr>
                <td>Enviarte la newsletter y promociones</td>
                <td>Email</td>
                <td>Consentimiento (6.1.a)</td>
                <td>Hasta que te des de baja</td>
              </tr>
              <tr>
                <td>Publicar tus opiniones sobre productos</td>
                <td>Nombre que elijas, valoración y texto</td>
                <td>Consentimiento (6.1.a)</td>
                <td>Hasta que la retires</td>
              </tr>
              <tr>
                <td>Seguridad de la tienda y prevención del fraude</td>
                <td>Datos técnicos de conexión y registros de actividad</td>
                <td>Interés legítimo (6.1.f)</td>
                <td>Hasta 12 meses, salvo que sean necesarios para una investigación</td>
              </tr>
              <tr>
                <td>Analítica de uso (solo si la aceptas)</td>
                <td>Datos de navegación seudonimizados</td>
                <td>Consentimiento (6.1.a y art. 22.2 LSSI-CE)</td>
                <td>Según la <Link href="/legal/cookies">política de cookies</Link></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Los datos marcados como obligatorios en los formularios son necesarios para prestarte el servicio; si no los facilitas, no
          podremos tramitar el pedido o crear la cuenta. Los alérgenos que nos indiques solo se usan para avisarte en la tienda y adaptar
          envíos; no se utilizan para ninguna otra finalidad.
        </p>
        <p>
          Avisos de compras recientes: durante unas horas después de una compra, la tienda puede mostrar a otros visitantes un aviso del tipo
          «Alguien de Madrid ha comprado el Kit Ramen». Solo se muestran el producto y la provincia (deducida del código postal); nunca tu
          nombre, tu ciudad, tu dirección ni el importe, así que el aviso no permite identificarte.
        </p>

        <h2>3. Menores de edad</h2>
        <p>
          La tienda está dirigida a adolescentes y a sus familias. Conforme al artículo 7 de la LOPDGDD, las personas menores de 14 años
          necesitan el consentimiento de su madre, padre o tutor legal para crear una cuenta, y así se les solicita en el registro. Las
          compras de menores deben realizarlas o autorizarlas sus representantes legales, que son quienes realizan el pago. Si detectamos
          una cuenta de un menor de 14 años sin ese consentimiento, la bloquearemos y eliminaremos sus datos.
        </p>

        <h2>4. Destinatarios y encargados del tratamiento</h2>
        <p>No vendemos ni cedemos tus datos a terceros con fines comerciales. Solo se comunican a:</p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Destinatario</th>
                <th>Servicio</th>
                <th>Garantías</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Stripe Payments Europe, Ltd.</td>
                <td>Procesamiento de pagos. Trata los datos de tu tarjeta como responsable independiente; nosotros nunca los vemos ni los guardamos.</td>
                <td>Normativa PCI-DSS y RGPD</td>
              </tr>
              <tr>
                <td>Supabase, Inc.</td>
                <td>Base de datos, autenticación y almacenamiento (proyecto alojado en la Unión Europea)</td>
                <td>Contrato de encargo (art. 28 RGPD) y cláusulas contractuales tipo</td>
              </tr>
              <tr>
                <td>Proveedor de alojamiento web</td>
                <td>Servidores de la tienda</td>
                <td>Contrato de encargo (art. 28 RGPD)</td>
              </tr>
              <tr>
                <td>Proveedor de envío de emails (si se activa)</td>
                <td>Emails de confirmación de pedido y newsletter</td>
                <td>Contrato de encargo (art. 28 RGPD)</td>
              </tr>
              <tr>
                <td>Anthropic (si se activa el asistente de ayuda con IA)</td>
                <td>
                  Generar las respuestas del chat de ayuda. Solo recibe lo que escribes en el chat; la tienda no guarda las conversaciones. No
                  escribas datos personales ni de pago en el chat.
                </td>
                <td>Contrato de encargo (art. 28 RGPD) y cláusulas contractuales tipo</td>
              </tr>
              <tr>
                <td>Empresas de transporte</td>
                <td>Entrega del pedido (nombre, dirección y teléfono)</td>
                <td>Necesario para la ejecución del contrato</td>
              </tr>
              <tr>
                <td>Administraciones públicas, juzgados y tribunales</td>
                <td>Cuando exista una obligación legal</td>
                <td>Obligación legal</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>5. Transferencias internacionales</h2>
        <p>
          Algunos proveedores pueden acceder a datos desde fuera del Espacio Económico Europeo. En ese caso, la transferencia se ampara en
          una decisión de adecuación de la Comisión Europea (incluido el Marco de Privacidad de Datos UE-EE. UU. cuando el proveedor esté
          certificado) o en cláusulas contractuales tipo aprobadas por la Comisión, junto con las medidas adicionales necesarias.
        </p>

        <h2>6. Decisiones automatizadas</h2>
        <p>No tomamos decisiones basadas únicamente en tratamientos automatizados que produzcan efectos jurídicos sobre ti, ni elaboramos perfiles con ese fin.</p>

        <h2>7. Tus derechos</h2>
        <p>Puedes ejercer en cualquier momento, sin coste, los siguientes derechos:</p>
        <ul>
          <li><strong>Acceso</strong>: saber qué datos tuyos tratamos.</li>
          <li><strong>Rectificación</strong>: corregir datos inexactos. Muchos los puedes cambiar tú desde tu cuenta.</li>
          <li><strong>Supresión</strong>: pedir que borremos tus datos cuando ya no sean necesarios.</li>
          <li><strong>Oposición</strong> y <strong>limitación</strong> del tratamiento.</li>
          <li><strong>Portabilidad</strong>: recibir tus datos en un formato estructurado.</li>
          <li><strong>Retirar el consentimiento</strong> (por ejemplo, darte de baja de la newsletter) sin que afecte a lo hecho antes.</li>
        </ul>
        <p>
          Escríbenos a {email()} indicando el derecho que quieres ejercer. Responderemos en el plazo de un mes, ampliable en dos meses en
          casos complejos. Si no quedas satisfecho, puedes presentar una reclamación ante la Agencia Española de Protección de Datos
          (www.aepd.es, C/ Jorge Juan 6, 28001 Madrid).
        </p>

        <h2>8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas adecuadas al riesgo: conexiones cifradas (HTTPS), contraseñas cifradas, control de
          acceso por roles en la base de datos, separación de las claves privadas en el servidor y registro de las operaciones sensibles.
          Ningún dato de tarjeta pasa por nuestros sistemas.
        </p>

        <h2>9. Exactitud de los datos</h2>
        <p>Te comprometes a facilitar datos veraces y a mantenerlos actualizados. Si nos das datos de otra persona (por ejemplo, para un regalo), debes haberle informado antes.</p>

        <h2>10. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta política para adaptarla a cambios legales o del servicio. Publicaremos la versión vigente en esta página
          y, si el cambio es relevante, te avisaremos por email.
        </p>
        <p className="text-sm text-ash-ink">Última actualización: 27 de octubre de 2026.</p>
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
          Vendemos kits de cocina con receta. Los kits de nivel 1 y 2 contienen solo ingredientes secos; los de nivel 3 incluyen además
          ingredientes frescos refrigerados. Lo que tiene que poner el cliente (agua, aceite) se indica en cada ficha. Todos los precios
          incluyen el IVA aplicable. Los gastos de envío se muestran antes de pagar.
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
        <h2>Kits con frescos (nivel 3)</h2>
        <p>
          Los kits de nivel 3 incluyen ingredientes refrigerados y se envían en caja isotérmica con acumuladores de frío, en entrega de
          24 horas laborables. Guarda los frescos en la nevera nada más recibir el pedido. Si la caja llega dañada o caliente, no consumas
          los frescos y escríbenos con una foto: te lo reponemos.
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
