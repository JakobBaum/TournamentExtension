const esbuild = require("esbuild");

async function build() {
  await esbuild.build({
    entryPoints: ["./src/TournamentDB.js"],
    bundle: true,
    outfile: "./dist/TournamentDB.bundle.js",
    format: "iife",
    globalName: "TournamentDBBundle",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
  });

  await esbuild.build({
    entryPoints: ["./src/Logik.js"],
    bundle: true,
    outfile: "./dist/Logik.bundle.js",
    format: "iife",
    globalName: "LogikBundle",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
  });

    await esbuild.build({
    entryPoints: ["./src/AutodartsApi.js"],
    bundle: true,
    outfile: "./dist/AutodartsApi.bundle.js",
    format: "iife",
    globalName: "AutodartsApiBundle",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
  });

  await esbuild.build({
    entryPoints: ["./src/tournament-entry.jsx"],
    bundle: true,
    outfile: "./dist/tournament-app.bundle.js",
    format: "iife",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
  });

  await esbuild.build({
    entryPoints: ["./src/content-entry.jsx"],
    bundle: true,
    outfile: "./dist/content.bundle.js",
    format: "iife",
    loader: {
      ".js": "jsx",
      ".jsx": "jsx",
    },
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
