export type BaseFieldType =
  | "u8"
  | "i8"
  | "u16"
  | "i16"
  | "u32"
  | "i32"
  | "u64"
  | "i64"
  | "f32"
  | "f64"
  | "bool"
  | "ptr";

// Can this be improved?
export type HexNumber = `0x${string}`;

export type FieldType =
  | BaseFieldType
  | `${BaseFieldType}[${number | HexNumber}]`;

export type Layout = {
  [name: string]: FieldType;
};

export type MapBaseFieldType<F extends FieldType> = F extends "u8" ? number
  : F extends "i8" ? number
  : F extends "u16" ? number
  : F extends "i16" ? number
  : F extends "u32" ? number
  : F extends "i32" ? number
  : F extends "u64" ? bigint
  : F extends "i64" ? bigint
  : F extends "f32" ? number
  : F extends "f64" ? number
  : F extends "bool" ? boolean
  : F extends "ptr" ? Deno.UnsafePointer
  : never;

export type MapArrayFieldType<F extends FieldType> = F extends `u8[${number}]`
  ? Uint8Array
  : F extends `i8[${number}]` ? Int8Array
  : F extends `u16[${number}]` ? Uint16Array
  : F extends `i16[${number}]` ? Int16Array
  : F extends `u32[${number}]` ? Uint32Array
  : F extends `i32[${number}]` ? Int32Array
  : F extends `u64[${number}]` ? BigUint64Array
  : F extends `i64[${number}]` ? BigInt64Array
  : F extends `ptr[${number}]` ? BigUint64Array
  : F extends "f32" ? Float32Array
  : F extends "f64" ? Float64Array
  : F extends "bool" ? Uint8Array
  : never;

export type MapFieldType<F extends FieldType> = F extends
  `${BaseFieldType}[${number}]` ? MapArrayFieldType<F>
  : MapBaseFieldType<F>;

export type FieldsStruct<L extends Layout> = {
  -readonly [name in keyof L]: MapFieldType<L[name]>;
};

export interface StructBase {
  _buffer: ArrayBuffer;
  _bufferView: DataView;
  _littleEndian: boolean;
}

export type Struct<L extends Layout> = StructBase & FieldsStruct<L>;

export const ARRAY_FIELD_TYPE_REGEX =
  /(u8|i8|u16|i16|u32|i32|u64|i64|f32|f64|bool)\[(0x[0-9a-fA-F]+|\d+)\]/;

export function computeFieldSize(field: FieldType): number {
  switch (field) {
    case "u8":
    case "i8":
    case "bool":
      return 1;
    case "u16":
    case "i16":
      return 2;
    case "u32":
    case "i32":
    case "f32":
      return 4;
    case "u64":
    case "i64":
    case "f64":
    case "ptr":
      return 8;
    default:
      if (ARRAY_FIELD_TYPE_REGEX.test(field)) {
        const [, type, length] = field.match(ARRAY_FIELD_TYPE_REGEX)!;
        return computeFieldSize(type as BaseFieldType) * parseInt(length);
      } else {
        throw new TypeError(`Invalid field type: ${field}`);
      }
  }
}

export function computeStructSize(layout: Layout): number {
  let size = 0;
  for (const [, field] of Object.entries(layout)) {
    const fieldSize = computeFieldSize(field);
    size += fieldSize;
  }
  return size;
}

export const LITTLE_ENDIAN =
  new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78;

export const mapTypedArray = (type: BaseFieldType) =>
  ({
    u8: Uint8Array,
    i8: Int8Array,
    u16: Uint16Array,
    i16: Int16Array,
    u32: Uint32Array,
    i32: Int32Array,
    u64: BigUint64Array,
    i64: BigInt64Array,
    f32: Float32Array,
    f64: Float64Array,
    bool: Uint8Array,
    ptr: BigUint64Array,
  })[type];

export function Struct<L extends Layout>(
  layout: L,
  data?: ArrayBuffer,
  littleEndian = LITTLE_ENDIAN,
): Struct<L> {
  const structSize = computeStructSize(layout);
  if (data !== undefined) {
    if (data.byteLength !== structSize) {
      throw new RangeError(
        `Invalid data size: ${data.byteLength}, expected to be ${structSize}`,
      );
    }
  } else {
    data = new ArrayBuffer(structSize);
  }

  const struct = {};

  Object.defineProperty(struct, "_buffer", {
    enumerable: false,
    value: data,
  });

  Object.defineProperty(struct, "_bufferView", {
    enumerable: false,
    value: new DataView(data),
  });

  Object.defineProperty(struct, "_littleEndian", {
    enumerable: false,
    value: littleEndian,
  });

  let offset = 0;
  for (const [name, field] of Object.entries(layout)) {
    const fieldSize = computeFieldSize(field);
    const currentOffset = offset;

    Object.defineProperty(struct, name, {
      get(this: Struct<L>) {
        switch (field) {
          case "u8":
            return this._bufferView.getUint8(currentOffset);
          case "i8":
            return this._bufferView.getInt8(currentOffset);
          case "u16":
            return this._bufferView.getUint16(
              currentOffset,
              this._littleEndian,
            );
          case "i16":
            return this._bufferView.getInt16(currentOffset, this._littleEndian);
          case "u32":
            return this._bufferView.getUint32(
              currentOffset,
              this._littleEndian,
            );
          case "i32":
            return this._bufferView.getInt32(currentOffset, this._littleEndian);
          case "u64":
            return this._bufferView.getBigUint64(
              currentOffset,
              this._littleEndian,
            );
          case "i64":
            return this._bufferView.getBigInt64(
              currentOffset,
              this._littleEndian,
            );
          case "f32":
            return this._bufferView.getFloat32(
              currentOffset,
              this._littleEndian,
            );
          case "f64":
            return this._bufferView.getFloat64(
              currentOffset,
              this._littleEndian,
            );
          case "bool":
            return this._bufferView.getUint8(currentOffset) !== 0;
          case "ptr":
            return new Deno.UnsafePointer(
              this._bufferView.getBigUint64(currentOffset, this._littleEndian),
            );
          default:
            if (ARRAY_FIELD_TYPE_REGEX.test(field)) {
              const [, type, length] = field.match(ARRAY_FIELD_TYPE_REGEX)!;
              const TypedArray = mapTypedArray(type as BaseFieldType);
              return new TypedArray(
                this._buffer,
                currentOffset,
                parseInt(length),
              );
            } else {
              throw new TypeError(
                `Invalid field type: ${field} (at offset ${currentOffset})`,
              );
            }
        }
      },
      set(this: Struct<L>, value) {
        switch (field) {
          case "u8":
            this._bufferView.setUint8(currentOffset, value);
            break;
          case "i8":
            this._bufferView.setInt8(currentOffset, value);
            break;
          case "u16":
            this._bufferView.setUint16(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "i16":
            this._bufferView.setInt16(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "u32":
            this._bufferView.setUint32(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "i32":
            this._bufferView.setInt32(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "u64":
            this._bufferView.setBigUint64(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "i64":
            this._bufferView.setBigInt64(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "f32":
            this._bufferView.setFloat32(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "f64":
            this._bufferView.setFloat64(
              currentOffset,
              value,
              this._littleEndian,
            );
            break;
          case "bool":
            this._bufferView.setUint8(currentOffset, value ? 1 : 0);
            break;
          case "ptr":
            if (
              typeof value !== "bigint" &&
              !(value instanceof Deno.UnsafePointer)
            ) {
              throw new TypeError(
                `Invalid value type: ${typeof value}, expected to be bigint or UnsafePointer`,
              );
            }
            this._bufferView.setBigUint64(
              currentOffset,
              value.valueOf(),
              this._littleEndian,
            );
            break;
          default:
            if (ARRAY_FIELD_TYPE_REGEX.test(field)) {
              const [, type, length] = field.match(ARRAY_FIELD_TYPE_REGEX)!;
              const TypedArray = mapTypedArray(type as BaseFieldType);
              if (value instanceof TypedArray) {
                if (value.length !== parseInt(length)) {
                  throw new RangeError(
                    `Invalid array length: ${value.length}, expected to be ${
                      parseInt(
                        length,
                      )
                    }`,
                  );
                }
                new Uint8Array(this._buffer).set(
                  new Uint8Array(value.buffer),
                  currentOffset,
                );
              } else {
                throw new TypeError(
                  `Invalid array type: ${value.constructor.name} (at offset ${currentOffset})`,
                );
              }
            } else {
              throw new TypeError(
                `Invalid field type: ${field} (at offset ${currentOffset})`,
              );
            }
        }
      },
    });

    offset += fieldSize;
  }

  (struct as any)[Symbol.for("Deno.customInspect")] = function (
    this: Struct<L>,
  ) {
    let offset = 0;
    return `Struct(0x${
      this._buffer.byteLength.toString(16).padStart(2, "0")
    }) {\n${
      Object.entries(layout).map(([field, type]) => {
        const value = this[field];
        const fmt = `  [0x${offset.toString(16).padStart(2, "0")}] ${field}: ${
          value instanceof Deno.UnsafePointer
            ? (value.value === 0n
              ? "nullptr"
              : `*0x${value.value.toString(16).padStart(16, "0")}`)
            : Deno.inspect(value, { colors: !Deno.noColor }).split("\n").map(
              (e) => "  " + e,
            ).join("\n").trimStart()
        }`;
        offset += computeFieldSize(type);
        return fmt;
      }).join("\n")
    }\n}`;
  };

  return struct as unknown as Struct<L>;
}
