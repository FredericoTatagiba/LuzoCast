import { describe, expect, it } from 'vitest';
import { FixService } from '../fixes/FixService';
import { AudioServiceCheck, WindowsMediaCheck } from './audioChecks';

describe('verificações de áudio', () => {
  it('Windows N sem mfplat.dll → falha com botão de instalar', async () => {
    const r = await new WindowsMediaCheck(() => false, 'C:\\Windows').run();
    expect(r.status).toBe('fail');
    expect(r.action?.id).toBe('install-media-pack');
    expect((await new WindowsMediaCheck(() => true).run()).status).toBe('ok');
  });

  it('Audiosrv parado → falha; rodando (inclusive em pt-BR) → ok', async () => {
    const pt = 'NOME_DO_SERVIÇO: Audiosrv\n        ESTADO             : 4  RUNNING\n';
    expect((await new AudioServiceCheck(async () => pt).run()).status).toBe('ok');
    const stopped = await new AudioServiceCheck(async () => 'STATE : 1  STOPPED').run();
    expect(stopped.status).toBe('fail');
    expect(stopped.action?.id).toBe('start-audio-service');
  });
});

describe('FixService', () => {
  it('traduz exit codes do DISM', async () => {
    const svc = (code: number) => new FixService(async () => code, async () => {});
    expect((await svc(0).run('install-media-pack')).ok).toBe(true);
    expect((await svc(3010).run('install-media-pack')).message).toContain('Reinicie o computador');
    expect((await svc(-1).run('install-media-pack')).message).toContain('negada');
    expect((await svc(87).run('install-media-pack')).ok).toBe(false);
  });

  it('abre as configurações de som sem elevar', async () => {
    let opened = '';
    const r = await new FixService(async () => { throw new Error('não deveria elevar'); }, async (u) => { opened = u; }).run('open-sound-settings');
    expect(r.ok).toBe(true);
    expect(opened).toBe('ms-settings:sound');
  });
});
