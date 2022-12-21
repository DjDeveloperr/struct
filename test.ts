import { Struct } from "./mod.ts";
import { assertEquals } from "https://deno.land/std@0.118.0/testing/asserts.ts";

Deno.test("Struct", async (t) => {
  const GdkWindowAttr = {
    title: "ptr",
    event_mask: "i32",
    x: "i32",
    y: "i32",
    width: "i32",
    height: "i32",
    wclass: "i32",
    visual: "ptr",
    window_type: "i32",
    cursor: "ptr",
    wmclass_name: "ptr",
    wmclass_class: "ptr",
    override_redirect: "i32",
    type_hint: "i32",
  } as const;

  await t.step("simple struct", () => {
    const struct = Struct(GdkWindowAttr);
    struct.event_mask = 1;
    struct.x = 2;
    struct.y = 3;
    struct.width = 4;
    struct.height = 5;
    struct.wclass = 6;
    struct.window_type = 7;
    struct.override_redirect = 8;
    struct.type_hint = 9;
    assertEquals(struct.event_mask, 1);
    assertEquals(struct.x, 2);
    assertEquals(struct.y, 3);
    assertEquals(struct.width, 4);
    assertEquals(struct.height, 5);
    assertEquals(struct.wclass, 6);
    assertEquals(struct.window_type, 7);
    assertEquals(struct.override_redirect, 8);
    assertEquals(struct.type_hint, 9);
  });
});
