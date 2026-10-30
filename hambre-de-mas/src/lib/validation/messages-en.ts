/**
 * Mensajes de validación en inglés, por su texto en español (schemas.ts).
 * Solo los que ve un cliente; los del panel de administración van en español.
 * La prueba tests/unit/i18n.test.ts comprueba que no falte ninguno.
 */

const required = (es: string, en: string) => ({
  [`${es} es obligatorio`]: `${en} is required`,
  [`${es} es demasiado largo`]: `${en} is too long`,
})

export const VALIDATION_EN: Record<string, string> = {
  ...required('El nombre', 'Name'),
  ...required('La dirección', 'Address'),
  ...required('La ciudad', 'City'),
  ...required('La provincia', 'Province'),
  'Escribe tu email': 'Enter your email',
  'Escribe un email válido': 'Enter a valid email',
  'Escribe un teléfono válido': 'Enter a valid phone number',
  'Código no válido': 'Invalid code',
  'Producto no válido': 'Invalid product',
  'Demasiados productos en el carrito': 'Too many items in the bag',
  'El código postal tiene 5 cifras': 'Postcodes have 5 digits',
  'De momento solo enviamos a la Península y Baleares': 'For now we only ship to mainland Spain and the Balearic Islands',
  'Tu carrito está vacío': 'Your bag is empty',
  'Tienes que aceptar las condiciones de compra': 'You need to accept the terms of sale',
  'La contraseña necesita al menos 8 caracteres': 'Your password needs at least 8 characters',
  'La contraseña es demasiado larga': 'Your password is too long',
  'Indica tu fecha de nacimiento': 'Enter your date of birth',
  'Tienes que aceptar la política de privacidad': 'You need to accept the privacy policy',
  'Revisa la fecha de nacimiento': 'Check your date of birth',
  'Con menos de 14 años necesitas el permiso de tu madre, padre o tutor': 'Under 14 you need permission from your parent or guardian',
  'Escribe tu contraseña': 'Enter your password',
  'Necesitamos tu consentimiento': 'We need your consent',
  'Elige un tamaño': 'Choose a size',
  'Cuéntanos un poco más (mínimo 10 caracteres)': 'Tell us a bit more (at least 10 characters)',
  'Revisa los datos del formulario': 'Please check the form',
}
