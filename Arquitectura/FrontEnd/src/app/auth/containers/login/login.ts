import { Component, inject, ChangeDetectorRef, NgZone, PLATFORM_ID } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { soloLetrasValidator, soloLetras } from '../../../validations/validators';
import { GoogleService } from '../../services/google';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';
import { Users } from '../../services/users';
import { RecaptchaModule, RecaptchaFormsModule } from 'ng-recaptcha';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RecaptchaModule,
    RecaptchaFormsModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})

export class Login {
  private googleService = inject(GoogleService);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  isToggled = false;
  registerForm: FormGroup;
  loginForm: FormGroup;
  loading = false;

  esperandoPin = false;
  pinIngresado = '';
  pinCorrectoBD = '';
  usuarioUidTemporal = '';

  showModal = false;
  modalTitle = '';
  modalMessage = '';
  modalIcon = '';
  modalType: 'modal-success' | 'modal-error' = 'modal-success';

  // Variables del calendario
  fechaMinima: string = '';
  fechaMaxima: string = '';

  nombreArchivoCedula: string = '';
  fotoCedulaBase64: string = '';

  captchaTokenLogin: string | null = null;
  captchaTokenRegister: string | null = null;

  recaptchaSiteKey = environment.recaptchaSiteKey;

  constructor(public users: Users, // <--- Agrega esto
    private fb: FormBuilder,) {
    this.registerForm = this.fb.group({
      NombreCompleto: ['', [Validators.required, Validators.maxLength(100), soloLetrasValidator()]],
      Telefono: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      Email: ['', [Validators.required, Validators.email]],
      Password: ['', [Validators.required, Validators.minLength(6)]],
      Rol: ['', [Validators.required]],
      NSS: [''],
      FotoCedula: [''],
      Especialidad: [''],
      DireccionClinica: [''],
      FechaNacimiento: [''],
      Activo: [true],
      recaptcha: ['', Validators.required],
    });

    this.loginForm = this.fb.group({
      Email: ['', [Validators.required, Validators.email]],
      Password: ['', [Validators.required, Validators.minLength(6)]],
      recaptcha: ['', Validators.required]
    });

    this.registerForm.get('Rol')?.valueChanges.subscribe(rol => {
      this.actualizarValidacionesDinamicas(rol);
    });

    this.configurarLimitesFecha();
  }

  onCaptchaLoginResolved(token: string | null) {
    this.captchaTokenLogin = token;
    this.loginForm.get('recaptcha')?.setValue(token);
  }

  onCaptchaRegisterResolved(token: string | null) {
    this.captchaTokenRegister = token;
    this.registerForm.get('recaptcha')?.setValue(token);
  }

  private configurarLimitesFecha() {
    const hoy = new Date();
    // Para nacimiento, permitimos que la fecha máxima sea el día de hoy
    this.fechaMaxima = hoy.toISOString().split('T')[0];

    // Establecemos una fecha mínima razonable (ej. hace 100 años)
    const minFecha = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
    this.fechaMinima = minFecha.toISOString().split('T')[0];

    // Opcional: inicializar vacío o con una fecha estimada
    this.registerForm.patchValue({ FechaNacimiento: '' });
  }

  private actualizarValidacionesDinamicas(rol: string) {
    const pacienteFields = ['NSS'];
    const doctorFields = ['FotoCedula', 'Especialidad', 'DireccionClinica'];
    const acompananteFields = ['FechaNacimiento'];

    pacienteFields.forEach(fieldName => {
      const control = this.registerForm.get(fieldName);
      if (rol === 'Paciente') {
        control?.setValidators([Validators.required, Validators.pattern('^[0-9]{11}$')]);
      } else {
        control?.clearValidators();
        control?.setValue('');
      }
      control?.updateValueAndValidity();
    });

    doctorFields.forEach(fieldName => {
      const control = this.registerForm.get(fieldName);
      if (rol === 'Doctor') {
        control?.setValidators([Validators.required]);
      } else {
        control?.clearValidators();
        control?.setValue('');
      }
      control?.updateValueAndValidity();
    });

    acompananteFields.forEach(fieldName => {
      const control = this.registerForm.get(fieldName);
      if (rol === 'Acompañante') {
        control?.setValidators([Validators.required]);
      } else {
        control?.clearValidators();
        control?.setValue('');
      }
      control?.updateValueAndValidity();
    });
  }

  async onSubmitSignUp() {
    if (!this.captchaTokenRegister) {
      this.openModal('Verificación requerida', 'Por favor completa el reCAPTCHA.', 'modal-error');
      return;
    }

    if (this.registerForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();

      const f = this.registerForm.value;

      // Lógica para separar el nombre completo en partes para la DB
      const partesNombre = f.NombreCompleto.trim().split(' ');
      const nombre = partesNombre[0] || '';
      const apPaterno = partesNombre[1] || '';
      const apMaterno = partesNombre.slice(2).join(' ') || ''; // Por si tiene dos nombres o apellidos compuestos

      // Estructura que espera tu Backend (auth.controller.js)
      const datosParaBackend = {
        nombre: nombre,
        apPaterno: apPaterno,
        apMaterno: apMaterno,
        correo: f.Email,
        contrasenia: f.Password,
        rol: f.Rol,
        telefono: f.Telefono,
        recaptchaToken: this.captchaTokenRegister,
        datosExtra: {
          // Campos específicos según el rol
          cedula: f.FotoCedula,
          especialidad: f.Especialidad,
          direccion: f.DireccionClinica,
          nss: f.NSS,
          fechaNacimiento: f.FechaNacimiento,
          idPacienteAsociado: f.IdPacienteAsociado || null
        }
      };

      // Llamada al servicio que conecta con Node.js
      // Nota: Asegúrate de haber inyectado 'authService' en el constructor
      this.users.registrar(datosParaBackend).subscribe({
        next: (res: any) => {
          // Autologuear al usuario inmediatamente después del registro
          this.users.login({ correo: f.Email, contrasenia: f.Password }).subscribe({
            next: (loginRes: any) => {
              this.ngZone.run(() => {
                this.loading = false;
                this.usuarioUidTemporal = loginRes.uid;
                this.pinCorrectoBD = loginRes.pin;
                this.esperandoPin = true;
                this.isToggled = false;

                this.openModal(
                  '¡Registro Exitoso!',
                  'Usuario guardado correctamente. Revisa tu correo para tu PIN.',
                  'modal-success'
                );
                this.cdr.detectChanges();
              });
            },
            error: () => {
              this.ngZone.run(() => {
                this.loading = false;
                this.isToggled = false;
                this.openModal(
                  '¡Registro Exitoso!',
                  'Usuario guardado. Por favor inicia sesión.',
                  'modal-success'
                );
                this.cdr.detectChanges();
              });
            }
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.loading = false;
            // Manejo de errores que vienen del backend (ej: Correo duplicado)
            const mensajeError = err.error?.error || 'No se pudo conectar con el servidor.';
            this.openModal('Error al Registrar', mensajeError, 'modal-error');
          });
        }
      });

    } else {
      this.openModal('Formulario Incompleto', 'Por favor revisa los campos marcados.', 'modal-error');
    }
  }

  async onLoginWithGoogle() {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      // 1. Llamamos al servicio (que ahora consulta a Node.js + PostgreSQL)
      const res: any = await this.googleService.loginWithGoogle();

      this.ngZone.run(() => {
        this.loading = false;

        // Guardamos el UID que viene de nuestra base de datos (Postgres)
        this.usuarioUidTemporal = res.uid;

        if (res.pinVerificado === true) {
          // Si ya está verificado, guardamos el token y entramos
          if (res.accessToken) localStorage.setItem('token', res.accessToken);
          this.router.navigate(['/inicio']);
        } else {
          // Si NO está verificado, el GoogleService ya disparó el correo con EmailJS
          // así que solo preparamos la vista del PIN en el HTML
          this.pinCorrectoBD = res.pin;
          this.esperandoPin = true;
          this.openModal('Verificación Requerida', 'Se ha enviado un código de seguridad a tu correo de Google.', 'modal-success');
          this.cdr.detectChanges();
        }
      });
    } catch (error: any) {
      this.ngZone.run(() => {
        this.loading = false;
        // El error puede ser "No tienes cuenta" o "Error de servidor"
        this.openModal('Acceso Denegado', error.message, 'modal-error');
      });
    }
  }

  async onLoginWithEmailPassword() {

    if (!this.captchaTokenLogin) {
      this.openModal('Verificación requerida', 'Por favor completa el reCAPTCHA.', 'modal-error');
      return;
    }

    if (this.loginForm.invalid) {
      this.openModal('Formulario Incompleto', 'Por favor ingresa un correo y contraseña válidos.', 'modal-error');
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    const { Email, Password } = this.loginForm.value;
    const credenciales = { correo: Email, contrasenia: Password, recaptchaToken: this.captchaTokenLogin };

    this.users.login(credenciales).subscribe({
      next: (res: any) => {
        // ESTO ES LO QUE AGREGAMOS PARA ENVIAR EL CORREO
        console.log('Respuesta del servidor:', res);

        this.ngZone.run(() => {
          this.loading = false;

          if (res.pinVerificado === true) {
            if (res.token) localStorage.setItem('token', res.token);
            this.router.navigate(['/inicio']);
          } else {
            // Si falta verificar PIN, preparamos la vista (El servicio ya mandó el correo)
            this.usuarioUidTemporal = res.uid;
            this.pinCorrectoBD = res.pin;
            this.esperandoPin = true;

            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          // Si el error es 423, el servicio ya activó el bloqueo, así que solo avisamos
          if (err.status === 423) {
            this.openModal('Cuenta Bloqueada', `Demasiados intentos. Espera un momento.`, 'modal-error');
          } else {
            const mensajeError = err.error?.error || 'Correo o contraseña incorrectos.';
            this.openModal('Error de Acceso', mensajeError, 'modal-error');
          }
        });
      }
    });
  }

  async verificarPin() {
    if (this.users.estaBloqueado()) return;
    this.loading = true;

    // Envíamos el UID temporal y el PIN que el usuario escribió en el input
    this.users.verificarPin(this.usuarioUidTemporal, this.pinIngresado).subscribe({
      next: (res: any) => {
        this.loading = false;

        // Si tu backend devuelve un token después de verificar el PIN:
        if (res.accessToken) localStorage.setItem('token', res.accessToken);

        // Navegar inmediatamente para que se sienta fluido y rápido
        this.ngZone.run(() => this.router.navigate(['/inicio']));
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 423) {
          this.openModal('Bloqueo de Seguridad', 'Has fallado demasiadas veces. Espera 3 minutos.', 'modal-error');
        } else {
          const mensaje = err.error?.error || 'PIN incorrecto.';
          this.openModal('Error', mensaje, 'modal-error');
        }
      }
    });
  }

  get tiempoBloqueo(): string {
    const total = this.users.segundosRestantes();
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${min}:${seg < 10 ? '0' : ''}${seg}`;
  }

  async reenviarPin() {
    if (!this.usuarioUidTemporal) {
      this.openModal('Error', 'No se pudo identificar al usuario. Intenta iniciar sesión de nuevo.', 'modal-error');
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    // Llamamos al método que actualizamos en el servicio
    this.users.solicitarNuevoPin(this.usuarioUidTemporal).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.openModal('PIN Reenviado', 'Se ha enviado un nuevo código a tu correo.', 'modal-success');
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.loading = false;
          const mensaje = err.error?.error || 'No se pudo reenviar el correo.';
          this.openModal('Error', mensaje, 'modal-error');
          this.cdr.detectChanges();
        });
      }
    });
  }

  onKeyPress(event: KeyboardEvent): boolean { return soloLetras(event); }
  soloNumeros(event: KeyboardEvent): boolean {
    const charCode = event.key.charCodeAt(0);
    return (charCode >= 48 && charCode <= 57);
  }

  private openModal(title: string, message: string, type: 'modal-success' | 'modal-error') {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalIcon = type === 'modal-success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() { this.showModal = false; }

  inicializarCalendario() {
    if (isPlatformBrowser(this.platformId)) {
      // Agregamos un pequeño delay para asegurar que el input sea visible en el DOM
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        const config: any = {
          locale: Spanish,
          dateFormat: "Y-m-d",
          minDate: "today",
          appendTo: document.body,
          static: false,
          disableMobile: true, // Esto quita el calendario "feo" del celular
          onChange: (selectedDates: any, dateStr: string) => {
            const control = this.registerForm.get('FechaNacimiento');
            if (control) {
              control.setValue(dateStr);
              control.markAsDirty();
              control.updateValueAndValidity();
            }
            this.cdr.detectChanges();
          }
        };

        const fp = flatpickr('#fechaInput', config);

        // Verificación de seguridad para evitar el "TypeError: undefined"
        if (fp) {
          const instance = Array.isArray(fp) ? fp[0] : fp;
          if (instance && typeof instance.open === 'function') {
            instance.open();
          }
        } else {
          console.warn('No se encontró el elemento #fechaInput en el DOM');
        }
      }, 50); // 50ms son suficientes
    }
  }

  toggleToSignUp() {
    this.isToggled = true;
    setTimeout(() => {
      this.inicializarCalendario();
    }, 200);
  }

  toggleToSignIn() {
    this.isToggled = false;
    this.esperandoPin = false;
  }

  irAInicio() {
    this.router.navigate(['/landing']);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (file.type !== 'application/pdf') {
        this.openModal('Formato Inválido', 'Por favor, selecciona tu Cédula en formato PDF.', 'modal-error');
        input.value = '';
        return;
      }

      // Validar tamaño: Firestore limita a 1MB por documento. Dejamos el límite en 800KB para el PDF.
      if (file.size > 800 * 1024) {
        this.openModal('Archivo muy pesado', 'El PDF debe pesar menos de 800KB para poder registrarlo.', 'modal-error');
        input.value = '';
        return;
      }

      this.nombreArchivoCedula = file.name;
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.fotoCedulaBase64 = e.target.result;
        const control = this.registerForm.get('FotoCedula');
        if (control) {
          control.setValue(this.fotoCedulaBase64);
          control.markAsTouched();
          control.updateValueAndValidity();
        }
        this.cdr.detectChanges();
      };

      reader.readAsDataURL(file);
    }
  }
}