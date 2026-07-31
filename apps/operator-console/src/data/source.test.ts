import { describe, expect, it } from "vitest";
import { allowOperatorApiBase, resolveOperatorApiBase } from "./api-base";
import { createOperatorConsoleDataSource } from "./source";

describe("allowOperatorApiBase", () => {
  it("accepts only loopback http(s) origins", () => {
    expect(allowOperatorApiBase("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(allowOperatorApiBase("http://localhost:8787")).toBe("http://localhost:8787");
    expect(allowOperatorApiBase("https://127.0.0.1:8787")).toBe("https://127.0.0.1:8787");
  });

  it("rejects remote hosts, empty, and garbage", () => {
    expect(allowOperatorApiBase("http://evil.example:8787")).toBeNull();
    expect(allowOperatorApiBase("http://192.168.1.1:8787")).toBeNull();
    expect(allowOperatorApiBase("not-a-url")).toBeNull();
    expect(allowOperatorApiBase("")).toBeNull();
    expect(allowOperatorApiBase(null)).toBeNull();
    expect(allowOperatorApiBase(undefined)).toBeNull();
  });

  it("strips path and returns origin only", () => {
    expect(allowOperatorApiBase("http://127.0.0.1:8787/api/v1")).toBe("http://127.0.0.1:8787");
  });
});

describe("resolveOperatorApiBase", () => {
  it("defaults to null without VITE_OPERATOR_API_BASE (fixture mode)", () => {
    expect(resolveOperatorApiBase()).toBeNull();
  });
});

describe("createOperatorConsoleDataSource", () => {
  it("defaults to fixture; Live method is createCaHolderTask not createLocalDemoTask", () => {
    const ds = createOperatorConsoleDataSource();
    expect(ds.getDataSourceMeta().mode).toBe("fixture");
    expect(typeof ds.createCaHolderTask).toBe("function");
    expect(ds as { createLocalDemoTask?: unknown }).not.toHaveProperty("createLocalDemoTask");
  });
});
