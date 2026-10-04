import { describe, expect, it } from "vitest";

import { parseMapping } from "./loaLogs";

describe("parseMapping", () => {
  it("keeps boss -> task id pairs and drops anything else", () => {
    expect(parseMapping('{"Corvus Tul Rak": 3, "Field Boss": 0, "bad": "x"}')).toEqual({ "Corvus Tul Rak": 3, "Field Boss": 0 });
    expect(parseMapping("not json")).toEqual({});
    expect(parseMapping("[1, 2]")).toEqual({});
  });
});
