import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { TransformInterceptor, ResponseFormat } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new TransformInterceptor(reflector);
  });

  it('should transform response with explicit @ResponseMessage decorator', async () => {
    const mockHandler = {
      handle: () => of({ userId: '123' }),
    } as CallHandler;

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST' }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue('Custom success message');

    const result: ResponseFormat<unknown> = await firstValueFrom(
      interceptor.intercept(mockContext, mockHandler),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Custom success message');
    expect(result.data).toEqual({ userId: '123' });
    expect(typeof result.timestamp).toBe('string');
  });

  it('should extract message property from returned data object if present', async () => {
    const mockHandler = {
      handle: () => of({ message: 'Data level message', id: 456 }),
    } as CallHandler;

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method: 'POST' }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const result: ResponseFormat<unknown> = await firstValueFrom(
      interceptor.intercept(mockContext, mockHandler),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Data level message');
    expect(result.data).toEqual({ message: 'Data level message', id: 456 });
    expect(typeof result.timestamp).toBe('string');
  });

  it('should fall back to HTTP method default message when no decorator or data message exists', async () => {
    const mockHandler = {
      handle: () => of([{ id: 1 }, { id: 2 }]),
    } as CallHandler;

    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET' }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const result: ResponseFormat<unknown> = await firstValueFrom(
      interceptor.intercept(mockContext, mockHandler),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('Data retrieved successfully');
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(typeof result.timestamp).toBe('string');
  });
});
