import { Struct } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.118.0/testing/asserts.ts";

Deno.test("Struct", async (t) => {
  const layout = {
    ptr: "ptr",
    i64: "i64",
    i64_array: "i64[2]",
    u64: "u64",
    i32: "i32",
    i32_array: "i32[0x02]",
    u16: "u16",
    i16: "i16",
    u8: "u8",
    i8: "i8",
    bool: "bool",
  } as const;

  // TODO
});
