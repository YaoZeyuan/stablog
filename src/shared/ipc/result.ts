import { ApplicationError, SerializedApplicationError } from '~/src/shared/error/application_error.js'

export type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SerializedApplicationError }

export function createIpcSuccess<T>(value: T): IpcResult<T> {
  return { ok: true, value }
}

export function createIpcFailure(error: unknown): IpcResult<never> {
  return { ok: false, error: ApplicationError.from(error).toJSON() }
}

export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (result.ok) {
    return result.value
  }
  throw ApplicationError.fromSerialized(result.error)
}
