// Nazwa postaci/NPC pod stopami – widoczna tylko po najechaniu myszką.
import { Text } from 'pixi.js';

export function nameLabel(text: string, color = 0x8af59a): Text {
  const t = new Text({ text, style: { fontFamily: 'Jersey', fontSize: 8, fill: color, stroke: { color: 0x0a0706, width: 2 } } });
  t.resolution = 4;
  t.anchor.set(0.5, 0);
  t.position.set(0, 4);
  t.visible = false;
  return t;
}
