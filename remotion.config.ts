/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Nel cloud delle routine (scripts/cloud/prepara-ambiente.sh): Chromium preinstallato che passa dal proxy
if (process.env.BROWSER_EXECUTABLE) Config.setBrowserExecutable(process.env.BROWSER_EXECUTABLE);
