const fs = require("node:fs");
const path = require("node:path");

const SESSION_COUNT = 5;

function copyIfMissing(sourcePath, destinationPath) {
  if (fs.existsSync(destinationPath)) return false;
  fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
  return true;
}

function prepareQualificationPacket({
  sourceDirectory = path.resolve("client/src/babylon"),
  outputDirectory = path.resolve("artifacts/babylon-qualification")
} = {}) {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const files = [
    {
      source: "EXPERIENCE_GATE_TEMPLATE.json",
      destination: "experience-gate.json"
    },
    {
      source: "QUALIFICATION_RUNBOOK.md",
      destination: "README.md"
    },
    ...Array.from({ length: SESSION_COUNT }, (_, index) => ({
      source: "HUMAN_PLAYTEST_SESSION_TEMPLATE.md",
      destination: `playtest-session-${index + 1}.md`
    }))
  ];

  const results = files.map(({ source, destination }) => {
    const sourcePath = path.join(sourceDirectory, source);
    const destinationPath = path.join(outputDirectory, destination);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Qualification source file is missing: ${sourcePath}`);
    }
    return {
      file: destination,
      created: copyIfMissing(sourcePath, destinationPath)
    };
  });

  return { outputDirectory, results };
}

function runCli() {
  const packet = prepareQualificationPacket();
  console.log(`Babylon qualification packet: ${packet.outputDirectory}`);
  packet.results.forEach(({ file, created }) => {
    console.log(`- ${created ? "created" : "preserved"}: ${file}`);
  });
}

if (require.main === module) runCli();

module.exports = {
  prepareQualificationPacket,
  SESSION_COUNT
};
