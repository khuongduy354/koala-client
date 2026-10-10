# Koala local client

Independent terminal client. Node.js 22+; ffplay (ffmpeg) for sound. No npm install or local Koala daemon needed.

Run from this folder:

```sh
./koala.mjs login <remote-host>
./koala.mjs --sound
./koala.mjs status
```

Uses existing Koala login profiles in ~/.koala/credentials.json.

Up/down moves focus; Space selects sound tracking; a selects all; n selects none; q exits. Choices save per server under ~/.koala/client-tracking/ (or KOALA_DIR/client-tracking).

Only selected active tasks confirmed waiting for input add continuous C-octave voices, starting C3 (130.8 Hz) through C10. Above eight waiting tasks the full C3–C10 stack stays on. Zero selected waiting tasks is silent. Overall peak stays at 25%; actual playback loudness depends on your device volume.

Source lives in src/. auth-runtime.cjs is a bundled snapshot of Koala's existing HTTP/auth helpers and their dependencies; runtime needs no Koala checkout.
