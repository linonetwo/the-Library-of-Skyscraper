import { z } from 'zod';

export const mapActionSchemas = [
  z.object({ type: z.literal('panMap'), dx: z.number(), dy: z.number() }).strict(),
  z.object({ type: z.literal('overviewMap') }).strict(),
  z.object({ type: z.literal('selectRoom'), room: z.enum(['room-0', 'room-1', 'room-2', 'room-3', 'room-4', 'room-5', 'room-6']) }).strict(),
  ...['moveToRoom', 'buildTower', 'buildCatalog'].map(type => z.object({ type: z.literal(type) }).strict()),
];

export function readMapState(page) {
  return page.locator('.pixi-map').evaluateAll(maps => maps.map(map => ({
    camera: JSON.parse(map.dataset.camera || 'null'),
    viewport: { width: map.clientWidth, height: map.clientHeight },
    roomTargets: JSON.parse(map.dataset.roomTargets || '[]'),
  })));
}

export async function performMapAction(page, action) {
  const map = page.locator('.pixi-map').first();
  switch (action.type) {
    case 'overviewMap': await map.getByRole('button', { name: '全图总览', exact: true }).click(); break;
    case 'panMap': {
      const box = await map.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + action.dx, box.y + box.height / 2 + action.dy, { steps: 8 });
      await page.mouse.up();
      break;
    }
    case 'selectRoom': {
      const close = page.getByRole('button', { name: '关闭角色面板', exact: true });
      if (await close.isVisible()) await close.click();
      await map.getByRole('button', { name: '全图总览', exact: true }).click();
      const point = await map.evaluate((element, room) => {
        const target = JSON.parse(element.dataset.roomTargets).find(target => target.id === room);
        const camera = JSON.parse(element.dataset.camera);
        return { x: camera.x + target.x * camera.scale, y: camera.y + target.y * camera.scale };
      }, action.room);
      await map.locator('canvas').click({ position: point });
      await page.locator('.room-popup').filter({ hasText: action.room }).waitFor();
      break;
    }
    case 'moveToRoom': await page.getByRole('button', { name: '派遣选中角色', exact: true }).click(); break;
    case 'buildTower': await page.getByRole('button', { name: '建造哨塔', exact: true }).click(); break;
    case 'buildCatalog': await page.getByRole('button', { name: '建造编目台', exact: true }).click(); break;
    default: return false;
  }
  return true;
}
