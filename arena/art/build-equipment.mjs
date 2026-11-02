import { buildEquipment } from './equipment-pipeline.mjs';
if (process.argv.length !== 4) {
  console.error('Usage: node build-equipment.mjs <reviewed-registration.json> <output-directory>');
  process.exitCode = 1;
} else {
  try {
    const result = await buildEquipment(process.argv[2], process.argv[3]);
    console.log(`Packed ${Object.keys(result.atlas.frames).length} prototype equipment frames; visual approval still required.`);
  } catch (error) {
    console.error(`Equipment build refused: ${error.message}`);
    process.exitCode = 1;
  }
}
