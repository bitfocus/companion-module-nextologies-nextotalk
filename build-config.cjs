// Extra webpack/packaging config picked up by companion-module-build.
module.exports = {
	// The bundled Arimo Bold font (embedded via src/generated/render-assets.ts) is SIL OFL 1.1,
	// which requires its license to travel with redistributed copies.
	extraFiles: ['assets/fonts/OFL.txt'],
}
