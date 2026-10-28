import { Injectable, ConflictException, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import {PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto.js';
import * as bcrypt from 'bcrypt';
import { TokenService  } from './token.service.js';
import { createHash } from 'node:crypto';



@Injectable()
export class AuthService {

      private readonly logger = new Logger(AuthService.name)
      
      constructor(
           private readonly prisma: PrismaService,
           private readonly tokenService: TokenService,
      ) {}

      private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
    }

     async register(data: RegisterDto) {
           const existingUser = await this.prisma.user.findUnique({
                where: {
                    email: data.email,
                }
           })

           if (existingUser){
                this.logger.warn(`Intento de registro con email existente: ${data.email}`);
                throw new ConflictException('el correo ya esta registrado')
           }

           const hashedPassword = await bcrypt.hash(data.password, 10);

           const user = await this.prisma.user.create({
               data: {
                     email: data.email,
                     password: hashedPassword,
                     name: data.name
               },
               select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    createdAt: true
               }
           });



           const tokens = await this.tokenService.generateTokens(
                        user.id,
                        user.role,
                            );



             this.logger.log(`Usuario registrado correctamente: ${user.email}`);
           return  {
                user: user,
               ...tokens,
           };
           
     }




     async login (data: LoginDto) {

           const { email, password } = data 

            this.logger.log(`Intento de login: ${email}`);
           
           const user = await this.prisma.user.findUnique({
                where: { email}
           })


           if(!user){
                this.logger.warn(`Login fallido: usuario no encontrado - ${email}`);
                 throw new UnauthorizedException('Credenciales invalidas');
           }


           const isValid = await bcrypt.compare(password, user.password)

           if (!isValid){
                 this.logger.warn(`Login fallido: contraseña incorrecta - ${email}`);
                 throw new UnauthorizedException('Credenciales invalidas');
           }

            if (!user.isActive) {
                this.logger.warn(`Login rechazado: cuenta inactiva - ${email}`)
  throw new ForbiddenException('Cuenta inactiva');
}

           const tokens =   await this.tokenService.generateTokens(
                                   user.id,
                                   user.role,
                            );

       
   this.logger.log(`Login exitoso: ${email}`);

           return {
                     user: {
                     id: user.id,
                      name: user.name,
                      email: user.email,
                      role: user.role,
                      createdAt: user.createdAt,
                       },
                       ...tokens,
                      };

     }

     

   async refresh(data: RefreshTokenDto) {
    const { refreshToken } = data;

    // 1. Convertimos el refresh token recibido a SHA-256
    const refreshTokenHash = this.hashToken(refreshToken);

    // 2. Buscamos el refresh token en la base de datos
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
      },
      include: {
        user: true,
      },
    });

    // 3. El token no existe
    if (!storedToken) {
      this.logger.warn('Refresh fallido: token no encontrado',);

      throw new UnauthorizedException(
        'Refresh token invalido',
      );
    }

    // 4. Comprobar si fue revocado
    if (storedToken.revokedAt) {
      this.logger.warn( `Refresh fallido: token revocado (${storedToken.id})`,);

      throw new UnauthorizedException(
        'Refresh token invalido',
      );
    }

    // 5. Comprobar si expiró
    if (storedToken.expiresAt <= new Date()) {
      this.logger.warn(`Refresh fallido: token expirado (${storedToken.id})`,);

      throw new UnauthorizedException('Refresh token invalido',);

    }

    // 6. Comprobar si la cuenta sigue activa
    if (!storedToken.user.isActive) {
      this.logger.warn(
        `Refresh rechazado: cuenta inactiva (${storedToken.user.id})`,
      );

      throw new ForbiddenException(
        'Cuenta inactiva',
      );
    }

    // 7. Revocar de forma atómica.
    // Solo una petición puede consumir este refresh token.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (count === 0) {
      this.logger.warn(
        `Refresh fallido: token ya consumido (${storedToken.id})`,
      );

      throw new UnauthorizedException(
        'Refresh token invalido',
      );
    }

    // 8. Generar nuevos tokens
    const tokens = await this.tokenService.generateTokens(
      storedToken.user.id,
      storedToken.user.role,
    );

    return tokens;
  }


 async logout(data: RefreshTokenDto) {
    const { refreshToken } = data;

    const refreshTokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: refreshTokenHash,
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Refresh token invalido',
      );
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token ya revocado',
      );
    }

    await this.prisma.refreshToken.update({
      where: {
        id: storedToken.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    this.logger.log(
      `Logout exitoso para refresh token ${storedToken.id}`,
    );

    return {
      message: 'Sesión cerrada correctamente',
    };
  }
};


