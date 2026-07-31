'use client'

import { useActionState, useState } from 'react'
import { iniciarSesion, registrarse, solicitarAcceso, type EstadoAuth } from './actions'
import { Aviso, Campo, Input, TextArea } from '@/components/ui'
import { BotonEnviar } from '@/components/boton-enviar'

const inicial: EstadoAuth = {}

export default function FormularioLogin({
  redirigir,
  errorInicial,
  permitirRegistroInicial,
}: {
  redirigir: string
  errorInicial?: string
  permitirRegistroInicial: boolean
}) {
  const [modo, setModo] = useState<'entrar' | 'crear' | 'solicitar'>('entrar')
  const [estadoEntrar, accionEntrar] = useActionState(iniciarSesion, inicial)
  const [estadoCrear, accionCrear] = useActionState(registrarse, inicial)
  const [estadoSolicitar, accionSolicitar] = useActionState(solicitarAcceso, inicial)

  const estado =
    modo === 'entrar' ? estadoEntrar : modo === 'crear' ? estadoCrear : estadoSolicitar

  const accion = modo === 'entrar' ? accionEntrar : modo === 'crear' ? accionCrear : accionSolicitar

  return (
    <main className="flex min-h-screen items-center justify-center bg-crema px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1 className="titulo-editorial text-4xl text-tinta">MOORA</h1>
          <p className="mt-1 text-sm text-tinta-suave">Inventario, ventas y finanzas</p>
        </div>

        <div className="rounded-panel border border-borde bg-papel p-6 shadow-elevada">
          <div className="mb-5 flex gap-1 rounded-campo bg-borde-suave p-1">
            {(
              [
                ['entrar', 'Ingresar'] as const,
                permitirRegistroInicial
                  ? (['crear', 'Crear cuenta'] as const)
                  : (['solicitar', 'Solicitar acceso'] as const),
              ]
            ).map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setModo(valor)}
                className={`min-h-10 flex-1 rounded-[7px] text-sm font-semibold transition-colors ${
                  modo === valor ? 'bg-papel text-vino shadow-tarjeta' : 'text-tinta-suave'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          <form action={accion} className="flex flex-col gap-4">
            <input type="hidden" name="redirigir" value={redirigir} />

            {(modo === 'crear' || modo === 'solicitar') && (
              <Campo etiqueta="Nombre completo">
                <Input name="nombre" type="text" required autoComplete="name" placeholder="Tu nombre" />
              </Campo>
            )}

            <Campo etiqueta="Correo">
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tucorreo@ejemplo.com"
              />
            </Campo>

            {modo === 'solicitar' && (
              <>
                <Campo etiqueta="Teléfono (opcional)">
                  <Input name="telefono" type="tel" autoComplete="tel" placeholder="+51 999 999 999" />
                </Campo>
                <Campo etiqueta="Mensaje (opcional)">
                  <TextArea
                    name="mensaje"
                    rows={3}
                    placeholder="Cuéntanos tu cargo en la empresa o para qué necesitas acceso."
                  />
                </Campo>
              </>
            )}

            {(modo === 'entrar' || modo === 'crear') && (
              <Campo
                etiqueta="Contraseña"
                ayuda={modo === 'crear' ? 'Mínimo 8 caracteres.' : undefined}
              >
                <Input
                  name="password"
                  type="password"
                  required
                  autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                />
              </Campo>
            )}

            {errorInicial === 'inactivo' && (
              <Aviso>Tu cuenta está desactivada. Pide al administrador que la habilite.</Aviso>
            )}
            {estado.error && <Aviso>{estado.error}</Aviso>}
            {estado.mensaje && <Aviso tipo="ok">{estado.mensaje}</Aviso>}

            <BotonEnviar
              className="w-full"
              pendienteTexto={
                modo === 'entrar' ? 'Entrando…' : modo === 'crear' ? 'Creando cuenta…' : 'Enviando…'
              }
            >
              {modo === 'entrar' ? 'Ingresar' : modo === 'crear' ? 'Crear cuenta' : 'Solicitar acceso'}
            </BotonEnviar>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-tinta-suave">
          {permitirRegistroInicial
            ? 'La primera cuenta que se registre queda como administrador.'
            : '¿Ya tienes una solicitud aprobada? Revisa tu correo para activar tu cuenta.'}
        </p>
      </div>
    </main>
  )
}
