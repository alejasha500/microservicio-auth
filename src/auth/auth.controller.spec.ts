
import { jest } from '@jest/globals';

jest.unstable_mockModule('@nestjs/throttler', () => ({
  Throttle: () => () => {},
}));

const { Test } = await import('@nestjs/testing');
const { AuthController } = await import('./auth.controller.js');
const { AuthService } = await import('./auth.service.js');

type AsyncFn = (...args: any[]) => Promise<any>;

describe('AuthController', () => {
  let controller: InstanceType<typeof AuthController>;

  const authServiceMock = {
    register: jest.fn<AsyncFn>(),
    login: jest.fn<AsyncFn>(),
    refresh: jest.fn<AsyncFn>(),
    logout: jest.fn<AsyncFn>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call AuthService.register with the received data', async () => {
      const data = {
        email: 'valentina@gmail.com',
        password: 'Password123',
        name: 'Valentina',
      };

      const expectedResult = {
        user: { id: 1, email: data.email },
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      };

      authServiceMock.register.mockResolvedValue(expectedResult);

      const result = await controller.register(data);

      expect(authServiceMock.register).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should call AuthService.login with the received data', async () => {
      const data = {
        email: 'valentina@gmail.com',
        password: 'Password123',
      };

      const expectedResult = {
        user: { id: 1, email: data.email },
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      };

      authServiceMock.login.mockResolvedValue(expectedResult);

      const result = await controller.login(data);

      expect(authServiceMock.login).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('refresh', () => {
    it('should call AuthService.refresh with the received data', async () => {
      const data = {
        refreshToken: 'fake-refresh-token',
      };

      const expectedResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      authServiceMock.refresh.mockResolvedValue(expectedResult);

      const result = await controller.refresh(data);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('logout', () => {
    it('should call AuthService.logout with the received data', async () => {
      const data = {
        refreshToken: 'fake-refresh-token',
      };

      const expectedResult = {
        message: 'Sesión cerrada correctamente',
      };

      authServiceMock.logout.mockResolvedValue(expectedResult);

      const result = await controller.logout(data);

      expect(authServiceMock.logout).toHaveBeenCalledWith(data);
      expect(result).toEqual(expectedResult);
    });
  });

  it('should propagate errors thrown by AuthService', async () => {
    const data = {
      refreshToken: 'fake-refresh-token',
    };

    authServiceMock.logout.mockRejectedValue(
      new Error('Database error'),
    );

    await expect(controller.logout(data)).rejects.toThrow(
      'Database error',
    );
  });
});
