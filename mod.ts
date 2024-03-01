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
  : F extends "u64" ? Deno.PointerValue
  : F extends "i64" ? Deno.PointerValue
  : F extends "f32" ? number
  : F extends "f64" ? number
  : F extends "bool" ? boolean
  : F extends "ptr" ? Deno.PointerValue
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

export function computeFieldAlign(field: FieldType): number {
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
        const [, type] = field.match(ARRAY_FIELD_TYPE_REGEX)!;
        return computeFieldAlign(type as BaseFieldType);
      } else {
        throw new TypeError(`Invalid field type: ${field}`);
      }
  }
}

export interface PaddedStructField {
  name: string;
  type: FieldType;
  size: number;
  offset: number;
}

export interface PaddedStructLayout {
  size: number;
  fields: PaddedStructField[];
}

export function padStructLayout(layout: Layout): PaddedStructLayout {
  let offset = 0;
  let align = 0;
  const fields: PaddedStructField[] = [];
  for (const [name, field] of Object.entries(layout)) {
    const fieldSize = computeFieldSize(field);
    const alignSize = computeFieldAlign(field);
    align = Math.max(align, alignSize);
    offset = Math.ceil(offset / alignSize) * alignSize;
    fields.push({ name, type: field, offset, size: fieldSize });
    offset += fieldSize;
  }
  offset = Math.ceil(offset / align) * align;
  return {
    size: offset,
    fields,
  };
}

export const LITTLE_ENDIAN: boolean =
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
  const padded = padStructLayout(layout);
  if (data !== undefined) {
    if (data.byteLength !== padded.size) {
      throw new RangeError(
        `Invalid data size: ${data.byteLength}, expected to be ${padded.size}`,
      );
    }
  } else {
    data = new ArrayBuffer(padded.size);
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

  for (const field of padded.fields) {
    Object.defineProperty(struct, field.name, {
      get(this: Struct<L>) {
        switch (field.type) {
          case "u8":
            return this._bufferView.getUint8(field.offset);
          case "i8":
            return this._bufferView.getInt8(field.offset);
          case "u16":
            return this._bufferView.getUint16(
              field.offset,
              this._littleEndian,
            );
          case "i16":
            return this._bufferView.getInt16(field.offset, this._littleEndian);
          case "u32":
            return this._bufferView.getUint32(
              field.offset,
              this._littleEndian,
            );
          case "i32":
            return this._bufferView.getInt32(field.offset, this._littleEndian);
          case "u64":
            return this._bufferView.getBigUint64(
              field.offset,
              this._littleEndian,
            );
          case "i64":
            return this._bufferView.getBigInt64(
              field.offset,
              this._littleEndian,
            );
          case "f32":
            return this._bufferView.getFloat32(
              field.offset,
              this._littleEndian,
            );
          case "f64":
            return this._bufferView.getFloat64(
              field.offset,
              this._littleEndian,
            );
          case "bool":
            return this._bufferView.getUint8(field.offset) !== 0;
          case "ptr":
            return this._bufferView.getBigUint64(
              field.offset,
              this._littleEndian,
            );
          default:
            if (ARRAY_FIELD_TYPE_REGEX.test(field.type)) {
              const [, type, length] = field.type.match(
                ARRAY_FIELD_TYPE_REGEX,
              )!;
              const TypedArray = mapTypedArray(type as BaseFieldType);
              return new TypedArray(
                this._buffer,
                field.offset,
                parseInt(length),
              );
            } else {
              throw new TypeError(
                `Invalid field type: ${field} (at offset ${field.offset})`,
              );
            }
        }
      },
      set(this: Struct<L>, value) {
        switch (field.type) {
          case "u8":
            this._bufferView.setUint8(field.offset, value);
            break;
          case "i8":
            this._bufferView.setInt8(field.offset, value);
            break;
          case "u16":
            this._bufferView.setUint16(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "i16":
            this._bufferView.setInt16(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "u32":
            this._bufferView.setUint32(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "i32":
            this._bufferView.setInt32(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "u64":
            this._bufferView.setBigUint64(
              field.offset,
              BigInt(value),
              this._littleEndian,
            );
            break;
          case "i64":
            this._bufferView.setBigInt64(
              field.offset,
              BigInt(value),
              this._littleEndian,
            );
            break;
          case "f32":
            this._bufferView.setFloat32(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "f64":
            this._bufferView.setFloat64(
              field.offset,
              value,
              this._littleEndian,
            );
            break;
          case "bool":
            this._bufferView.setUint8(field.offset, value ? 1 : 0);
            break;
          case "ptr":
            if (
              typeof value !== "bigint" && typeof value !== "number"
            ) {
              throw new TypeError(
                `Invalid value type: ${typeof value}, expected to be bigint or UnsafePointer`,
              );
            }
            this._bufferView.setBigUint64(
              field.offset,
              BigInt(value),
              this._littleEndian,
            );
            break;
          default:
            if (ARRAY_FIELD_TYPE_REGEX.test(field.type)) {
              const [, type, length] = field.type.match(
                ARRAY_FIELD_TYPE_REGEX,
              )!;
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
                  field.offset,
                );
              } else {
                throw new TypeError(
                  `Invalid array type: ${value.constructor.name} (at offset ${field.offset})`,
                );
              }
            } else {
              throw new TypeError(
                `Invalid field type: ${field} (at offset ${field.offset})`,
              );
            }
        }
      },
    });
  }

  // deno-lint-ignore no-explicit-any
  (struct as any)[Symbol.for("Deno.customInspect")] = function (
    this: Struct<L>,
  ) {
    return `Struct(0x${
      this._buffer.byteLength.toString(16).padStart(2, "0")
    }) {\n${
      padded.fields.map((field) => {
        const value = this[field.name];
        const fmt = `  [0x${
          field.offset.toString(16).padStart(2, "0")
        }] ${field.name}: ${
          field.type === "ptr" &&
            (typeof value === "bigint" || typeof value === "number")
            ? (value === 0
              ? "nullptr"
              : `*0x${value.toString(16).padStart(16, "0")}`)
            : Deno.inspect(value, { colors: !Deno.noColor }).split("\n").map(
              (e) => "  " + e,
            ).join("\n").trimStart()
        }`;
        return fmt;
      }).join("\n")
    }\n}`;
  };

  return struct as unknown as Struct<L>;
}
