interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  statusCode: number;
}

export function successResponse<T>(
  data: T,
  message = 'Success',
  statusCode = 200,
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    statusCode,
  };
}

export function errorResponse(
  error: string,
  statusCode = 400,
): ApiResponse<null> {
  return {
    success: false,
    error,
    statusCode,
  };
}
