// based on python's struct module
export const sizes = {
  // empty byte (0u8)
  x: 1,
  // char
  c: 1,
  // unsigned byte (u8)
  b: 1,
  // signed byte (i8)
  B: 1,
  // unsigned short (u16)
  h: 2,
  // signed short (i16)
  H: 2,
  // uint (u32)
  i: 4,
  // int (i32)
  I: 4,
  // unsigned long (u64)
  l: 8,
  // signed long (i64)
  L: 8,
  // float (f32)
  f: 4,
  // double (f64)
  d: 8,
  // string (size determined by number preceding `s`, like `5s`, `8s`)
  s: 1,
  // boolean
  "?": 1,
};

export type DataType = keyof typeof sizes;
export const types = Object.keys(sizes);

export interface FmtInfo {
  le: boolean;
  size: number;
  seq: DataType[];
}

export function parseFmt(fmt: string) {
  const info: FmtInfo = {
    le: false,
    size: 0,
    seq: [],
  };

  if (fmt.startsWith("<")) {
    info.le = true;
    fmt = fmt.slice(1);
  } else if (
    fmt.startsWith(">") ||
    fmt.startsWith("!") ||
    fmt.startsWith("@") ||
    fmt.startsWith("=")
  ) {
    fmt = fmt.slice(1);
  }

  fmt = fmt.trim();

  let type = "";
  let state = "";
  let rep = "";
  const endType = () => {
    if (type !== "type") return;
    let r = rep == "" ? 1 : parseInt(rep);
    if (!types.includes(state)) throw new Error("Invalid type: " + state);
    if (state == "s") {
      info.seq.push(`${r}s` as any);
      info.size += r;
    } else
      for (let i = 0; i < r; i++) {
        info.size += (sizes as any)[state];
        info.seq.push(state as any);
      }
    state = "";
    rep = "";
    type = "";
  };
  fmt.split("").forEach((ch, i) => {
    if (ch.match(/\d/)) {
      if (type == "type") {
        if (types.includes(state)) {
          endType();
          type = "rep";
          rep += ch;
        } else state += ch;
      } else if (type == "rep" || type == "") {
        rep += ch;
      }
    } else if (ch.match(/(\w|\?)/)) {
      endType();
      type = "type";
      state += ch;
    } else if ([" ", ","].includes(ch)) {
      if (state == "" || state == "rep") {
      } else {
        endType();
      }
      type = "";
      rep = "";
      state = "";
    } else {
      throw new Error(`Invalid token "${ch}" at position ${i + 1}`);
    }
  });
  if (type == "type") endType();

  return info;
}

export class Struct {
  static pack(fmt: string, data: (number | string | bigint | boolean)[]) {
    const info = parseFmt(fmt);
    const result = new Uint8Array(info.size);
    const view = new DataView(result.buffer);
    let idx = 0;
    const le = info.le;
    let offset = 0;
    for (let _i in info.seq) {
      let i = Number(_i);
      const ch = info.seq[i];
      if (ch == "x") continue;
      let val = data[idx];
      if (val == undefined) throw new Error("Expected data at index " + idx);

      if (ch == "?") {
        view.setUint8(
          offset,
          typeof val === "bigint"
            ? val === 0n
              ? 0
              : 1
            : typeof val === "number"
            ? val === 0
              ? 0
              : 1
            : typeof val === "string"
            ? val === "0"
              ? 0
              : 1
            : typeof val === "boolean"
            ? val === true
              ? 1
              : 0
            : 0
        );
      } else if (ch == "b" || ch == "B" || ch == "c") {
        if (ch == "c") val = typeof val === "string" ? val.charCodeAt(0) : val;
        const u = ch == "b";
        const v = Number(val);
        if (u) view.setUint8(offset, v);
        else view.setInt8(offset, v);
      } else if (ch == "h" || ch == "H") {
        const u = ch == "h";
        const v = Number(val);
        if (u) view.setUint16(offset, v, le);
        else view.setInt16(offset, v, le);
      } else if (ch == "i" || ch == "I") {
        const u = ch == "i";
        const v = Number(val);
        if (u) view.setUint32(offset, v, le);
        else view.setInt32(offset, v, le);
      } else if (ch == "l" || ch == "L") {
        const u = ch == "l";
        const v = BigInt(val);
        if (u) view.setBigUint64(offset, v, le);
        else view.setBigInt64(offset, v, le);
      } else if (ch == "f") {
        const v = Number(val);
        view.setFloat32(offset, v, le);
      } else if (ch == "d") {
        const v = Number(val);
        view.setFloat64(offset, v, le);
      } else if (ch.endsWith("s")) {
        const size = Number(ch.substr(0, ch.length - 1));
        if (typeof val !== "string") throw new Error("Expected string");
        if (val.length !== size) throw new Error("Invalid string size");
        result.set(new TextEncoder().encode(val), offset);
        offset += size;
        idx += 1;
        continue;
      } else throw new Error("Invalid sequence: " + ch);
      idx += 1;
      offset += sizes[ch];
    }
    return result;
  }

  static unpack<T = (number | string | bigint | boolean)[]>(
    fmt: string,
    data: Uint8Array | DataView | number[] | ArrayBuffer
  ): T {
    const info = parseFmt(fmt);
    const res: any[] = [];
    const view =
      data instanceof DataView
        ? data
        : data instanceof Uint8Array
        ? new DataView(data.buffer)
        : Array.isArray(data)
        ? new DataView(new Uint8Array(data).buffer)
        : new DataView(data);
    if (view.byteLength < info.size)
      throw new Error("Not enough bytes in Buffer");

    let offset = 0;
    for (const ch of info.seq) {
      if (ch == "x") {
      } else if (ch == "b" || ch == "B") {
        const u = ch == "b";
        const v = u ? view.getUint8(offset) : view.getInt8(offset);
        res.push(v);
      } else if (ch == "c") {
        const v = view.getUint8(offset);
        res.push(String.fromCharCode(v));
      } else if (ch == "?") {
        const v = view.getUint8(offset) == 1;
        res.push(v);
      } else if (ch == "h" || ch == "H") {
        const u = ch == "h";
        const v = u
          ? view.getUint16(offset, info.le)
          : view.getInt16(offset, info.le);
        res.push(v);
      } else if (ch == "i" || ch == "I") {
        const u = ch == "i";
        const v = u
          ? view.getUint32(offset, info.le)
          : view.getInt32(offset, info.le);
        res.push(v);
      } else if (ch == "l" || ch == "L") {
        const u = ch == "l";
        const v = u
          ? view.getBigUint64(offset, info.le)
          : view.getBigInt64(offset, info.le);
        res.push(v);
      } else if (ch == "f") {
        const v = view.getFloat32(offset, info.le);
        res.push(v);
      } else if (ch == "d") {
        const v = view.getFloat64(offset, info.le);
        res.push(v);
      } else if (ch.endsWith("s")) {
        const size = Number(ch.substr(0, ch.length - 1));
        const bytes = new Uint8Array(view.buffer.slice(offset, offset + size));
        res.push(new TextDecoder("utf-8").decode(bytes));
        offset += size;
        continue;
      }
      offset += sizes[ch];
    }
    return res as any;
  }
}
