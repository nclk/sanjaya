using TypeSpec.Http;

namespace Models;

@doc("Legacy error response for not found resources")
@error
model NotFoundError {
  @statusCode _: 404;
  message: string;
  code?: string;
}

@doc("Legacy error response for bad requests")
@error
model BadRequestError {
  @statusCode _: 400;
  message: string;
  code?: string;
}

@doc("Legacy error response for internal server errors")
@error
model InternalServerError {
  @statusCode _: 500;
  message: string;
  code?: string;
}

@doc("Single structured error detail")
model ErrorDetail {
  error_type: string;
  message: string;
  field?: string;
  path?: unknown;
  location?: string;
}

@doc("Ninja schema validation error (django_shared custom_validation_error)")
@error
model ValidationErrorResponse {
  @statusCode _: 422;
  error: "validation_error";
  details: ErrorDetail[];
}

@doc("Custom error envelope (django_shared custom_exception_handler)")
@error
model CustomErrorResponse400 {
  @statusCode _: 400;
  error: "custom_error";
  details: ErrorDetail[];
}

@doc("Custom error envelope (django_shared custom_exception_handler)")
@error
model CustomErrorResponse404 {
  @statusCode _: 404;
  error: "custom_error";
  details: ErrorDetail[];
}

@doc("Custom error envelope (django_shared custom_exception_handler)")
@error
model CustomErrorResponse500 {
  @statusCode _: 500;
  error: "custom_error";
  details: ErrorDetail[];
}

@doc("Custom error envelope (django_shared custom_exception_handler)")
@error
model CustomErrorResponse501 {
  @statusCode _: 501;
  error: "custom_error";
  details: ErrorDetail[];
}

@doc("Permission denied error envelope (django_shared permission_denied_handler)")
@error
model PermissionErrorResponse {
  @statusCode _: 403;
  error: "permission_error";
  details: ErrorDetail[];
}
