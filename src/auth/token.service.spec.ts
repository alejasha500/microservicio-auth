
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createHash } from 'node:crypto';

type AsyncFn = (...args: any[]) => Promise<any>;

describe('TokenService', () => {
  let service: TokenService;

  const prismaMock = {
    refreshToken: {
      create: jest.fn<AsyncFn>(),
    },
  };

  const jwtMock = {
    signAsync: jest.fn<AsyncFn>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTokens', () => {
    it('should generate an access token using JWT', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      await service.generateTokens(1, 'USER');

      expect(jwtMock.signAsync).toHaveBeenCalledWith({
        sub: 1,
        role: 'USER',
      });
    });

    it('should generate a refresh token with 64 hexadecimal characters', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(1, 'USER');

      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should save the SHA-256 hash instead of the original refresh token', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(1, 'USER');

      const expectedHash = createHash('sha256')
        .update(result.refreshToken)
        .digest('hex');

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: expectedHash,
        }),
      });

      expect(prismaMock.refreshToken.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenHash: result.refreshToken,
          }),
        }),
      );
    });

    it('should set the refresh token expiration to seven days', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      const before = new Date();

      await service.generateTokens(1, 'USER');

      const after = new Date();

      const savedData = prismaMock.refreshToken.create.mock.calls[0][0] as {
        data: {
          expiresAt: Date;
        };
      };

      const expectedMin = new Date(before);
      expectedMin.setDate(expectedMin.getDate() + 7);

      const expectedMax = new Date(after);
      expectedMax.setDate(expectedMax.getDate() + 7);

      expect(savedData.data.expiresAt.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );

      expect(savedData.data.expiresAt.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });

    it('should save the refresh token associated with the correct user', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      await service.generateTokens(25, 'ADMIN');

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 25,
        }),
      });
    });

    it('should return both access and refresh tokens', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockResolvedValue({});

      const result = await service.generateTokens(1, 'USER');

      expect(result).toEqual({
        accessToken: 'fake-access-token',
        refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
    });

    it('should propagate an error if saving the refresh token fails', async () => {
      jwtMock.signAsync.mockResolvedValue('fake-access-token');
      prismaMock.refreshToken.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.generateTokens(1, 'USER')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
