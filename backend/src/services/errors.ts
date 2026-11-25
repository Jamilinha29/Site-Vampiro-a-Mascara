export type ErrorDetails = Array<{ field?: string; message: string }> | Record<string, unknown>

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ErrorDetails
  readonly expose: boolean

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { details?: ErrorDetails; expose?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    this.details = options?.details
    this.expose = options?.expose ?? status < 500
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details?: ErrorDetails) {
    super(400, 'VALIDATION_ERROR', message, { details, expose: true })
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado.') {
    super(401, 'UNAUTHORIZED', message, { expose: true })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado.') {
    super(403, 'FORBIDDEN', message, { expose: true })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(404, 'NOT_FOUND', message, { expose: true })
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de estado.', details?: ErrorDetails) {
    super(409, 'CONFLICT', message, { details, expose: true })
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Muitas tentativas. Espere alguns minutos.') {
    super(429, 'RATE_LIMITED', message, { expose: true })
  }
}

export class BadGatewayError extends AppError {
  constructor(message = 'Falha ao comunicar com serviço externo.', cause?: unknown) {
    super(502, 'BAD_GATEWAY', message, { expose: true, cause })
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Dependência indisponível no momento.', cause?: unknown) {
    super(503, 'SERVICE_UNAVAILABLE', message, { expose: true, cause })
  }
}

export class PersistenceError extends AppError {
  constructor(
    message = 'Não foi possível gravar os dados no banco. A versão anterior continua valendo.',
    cause?: unknown,
  ) {
    super(503, 'PERSISTENCE_ERROR', message, { expose: true, cause })
  }
}

export function errorPayload(
  code: string,
  message: string,
  options?: { details?: ErrorDetails; requestId?: string },
) {
  return {
    error: {
      code,
      message,
      ...(options?.details !== undefined ? { details: options.details } : {}),
      ...(options?.requestId ? { requestId: options.requestId } : {}),
    },
  }
}
