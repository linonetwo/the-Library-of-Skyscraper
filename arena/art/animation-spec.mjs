export const directions = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
export const layers = ['body', 'outfit-scholar', 'outfit-warden', 'hair-ivory', 'hair-midnight', 'weapon-staff'];
export const modules = {
  idle: { frames: 4, fps: 4, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  run: { frames: 6, fps: 12, loop: true },
  jump: { frames: 6, fps: 10, loop: false },
  climb: { frames: 6, fps: 8, loop: true },
  'weapon-staff': { frames: 8, fps: 12, loop: false },
};
export const frameName = (action, layer, direction, index) =>
  `${action}/${layer}/${direction}/${String(index).padStart(2, '0')}`;
