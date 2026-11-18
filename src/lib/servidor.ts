// Las dependencias reales (tu config, tu almacén, tu Google, tus correos). Solo servidor.
import 'server-only';
import { config } from './config';
import { almacen } from './almacen';
import { googleDeEntorno } from './google';
import { enviarCorreo } from './correo';
import { correoAvisos, secreto, urlBase } from './entorno';
import type { Deps } from './agenda';

export function deps(): Deps {
  return { cfg: config, alm: almacen(), google: googleDeEntorno(), enviar: enviarCorreo, secreto: secreto(), base: urlBase(), avisos: correoAvisos() };
}
