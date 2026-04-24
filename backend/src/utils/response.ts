import { FastifyReply } from 'fastify';
import type { ApiResponse } from '../types/index.js';

export const sendSuccess = <T>(
  reply: FastifyReply,
  data: T,
  message = 'Success',
  statusCode = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  return reply.code(statusCode).send(response);
};

export const sendError = (
  reply: FastifyReply,
  message: string,
  statusCode = 400,
  error?: string
) => {
  const response: ApiResponse = {
    success: false,
    message,
    error,
  };
  return reply.code(statusCode).send(response);
};

export const sendNotFound = (reply: FastifyReply, message = 'Resource not found') => {
  return sendError(reply, message, 404);
};

export const sendUnauthorized = (reply: FastifyReply, message = 'Unauthorized') => {
  return sendError(reply, message, 401);
};

export const sendForbidden = (reply: FastifyReply, message = 'Forbidden') => {
  return sendError(reply, message, 403);
};

export const sendInternalError = (
  reply: FastifyReply,
  message = 'Internal server error',
  error?: string
) => {
  return sendError(reply, message, 500, error);
};