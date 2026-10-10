import runtime from '../auth-runtime.cjs';
import { showClientStatus } from "./client-status.mjs";
const { Command, registerLogin, loadDefaultServer, isRemoteDaemon, CredentialsError } = runtime;
async function buildClientProgram() {
  try {
    await loadDefaultServer();
  } catch (err) {
    if (!(err instanceof CredentialsError)) throw err;
    console.error(`${err.message}
ignoring your default server until that's fixed.`);
  }
  const program = new Command().name("koala").description("remote task status client").option("--sound", "layer continuous C octaves for waiting tasks (needs ffplay)").version("1.0.0");
  registerLogin(program);
  const show = async (watch) => {
    if (!isRemoteDaemon()) {
      throw new Error("choose a remote server with `koala login <url>` or KOALA_SERVER first.");
    }
    await showClientStatus(watch || !!program.opts().sound, !!program.opts().sound);
  };
  program.action(() => show(!!process.stdout.isTTY));
  program.command("status").description("show active tasks and agent activity").option("-w, --watch", "refresh every three seconds (terminal only)").action((options) => show(!!options.watch));
  return program;
}
export {
  buildClientProgram
};
