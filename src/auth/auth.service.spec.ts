
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

type AsyncFn = (...args: any[]) => Promise<any>;

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: jest.fn<AsyncFn>(),
      create: jest.fn<AsyncFn>(),
    },
    refreshToken: {
      findFirst: jest.fn<AsyncFn>(),
      update: jest.fn<AsyncFn>(),
      updateMany: jest.fn<AsyncFn>(),
    },
  };

  const tokenServiceMock = {
    generateTokens: jest.fn<AsyncFn>(),
  };

  const fakeTokens = {
    accessToken: 'fake-access-token',
    refreshToken: 'fake-refresh-token',
  };

  const fakeUser = {
    id: 1,
    name: 'Valentina',
    email: 'valentina@gmail.com',
    password: 'fake-hashed-password',
    role: 'USER',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hashToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokenService, useValue: tokenServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // REGISTER

  describe('register', () => {
    it('should register a new user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      prismaMock.user.create.mockResolvedValue({
        id: 1,
        name: 'Valentina',
        email: 'valentina@gmail.com',
        role: 'USER',
        createdAt: new Date(),
      });

      tokenServiceMock.generateTokens.mockResolvedValue(fakeTokens);

      const result = await service.register({
        email: 'valentina@gmail.com',
        password: 'Password123',
        name: 'Valentina',
      });

      expect(prismaMock.user.create).toHaveBeenCalled();

      expect(tokenServiceMock.generateTokens).toHaveBeenCalledWith(1, 'USER');

      expect(result).toEqual({
        user: {
          id: 1,
          name: 'Valentina',
          email: 'valentina@gmail.com',
          role: 'USER',
          createdAt: expect.any(Date),
        },
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });
    });

    it('should hash the password before saving it', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      prismaMock.user.create.mockImplementation(async (args: any) => ({
        id: 1,
        name: args.data.name,
        email: args.data.email,
        role: 'USER',
        createdAt: new Date(),
      }));

      tokenServiceMock.generateTokens.mockResolvedValue(fakeTokens);

      await service.register({
        email: 'valentina@gmail.com',
        password: 'Password123',
        name: 'Valentina',
      });

      const createCall = prismaMock.user.create.mock.calls[0][0] as any;

      expect(createCall.data.password).not.toBe('Password123');

      expect(
        await bcrypt.compare('Password123', createCall.data.password),
      ).toBe(true);
    });

    it('should throw ConflictException if email already exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue(fakeUser);

      await expect(
        service.register({
          email: 'valentina@gmail.com',
          password: 'Password123',
          name: 'Valentina',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  // LOGIN

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);

      prismaMock.user.findUnique.mockResolvedValue({
        ...fakeUser,
        password: hashedPassword,
      });

      tokenServiceMock.generateTokens.mockResolvedValue(fakeTokens);

      const result = await service.login({
        email: 'valentina@gmail.com',
        password: 'Password123',
      });

      expect(tokenServiceMock.generateTokens).toHaveBeenCalledWith(1, 'USER');

      expect(result).toEqual({
        user: {
          id: 1,
          name: 'Valentina',
          email: 'valentina@gmail.com',
          role: 'USER',
          createdAt: expect.any(Date),
        },
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@gmail.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword123', 10);

      prismaMock.user.findUnique.mockResolvedValue({
        ...fakeUser,
        password: hashedPassword,
      });

      await expect(
        service.login({
          email: 'valentina@gmail.com',
          password: 'WrongPassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if account is inactive', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 10);

      prismaMock.user.findUnique.mockResolvedValue({
        ...fakeUser,
        password: hashedPassword,
        isActive: false,
      });

      await expect(
        service.login({
          email: 'valentina@gmail.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });
  });

  // REFRESH

  describe('refresh', () => {
    const refreshToken = 'valid-refresh-token';

    const storedToken = {
      id: 10,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      userId: 1,
      user: fakeUser,
    };

    it('should generate new tokens with a valid refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(storedToken);
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      tokenServiceMock.generateTokens.mockResolvedValue(fakeTokens);

      const result = await service.refresh({ refreshToken });

      expect(prismaMock.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: hashToken(refreshToken),
        },
        include: {
          user: true,
        },
      });

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          id: 10,
          revokedAt: null,
        },
        data: {
          revokedAt: expect.any(Date),
        },
      });

      expect(tokenServiceMock.generateTokens).toHaveBeenCalledWith(1, 'USER');

      expect(result).toEqual(fakeTokens);
    });

    it('should reject a refresh token that does not exist', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should reject a revoked refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(
        service.refresh({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should reject an expired refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 100000),
      });

      await expect(
        service.refresh({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should reject refresh if account is inactive', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        user: {
          ...fakeUser,
          isActive: false,
        },
      });

      await expect(
        service.refresh({ refreshToken }),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should reject if refresh token was already consumed', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(storedToken);
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.refresh({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(tokenServiceMock.generateTokens).not.toHaveBeenCalled();
    });
  });

  // LOGOUT

  describe('logout', () => {
    const refreshToken = 'valid-refresh-token';

    it('should revoke a valid refresh token', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 10,
        revokedAt: null,
      });

      prismaMock.refreshToken.update.mockResolvedValue({
        id: 10,
        revokedAt: new Date(),
      });

      const result = await service.logout({ refreshToken });

      expect(prismaMock.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          tokenHash: hashToken(refreshToken),
        },
      });

      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          revokedAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        message: 'Sesión cerrada correctamente',
      });
    });

    it('should reject if refresh token does not exist', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      await expect(
        service.logout({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.update).not.toHaveBeenCalled();
    });

    it('should reject if refresh token was already revoked', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 10,
        revokedAt: new Date(),
      });

      await expect(
        service.logout({ refreshToken }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.update).not.toHaveBeenCalled();
    });
  });
});
