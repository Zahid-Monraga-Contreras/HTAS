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

  // Variables para el registro por pasos
  currentStep: number = 1;
  totalSteps: number = 3;

  // Variables para mostrar/ocultar contraseñas
  showLoginPassword: boolean = false;
  showRegisterPassword: boolean = false;
  showConfirmPassword: boolean = false;

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

  constructor(public users: Users, private fb: FormBuilder) {
    this.registerForm = this.fb.group({
      NombreCompleto: ['', [Validators.required, Validators.maxLength(100), soloLetrasValidator()]],
      Telefono: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      Email: ['', [Validators.required, Validators.email]],
      Password: ['', [Validators.required, Validators.minLength(6)]],
      ConfirmPassword: ['', [Validators.required]],
      Rol: ['', [Validators.required]],
      NSS: [''],
      FotoCedula: [''],
      Especialidad: [''],
      DireccionClinica: [''],
      FechaAsignacion: [''],
      Activo: [true],
      recaptcha: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });

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

  // Validador de coincidencia de contraseñas
  passwordMatchValidator(group: FormGroup): any {
    const password = group.get('Password')?.value;
    const confirmPassword = group.get('ConfirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  // Funciones para mostrar/ocultar contraseñas
  toggleLoginPassword(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  toggleRegisterPassword(): void {
    this.showRegisterPassword = !this.showRegisterPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Navegación entre pasos
  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      // Validar el paso actual antes de avanzar
      if (this.isStepValid(this.currentStep)) {
        this.currentStep++;
        // Si el siguiente paso es el 3, inicializar el calendario
        if (this.currentStep === 3) {
          setTimeout(() => this.inicializarCalendario(), 100);
        }
      } else {
        this.openModal('Campos incompletos', 'Por favor, completa todos los campos obligatorios antes de continuar.', 'modal-error');
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Validar si el paso actual está completo
  isStepValid(step: number): boolean {
    const form = this.registerForm;
    switch (step) {
      case 1:
        return !!(form.get('NombreCompleto')?.valid &&
          form.get('Telefono')?.valid &&
          form.get('Email')?.valid);
      case 2:
        return !!(form.get('Password')?.valid &&
          form.get('ConfirmPassword')?.valid &&
          !form.errors?.['mismatch']);
      case 3:
        const rol = form.get('Rol')?.value;
        if (!rol) return false;

        // Validar campos específicos según el rol
        if (rol === 'Paciente') {
          return !!(form.get('NSS')?.valid);
        } else if (rol === 'Doctor') {
          return !!(form.get('FotoCedula')?.valid &&
            form.get('Especialidad')?.valid &&
            form.get('DireccionClinica')?.valid);
        } else if (rol === 'Acompañante') {
          return !!(form.get('FechaAsignacion')?.valid);
        }
        return true;
      default:
        return true;
    }
  }

  // Verificar si el paso actual tiene errores visibles
  isStepInvalid(step: number): boolean {
    const form = this.registerForm;
    switch (step) {
      case 1:
        return !!(form.get('NombreCompleto')?.invalid ||
          form.get('Telefono')?.invalid ||
          form.get('Email')?.invalid);
      case 2:
        return !!(form.get('Password')?.invalid ||
          form.get('ConfirmPassword')?.invalid ||
          form.errors?.['mismatch']);
      case 3:
        const rol = form.get('Rol')?.value;
        if (!rol) return true;
        if (rol === 'Paciente') {
          return !!(form.get('NSS')?.invalid);
        } else if (rol === 'Doctor') {
          return !!(form.get('FotoCedula')?.invalid ||
            form.get('Especialidad')?.invalid ||
            form.get('DireccionClinica')?.invalid);
        } else if (rol === 'Acompañante') {
          return !!(form.get('FechaAsignacion')?.invalid);
        }
        return false;
      default:
        return false;
    }
  }

  onCaptchaLoginResolved(token: string | null): void {
    this.captchaTokenLogin = token;
    this.loginForm.get('recaptcha')?.setValue(token);
  }

  onCaptchaRegisterResolved(token: string | null): void {
    this.captchaTokenRegister = token;
    this.registerForm.get('recaptcha')?.setValue(token);
  }

  private configurarLimitesFecha(): void {
    const hoy = new Date();
    this.fechaMaxima = hoy.toISOString().split('T')[0];
    const minFecha = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
    this.fechaMinima = minFecha.toISOString().split('T')[0];
    this.registerForm.patchValue({ FechaAsignacion: '' });
  }

  private actualizarValidacionesDinamicas(rol: string): void {
    const pacienteFields = ['NSS'];
    const doctorFields = ['FotoCedula', 'Especialidad', 'DireccionClinica'];
    const acompananteFields = ['FechaAsignacion'];

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

  async onSubmitSignUp(): Promise<void> {
    if (!this.captchaTokenRegister) {
      this.openModal('Verificación requerida', 'Por favor completa el reCAPTCHA.', 'modal-error');
      return;
    }

    if (this.registerForm.valid) {
      this.loading = true;
      this.cdr.detectChanges();

      const f = this.registerForm.value;
      const partesNombre = f.NombreCompleto.trim().split(' ');
      const nombre = partesNombre[0] || '';
      const apPaterno = partesNombre[1] || '';
      const apMaterno = partesNombre.slice(2).join(' ') || '';

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
          cedula: f.FotoCedula,
          especialidad: f.Especialidad,
          direccion: f.DireccionClinica,
          nss: f.NSS,
          fechaAsignacion: f.FechaAsignacion,
          idPacienteAsociado: f.IdPacienteAsociado || null
        }
      };

      this.users.registrar(datosParaBackend).subscribe({
        next: (res: any) => {
          this.users.login({ correo: f.Email, contrasenia: f.Password }).subscribe({
            next: (loginRes: any) => {
              this.ngZone.run(() => {
                this.loading = false;
                this.usuarioUidTemporal = loginRes.uid;
                this.pinCorrectoBD = loginRes.pin;
                this.esperandoPin = true;
                this.isToggled = false;
                this.currentStep = 1;

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
                this.currentStep = 1;
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
            const mensajeError = err.error?.error || 'No se pudo conectar con el servidor.';
            this.openModal('Error al Registrar', mensajeError, 'modal-error');
          });
        }
      });

    } else {
      this.openModal('Formulario Incompleto', 'Por favor revisa los campos marcados.', 'modal-error');
    }
  }

  async onLoginWithGoogle(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();

    try {
      const res: any = await this.googleService.loginWithGoogle();
      this.ngZone.run(() => {
        this.loading = false;
        this.usuarioUidTemporal = res.uid;
        if (res.pinVerificado === true) {
          if (res.accessToken) localStorage.setItem('token', res.accessToken);
          this.router.navigate(['/inicio']);
        } else {
          this.pinCorrectoBD = res.pin;
          this.esperandoPin = true;
          this.openModal('Verificación Requerida', 'Se ha enviado un código de seguridad a tu correo de Google.', 'modal-success');
          this.cdr.detectChanges();
        }
      });
    } catch (error: any) {
      this.ngZone.run(() => {
        this.loading = false;
        this.openModal('Acceso Denegado', error.message, 'modal-error');
      });
    }
  }

  async onLoginWithEmailPassword(): Promise<void> {
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
        this.ngZone.run(() => {
          this.loading = false;
          if (res.pinVerificado === true) {
            if (res.token) localStorage.setItem('token', res.token);
            this.router.navigate(['/inicio']);
          } else {
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

  async verificarPin(): Promise<void> {
    if (this.users.estaBloqueado()) return;
    this.loading = true;

    this.users.verificarPin(this.usuarioUidTemporal, this.pinIngresado).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.accessToken) localStorage.setItem('token', res.accessToken);
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

  async reenviarPin(): Promise<void> {
    if (!this.usuarioUidTemporal) {
      this.openModal('Error', 'No se pudo identificar al usuario. Intenta iniciar sesión de nuevo.', 'modal-error');
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

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

  onKeyPress(event: KeyboardEvent): boolean {
    return soloLetras(event);
  }

  soloNumeros(event: KeyboardEvent): boolean {
    const charCode = event.key.charCodeAt(0);
    return (charCode >= 48 && charCode <= 57);
  }

  private openModal(title: string, message: string, type: 'modal-success' | 'modal-error'): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalIcon = type === 'modal-success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
  }

  inicializarCalendario(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        const hoy = new Date();
        const fechaMaxima = new Date(hoy.getFullYear(), hoy.getMonth() + 2, hoy.getDate());

        const config: any = {
          locale: Spanish,
          dateFormat: "Y-m-d",
          minDate: "today",
          appendTo: document.body,
          static: false,
          disableMobile: true,
          onChange: (selectedDates: any, dateStr: string) => {
            const control = this.registerForm.get('FechaAsignacion');
            if (control) {
              control.setValue(dateStr);
              control.markAsDirty();
              control.updateValueAndValidity();
            }
            this.cdr.detectChanges();
          }
        };

        const fp = flatpickr('#fechaInput', config);
        if (fp) {
          const instance = Array.isArray(fp) ? fp[0] : fp;
          if (instance && typeof instance.open === 'function') {
            instance.open();
          }
        }
      }, 50);
    }
  }

  toggleToSignUp(): void {
    this.isToggled = true;
    this.currentStep = 1;
    setTimeout(() => {
      this.inicializarCalendario();
    }, 200);
  }

  toggleToSignIn(): void {
    this.isToggled = false;
    this.esperandoPin = false;
    this.currentStep = 1;
  }

  irAInicio(): void {
    this.router.navigate(['/landing']);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.openModal('Formato Inválido', 'Por favor, selecciona tu Cédula en formato PDF.', 'modal-error');
        input.value = '';
        return;
      }
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