import { io, Socket } from 'socket.io-client';
import { CampusGateway } from '../src/realtime/campus.gateway';
import { createTestApp, TestCtx } from './app';

let ctx: TestCtx;
let url: string;
const sockets: Socket[] = [];

function connect(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, { path: '/socket.io', transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });
}
const emit = <T = Record<string, unknown>>(s: Socket, ev: string, body: unknown) => s.timeout(5000).emitWithAck(ev, body) as Promise<T>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function collect(s: Socket, ev: string) {
  const got: unknown[] = [];
  s.on(ev, (d) => got.push(d));
  return got;
}

beforeAll(async () => {
  ctx = await createTestApp();
  await ctx.app.listen(0);
  const addr = ctx.app.getHttpServer().address();
  url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  ctx.app.get(CampusGateway).graceMs = 300;
});
afterEach(() => {
  for (const s of sockets.splice(0)) s.disconnect();
});
afterAll(async () => {
  await ctx.app.close();
});

describe('Campus realtime', () => {
  it('rejects sockets without a session cookie', async () => {
    await expect(connect()).rejects.toThrow(/unauthorized/);
    await expect(connect('tj_session=garbage')).rejects.toThrow(/unauthorized/);
  });

  it('joins the courtyard and sees classmates arrive and move', async () => {
    const lea = await connect(await ctx.as('lea'));
    const karim = await connect(await ctx.as('karim'));
    const joined = collect(lea, 'player:joined');
    const moved = collect(lea, 'player:moved');
    const a = await emit<{ ok: boolean; snapshot: { map: string; players: unknown[] } }>(lea, 'room:join', { room: 'campus' });
    expect(a.ok).toBe(true);
    expect(a.snapshot.map).toBe('campus');
    const b = await emit<{ ok: boolean; snapshot: { players: { name: string }[] } }>(karim, 'room:join', { room: 'campus' });
    expect(b.snapshot.players.map((p) => p.name)).toContain('Lea');
    karim.emit('move', { room: 'campus', x: 99999, y: 500, dir: 'right', moving: true });
    await wait(150);
    expect(joined).toHaveLength(1);
    expect(moved).toHaveLength(1);
    // positions are clamped by the server
    expect((moved[0] as { x: number }).x).toBeLessThan(1600);
  });

  it('a second tab closing does not remove the player (per-socket presence)', async () => {
    const cookie = await ctx.as('karim');
    const lea = await connect(await ctx.as('lea'));
    await emit(lea, 'room:join', { room: 'campus' });
    const left = collect(lea, 'player:left');
    const tab1 = await connect(cookie);
    const tab2 = await connect(cookie);
    await emit(tab1, 'room:join', { room: 'campus' });
    await emit(tab2, 'room:join', { room: 'campus' });
    tab1.disconnect();
    await wait(600); // longer than the grace period
    expect(left).toHaveLength(0);
    tab2.disconnect();
    await wait(600);
    expect(left).toHaveLength(1);
  });

  it('a quick reconnect within the grace period is invisible to others', async () => {
    const cookie = await ctx.as('omar');
    const lea = await connect(await ctx.as('lea'));
    await emit(lea, 'room:join', { room: 'campus' });
    const left = collect(lea, 'player:left');
    const joined = collect(lea, 'player:joined');
    const s1 = await connect(cookie);
    await emit(s1, 'room:join', { room: 'campus' });
    s1.disconnect();
    await wait(50);
    const s2 = await connect(cookie);
    await emit(s2, 'room:join', { room: 'campus' });
    await wait(600);
    expect(left).toHaveLength(0);
    expect(joined).toHaveLength(1);
  });

  it('parents cannot enter the school courtyard; teachers can', async () => {
    const mona = await connect(await ctx.as('mona'));
    expect(await emit(mona, 'room:join', { room: 'campus' })).toEqual({ ok: false, error: 'forbidden' });
    const rana = await connect(await ctx.as('rana'));
    expect(await emit(rana, 'room:join', { room: 'campus' })).toMatchObject({ ok: true });
  });

  it('logout drops the user\'s sockets', async () => {
    const cookie = await ctx.as('omar');
    const s = await connect(cookie);
    const closed = new Promise((r) => s.on('disconnect', r));
    await ctx.http().post('/auth/logout').set('Cookie', cookie).expect(201);
    await closed;
    expect(s.connected).toBe(false);
  });

  it('rejects unknown or forbidden rooms', async () => {
    const lea = await connect(await ctx.as('lea'));
    expect(await emit(lea, 'room:join', { room: 'admin:1' })).toEqual({ ok: false, error: 'forbidden' });
    expect(await emit(lea, 'room:join', { room: 'study:nope' })).toEqual({ ok: false, error: 'forbidden' });
    expect(await emit(lea, 'room:join', { room: 'exam:nope' })).toEqual({ ok: false, error: 'forbidden' });
  });

  it('serves ICE servers to signed-in users', async () => {
    const r = await ctx.http().get('/realtime/ice').set('Cookie', await ctx.as('lea'));
    expect(r.status).toBe(200);
    expect(r.body.iceServers[0].urls).toBeDefined();
  });
});
