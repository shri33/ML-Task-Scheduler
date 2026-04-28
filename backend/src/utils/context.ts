import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getRequestId = (): string | undefined => {
  return requestContext.getStore()?.requestId;
};

export const getUserId = (): string | undefined => {
  return requestContext.getStore()?.userId;
};
