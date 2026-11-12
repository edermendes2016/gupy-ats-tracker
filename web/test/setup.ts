import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// O tutorial de primeiro uso abre quando não há marca no localStorage; cada teste começa limpo.
beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());
