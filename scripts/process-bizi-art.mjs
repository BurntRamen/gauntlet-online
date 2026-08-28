import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const generationRoot = process.argv[2] ? path.resolve(process.argv[2]) : "";

if (!generationRoot) {
  throw new Error("Usage: node scripts/process-bizi-art.mjs <retained-generation-master-directory>");
}

const assets = [
  ["exec-88fcde71-6422-4145-885e-4f0e5d767834.png", "client/public/assets/gauntlet/factions/bizi/focus-conductor-of-progress.webp", 1024, 1280],
  ["exec-fa8f4c4a-4578-42b5-ad9c-89287d3dccb8.png", "client/public/assets/gauntlet/factions/bizi/hera-general.webp", 1024, 1280],
  ["exec-88d01eba-bbcc-48d7-90b7-56a5010116dc.png", "client/public/assets/gauntlet/factions/bizi/constanti-technology-hub.webp", 1600, 900],

  ["exec-aed8bc35-588d-44d6-9f4e-dae2d2324e03.png", "client/public/assets/gauntlet/constructed/bizi/bizi-copperline-technician.webp", 1024, 1280],
  ["exec-704582eb-b296-4694-901e-463bbe9fb2eb.png", "client/public/assets/gauntlet/constructed/bizi/bizi-voltage-ration.webp", 1024, 1280],
  ["exec-060388fe-847e-4e99-82cd-e6abd6311a81.png", "client/public/assets/gauntlet/constructed/bizi/bizi-dune-circuit-runner.webp", 1024, 1280],
  ["exec-0086440d-80f2-4879-a083-2ee6ea7b7320.png", "client/public/assets/gauntlet/constructed/bizi/bizi-gearplate-shield.webp", 1024, 1280],
  ["exec-014261ea-6c3e-4d72-8752-a4fc91ccfd16.png", "client/public/assets/gauntlet/constructed/bizi/bizi-heras-calibration.webp", 1024, 1280],
  ["exec-6faec277-3150-427f-876a-97d9d351882b.png", "client/public/assets/gauntlet/constructed/bizi/bizi-solar-array-adept.webp", 1024, 1280],
  ["exec-6d431bcf-1266-40e1-b971-6c859107c0fa.png", "client/public/assets/gauntlet/constructed/bizi/bizi-constanti-conduit.webp", 1024, 1280],
  ["exec-f2a43929-9e77-4e86-bf9d-382ffdc20924.png", "client/public/assets/gauntlet/constructed/bizi/bizi-sandstorm-processor.webp", 1024, 1280],
  ["exec-1c382db9-f02f-48e3-9002-776d829ba8cc.png", "client/public/assets/gauntlet/constructed/bizi/bizi-focus-overclock.webp", 1024, 1280],
  ["exec-3945cf5b-28bf-4909-b1b7-e4a4ef49e12e.png", "client/public/assets/gauntlet/constructed/bizi/bizi-regnum-voltage-bank.webp", 1024, 1280],
  ["exec-c4e6bd58-33be-42a4-982f-113d9f30d8f5.png", "client/public/assets/gauntlet/constructed/bizi/bizi-desert-logic-engine.webp", 1024, 1280],
  ["exec-d0c2b0e6-d203-47cc-a4db-e9e3b5be7351.png", "client/public/assets/gauntlet/constructed/bizi/bizi-brass-spark.webp", 1024, 1280],
  ["exec-79fb5af9-6018-4133-92ca-b4b497e861ea.png", "client/public/assets/gauntlet/constructed/bizi/bizi-railspike-marshal.webp", 1024, 1280],
  ["exec-2997106c-7d12-4e4a-816b-d8377030547b.png", "client/public/assets/gauntlet/constructed/bizi/bizi-heat-sink-matrix.webp", 1024, 1280],
  ["exec-71949f43-b741-410c-8c95-b93dda01cbe5.png", "client/public/assets/gauntlet/constructed/bizi/bizi-clockwork-caravan.webp", 1024, 1280],
  ["exec-ae1d0b78-4748-4faf-b3b9-d3847df01b17.png", "client/public/assets/gauntlet/constructed/bizi/bizi-voltaric-ultimatum.webp", 1024, 1280],
  ["exec-2dfe3216-9165-4d0d-8e92-db1d94b1e78c.png", "client/public/assets/gauntlet/constructed/bizi/bizi-focus-prime-signal.webp", 1024, 1280],
  ["exec-84f3d36b-44a4-4821-8da9-f1f4ef5401bf.png", "client/public/assets/gauntlet/constructed/bizi/bizi-constanti-sunforge.webp", 1024, 1280],

  ["exec-a96fda8e-0a82-499b-9289-8a765dfabaff.png", "client/public/assets/gauntlet/campaigns/bizi/01-kharons-vision.webp", 1600, 900],
  ["exec-b2c9bb22-cb9b-4a13-979f-94e6c322496b.png", "client/public/assets/gauntlet/campaigns/bizi/02-first-titan.webp", 1600, 900],
  ["exec-10d9053c-f257-46d4-88d1-ccffdd04dedc.png", "client/public/assets/gauntlet/campaigns/bizi/03-golden-empire.webp", 1600, 900],
  ["exec-31f90731-7f29-456c-b0e5-1ab47e75738c.png", "client/public/assets/gauntlet/campaigns/bizi/04-riot-of-sparks.webp", 1600, 900],
  ["exec-10052797-38e6-4d4d-a969-c39afa68de4d.png", "client/public/assets/gauntlet/campaigns/bizi/05-last-victories.webp", 1600, 900],
  ["exec-c7fb69f4-7872-45a9-8a42-9a9ac60720bb.png", "client/public/assets/gauntlet/campaigns/bizi/06-age-of-focus.webp", 1600, 900],
  ["exec-c0355d10-4914-4088-9a27-8a2286e62604.png", "client/public/assets/gauntlet/campaigns/bizi/07-great-invasion.webp", 1600, 900],
  ["exec-e48b3ba3-abf1-43ec-a686-b6d7c34382aa.png", "client/public/assets/gauntlet/campaigns/bizi/08-heras-counterattack.webp", 1600, 900],
  ["exec-0de20c33-3265-4012-9ada-eba00d9bf960.png", "client/public/assets/gauntlet/campaigns/bizi/09-three-titans.webp", 1600, 900],
  ["exec-55550930-40ad-4e42-a7d1-ad7be2edb5de.png", "client/public/assets/gauntlet/campaigns/bizi/10-the-schism.webp", 1600, 900],
  ["exec-31091185-da9c-4ce5-b43a-da599f1f252d.png", "client/public/assets/gauntlet/campaigns/bizi/11-the-restoration.webp", 1600, 900],
  ["exec-d8b29f41-2af1-4eb1-8ddf-b4e318ef84b4.png", "client/public/assets/gauntlet/campaigns/bizi/12-last-gear.webp", 1600, 900],
];

const results = [];

for (const [sourceName, destination, width, height] of assets) {
  const sourcePath = path.join(generationRoot, sourceName);
  const destinationPath = path.resolve(destination);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  const info = await sharp(sourcePath)
    .resize({ width, height, fit: "cover", position: "centre" })
    .webp({ quality: 86, effort: 6 })
    .toFile(destinationPath);

  results.push({ sourceName, destination, width: info.width, height: info.height, bytes: info.size });
}

console.log(JSON.stringify({ count: results.length, results }, null, 2));
