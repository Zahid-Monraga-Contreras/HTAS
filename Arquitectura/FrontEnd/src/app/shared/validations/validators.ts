import { AbstractControl, ValidatorFn } from '@angular/forms';

// Validador personalizado para permitir solo letras y espacios
export function soloLetrasValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const soloLetrasRegex = /^[a-zA-Z\s]*$/; // Permite letras y espacios
    const valido = soloLetrasRegex.test(control.value);
    return valido ? null : { soloLetras: true }; // Retorna null si es válido, o un objeto de error si no lo es
  };
}

// Función para evitar la entrada de números o caracteres no permitidos
export function soloLetras(event: KeyboardEvent): boolean {
  const charCode = event.key.charCodeAt(0);
  // Permitir letras (mayúsculas y minúsculas) y espacios
  if ((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || charCode === 32) {
    return true; // Permitir la tecla
  } else {
    event.preventDefault(); // Bloquear la tecla
    return false;
  }
}

// Validador personalizado para permitir solo números y validar la longitud máxima
export function soloNumerosValidator(maxLength: number): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const soloNumerosRegex = /^[0-9]*$/; // Permite solo números
    const valido = soloNumerosRegex.test(control.value);
    const longitudValida = control.value.length <= maxLength; // Valida la longitud máxima

    if (!valido) {
      return { soloNumeros: true }; // Error si no son solo números
    }
    if (!longitudValida) {
      return { maxlength: { requiredLength: maxLength, actualLength: control.value.length } }; // Error si excede la longitud
    }
    return null; // Válido
  };
}

// Validador personalizado para verificar que el correo termine en un dominio específico
export function dominioEspecificoValidator(dominio: string): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const correo = control.value;
    if (correo && !correo.endsWith(dominio)) {
      return { dominioEspecifico: true }; // Retorna un error si el correo no termina en el dominio especificado
    }
    return null; // Válido
  };
}