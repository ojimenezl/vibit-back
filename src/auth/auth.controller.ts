import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { GoogleTokenDto } from './dto/google-token.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayloadUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Página GIS en navegador real (Custom Tab). Evita Credential Manager [16] en Android.
   * La app abre esta URL y espera el deep link vibit://google-auth?id_token=...
   */
  @Get('google/mobile')
  @Header('Cache-Control', 'no-store')
  googleMobilePage(@Query('state') state: string | undefined, @Res() res: Response) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
    const safeState = String(state || '')
      .slice(0, 128)
      .replace(/[^a-zA-Z0-9._-]/g, '');

    if (!clientId) {
      res
        .status(500)
        .type('html')
        .send(
          '<!doctype html><html><body style="font-family:system-ui;background:#0d0d0d;color:#fff;padding:2rem"><p>GOOGLE_CLIENT_ID no configurado.</p></body></html>',
        );
      return;
    }

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vibit · Google</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#fff;font-family:system-ui,sans-serif;padding:1.25rem}
    .card{width:min(100%,340px);border:2px solid #000;border-radius:18px;background:#1a1a1a;padding:1.25rem;box-shadow:6px 6px 0 #ffc900;text-align:center}
    h1{margin:0 0 .35rem;font-size:1.2rem;letter-spacing:-.02em}
    p{margin:0 0 1rem;color:#a3a3a3;font-size:.92rem;line-height:1.35}
    #btn{display:flex;justify-content:center;min-height:44px}
    .err{color:#ff90e8;font-weight:700;margin-top:.85rem;font-size:.88rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>Continuar con Google</h1>
    <p>Elige tu cuenta para entrar o vincular Vibit</p>
    <div id="btn"></div>
    <p id="err" class="err" hidden></p>
  </div>
  <script>
    var CLIENT_ID = ${JSON.stringify(clientId)};
    var STATE = ${JSON.stringify(safeState)};
    function showErr(msg) {
      var el = document.getElementById('err');
      el.hidden = false;
      el.textContent = msg;
    }
    function goApp(idToken) {
      var url = 'vibit://google-auth?id_token=' + encodeURIComponent(idToken) +
        '&state=' + encodeURIComponent(STATE);
      window.location.href = url;
      setTimeout(function () {
        showErr('Si no vuelve a Vibit, cierra esta pestaña y ábrela desde la app.');
      }, 1200);
    }
    function boot() {
      if (!window.google || !google.accounts || !google.accounts.id) {
        showErr('No se pudo cargar Google. Revisa la conexión.');
        return;
      }
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: function (res) {
          if (res && res.credential) goApp(res.credential);
          else showErr('No se obtuvo el token de Google');
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      google.accounts.id.renderButton(document.getElementById('btn'), {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280
      });
    }
    window.addEventListener('load', function () {
      if (window.google && google.accounts) boot();
      else {
        var n = 0;
        var t = setInterval(function () {
          n++;
          if (window.google && google.accounts) { clearInterval(t); boot(); }
          else if (n > 40) { clearInterval(t); showErr('Google Identity no cargó.'); }
        }, 100);
      }
    });
  </script>
</body>
</html>`;

    res.status(200).type('html').send(html);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: GoogleTokenDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Post('google/link')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  linkGoogle(@CurrentUser() user: JwtPayloadUser, @Body() dto: GoogleTokenDto) {
    return this.authService.linkGoogle(user.userId, dto.idToken);
  }

  @Post('verify-pin')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  verifyPin(@CurrentUser() user: JwtPayloadUser, @Body() dto: VerifyPinDto) {
    return this.authService.verifyPin(user.userId, dto.pin);
  }

  @Post('change-pin')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  changePin(@CurrentUser() user: JwtPayloadUser, @Body() dto: ChangePinDto) {
    return this.authService.changePin(user.userId, dto);
  }
}
