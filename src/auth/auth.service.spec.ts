import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type AsyncFn = (...args: any[]) => Promise<any>;

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findUnique: jest.fn<AsyncFn>(),
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
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register a new user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 1,
      name: 'Valentina',
      email: 'valentina@gmail.com',
      role: 'USER',
      createdAt: new Date(),
    });
    jwtMock.signAsync.mockResolvedValue('fake-access-token');

    const result = await service.register({
      email: 'valentina@gmail.com',
      password: '12345678',
      name: 'Valentina',
    });

    expect(result).toEqual({
      user: {
        id: 1,
        name: 'Valentina',
        email: 'valentina@gmail.com',
        role: 'USER',
        createdAt: expect.any(Date),
      },
      token: 'fake-access-token',
    });
  });

  it('should throw ConflictException if email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'valentina@gmail.com',
    });

    await expect(
      service.register({
        email: 'valentina@gmail.com',
        password: '12345678',
        name: 'Valentina',
      }),
    ).rejects.toThrow('el correo ya esta registrado');
  });
});