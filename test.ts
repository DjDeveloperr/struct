import { Struct, parseFmt } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.94.0/testing/asserts.ts";

Deno.test({
  name: "Format Parsing",
  fn() {
    const fmt1 = "hhhhbx";
    const fmt2 = "<bhhih";

    const info1 = parseFmt(fmt1);
    assertEquals(info1.le, false);
    assertEquals(info1.size, 10);
    const seq1 = ["h", "h", "h", "h", "b", "x"];
    seq1.forEach((e, i) => assertEquals(info1.seq[i], e));

    const info2 = parseFmt(fmt2);
    assertEquals(info2.le, true);
    assertEquals(info2.size, 11);
    const seq2 = ["b", "h", "h", "i", "h"];
    seq2.forEach((e, i) => assertEquals(info2.seq[i], e));
  },
});

Deno.test({
  name: "Struct Pack/Unpack",
  fn() {
    const data = ["str", 8, 16, 32, 64n, 16, 32, 64n];
    const fmt = "3sbhilHIL";
    const packed = Struct.pack(fmt, data);
    const unpacked = Struct.unpack(fmt, packed);
    assertEquals(unpacked[0], "str");
    assertEquals(unpacked[1], 8);
    assertEquals(unpacked[2], 16);
    assertEquals(unpacked[3], 32);
    assertEquals(unpacked[4], 64n);
    assertEquals(unpacked[5], 16);
    assertEquals(unpacked[6], 32);
    assertEquals(unpacked[7], 64n);
  },
});
