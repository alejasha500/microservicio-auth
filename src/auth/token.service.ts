import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { randomBytes, createHash } from 'node:crypto';
import { Role } from '../../generated/prisma/client.js';

@Injectable()
export class TokenService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) {}

    async generateTokens(userId: number, role: Role) {

        const accessToken = await this.jwtService.signAsync({
            sub: userId,
            role: role,
        });

        const refreshToken = randomBytes(32).toString('hex');

        const refreshTokenHash = createHash('sha256')
            .update(refreshToken)
            .digest('hex');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.refreshToken.create({
            data: {
                tokenHash: refreshTokenHash,
                expiresAt: expiresAt,
                userId: userId,
            },
        });

        return {
            accessToken,
            refreshToken,
        };
    }
}