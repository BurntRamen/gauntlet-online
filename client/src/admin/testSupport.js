import { Fragment } from "react";
import { render as renderBase } from "@testing-library/react";
import { HelpProvider } from "./AuthoringHelp";

// Standalone workshop tests use the same deployed guidance contract as the app.
const help = require("../../../server/adminAuthoringGuide").help;
export function render(element, options = {}) {
  const Wrapper = options.wrapper || Fragment;
  return renderBase(element, { ...options, wrapper: ({ children }) => <HelpProvider value={help}><Wrapper>{children}</Wrapper></HelpProvider> });
}
